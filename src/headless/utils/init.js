import { BrowserStorage, Model } from '@converse/skeletor';
import _converse from '../shared/_converse.js';
import log from '@converse/log';
import { ANONYMOUS, CORE_PLUGINS, EXTERNAL, LOGIN } from '../shared/constants.js';
import { Strophe } from 'strophe.js';
import { createStore, initStorage } from './storage.js';
import { local_driver, sync_driver } from './extension-storage.js';
import { getNodeStore } from './node-store.js';
import { generateResource, getConnectionServiceURL } from '../shared/connection/utils.js';
import { isSameBareJID } from './jid.js';
import { addUnloadListener, IS_BROWSER } from './environment.js';
import { getRememberedSession } from './remembered-session.js';
import { isResumable, isTestEnv } from './session.js';
import { isPersistableModel } from './object.js';

/**
 * Initializes the plugins for the Converse instance.
 * @param {import('../shared/_converse.js').ConversePrivateGlobal} _converse
 * @fires _converse#pluginsInitialized - Triggered once all plugins have been initialized.
 * @memberOf _converse
 */
export function initPlugins(_converse) {
    // If initialize gets called a second time (e.g. during tests), then we
    // need to re-apply all plugins (for a new converse instance), and we
    // therefore need to clear this array that prevents plugins from being
    // initialized twice.
    // If initialize is called for the first time, then this array is empty
    // in any case.
    _converse.pluggable.initialized_plugins = [];
    const whitelist = CORE_PLUGINS.concat(_converse.api.settings.get('whitelisted_plugins'));

    if (_converse.api.settings.get('singleton')) {
        ['converse-bookmarks', 'converse-controlbox', 'converse-headline', 'converse-register'].forEach((name) =>
            _converse.api.settings.get('blacklisted_plugins').push(name),
        );
    }

    _converse.pluggable.initializePlugins({ _converse }, whitelist, _converse.api.settings.get('blacklisted_plugins'));

    /**
     * Triggered once all plugins have been initialized. This is a useful event if you want to
     * register event handlers but would like your own handlers to be overridable by
     * plugins. In that case, you need to first wait until all plugins have been
     * initialized, so that their overrides are active. One example where this is used
     * is in [converse-notifications.js](https://github.com/jcbrand/converse.js/blob/master/src/converse-notification.js)`.
     *
     * Also available as an [ES2015 Promise](http://es6-features.org/#PromiseUsage)
     * which can be listened to with `_converse.api.waitUntil`.
     *
     * @event _converse#pluginsInitialized
     * @memberOf _converse
     * @example _converse.api.listen.on('pluginsInitialized', () => { ... });
     */
    _converse.api.trigger('pluginsInitialized');
}

/**
 * @param {import('../shared/_converse.js').ConversePrivateGlobal} _converse
 */
export async function initClientConfig(_converse) {
    /* The client config refers to configuration of the client which is
     * independent of any particular user.
     * What this means is that config values need to persist across
     * user sessions.
     */
    const id = 'converse.client-config';
    const config = new Model({ id, 'trusted': true });
    config.storage = createStore(id, 'session');

    Object.assign(_converse, { config }); // XXX DEPRECATED
    Object.assign(_converse.state, { config });

    await new Promise((r) => config.fetch({ 'success': r, 'error': r }));
    /**
     * Triggered once the XMPP-client configuration has been initialized.
     * The client configuration is independent of any particular and its values
     * persist across user sessions.
     *
     * @event _converse#clientConfigInitialized
     * @example
     * _converse.api.listen.on('clientConfigInitialized', () => { ... });
     */
    _converse.api.trigger('clientConfigInitialized');
}

/**
 * @param {import('../shared/_converse.js').ConversePrivateGlobal} _converse
 */
export async function initSessionStorage(_converse) {
    if (!IS_BROWSER) {
        // Node has no sessionStorage, so the session store is the same SQLite
        // store as the persistent one. Nothing depends on it being cleared when
        // the process exits: `clear_cache_on_logout` and the logout path both
        // clear it explicitly.
        _converse.storage['session'] = getNodeStore();
        return;
    }
    await BrowserStorage.sessionStorageInitialized;
    _converse.storage['session'] = BrowserStorage.localForage.createInstance({
        name: isTestEnv() ? 'converse-test-session' : 'converse-session',
        description: 'sessionStorage instance',
        driver: ['sessionStorageWrapper'],
    });
}

/**
 * Registers a localForage driver for a browser extension storage area and
 * switches to it. Failures are logged, leaving the default driver in place.
 * @param {LocalForageDriver} driver
 */
async function useExtensionDriver(driver) {
    try {
        await BrowserStorage.localForage.defineDriver(driver);
        await BrowserStorage.localForage.setDriver(driver._driver);
    } catch (e) {
        log.error(e);
    }
}

/**
 * Initializes persistent storage
 * @param {import('../shared/_converse.js').ConversePrivateGlobal} _converse
 * @param {string} store_name - The name of the store.
 * @param {string} [key="persistent"] - The key for `_converse.storage`.
 * @returns {Promise<void>} Resolves once the extension storage driver is in use.
 */
export async function initPersistentStorage(_converse, store_name, key = 'persistent') {
    const { api } = _converse;
    if (!IS_BROWSER) {
        // IndexedDB, localStorage and sessionStorage are all browser APIs, so
        // `persistent_store` has nothing to select between under Node. Every
        // store shares one SQLite database, the same way they share one
        // localForage instance in the browser.
        _converse.storage[key] = getNodeStore();
        return;
    }
    if (api.settings.get('persistent_store') === 'sessionStorage') {
        _converse.storage[key] = _converse.storage['session'];
        return;
    } else if (api.settings.get('persistent_store') === 'BrowserExtLocal') {
        // Wait for the switch so that nothing is read or written through the
        // default backend (IndexedDB or localStorage) in the meantime.
        await useExtensionDriver(local_driver);
        _converse.storage[key] = BrowserStorage.localForage;
        return;
    } else if (api.settings.get('persistent_store') === 'BrowserExtSync') {
        await useExtensionDriver(sync_driver);
        _converse.storage[key] = BrowserStorage.localForage;
        return;
    }

    const config = {
        name: isTestEnv() ? 'converse-test-persistent' : 'converse-persistent',
        storeName: store_name,
    };
    if (api.settings.get('persistent_store') === 'localStorage') {
        config['description'] = 'localStorage instance';
        config['driver'] = [BrowserStorage.localForage.LOCALSTORAGE];
    } else if (api.settings.get('persistent_store') === 'IndexedDB') {
        config['description'] = 'indexedDB instance';
        config['driver'] = [BrowserStorage.localForage.INDEXEDDB];
    }
    _converse.storage[key] = BrowserStorage.localForage.createInstance(config);
}

/**
 * @param {import('../shared/_converse.js').ConversePrivateGlobal} _converse
 * @param {string} jid
 */
function saveJIDtoSession(_converse, jid) {
    const { api, session } = _converse;

    if (api.settings.get('authentication') !== ANONYMOUS && !Strophe.getResourceFromJid(jid)) {
        jid = jid.toLowerCase() + generateResource();
    }

    const bare_jid = Strophe.getBareJidFromJid(jid);
    const resource = Strophe.getResourceFromJid(jid);
    const domain = Strophe.getDomainFromJid(jid);

    // TODO: Storing directly on _converse is deprecated
    Object.assign(_converse, { jid, bare_jid, resource, domain });

    session.save({
        jid,
        bare_jid,
        resource,
        domain,
        // We use the `active` flag to determine whether we should use the values from sessionStorage.
        // When "cloning" a tab (e.g. via middle-click), the `active` flag will be set and we'll create
        // a new empty user session, otherwise it'll be false and we can reuse the user session.
        // When the tab is reloaded, the `active` flag is set to `false`.
        'active': true,
    });
    // Set JID on the connection object so that when we call `connection.bind`
    // the new resource is found by Strophe.js and sent to the XMPP server.
    api.connection.get().jid = jid;
}

/**
 * Stores the passed in JID for the current user, potentially creating a
 * resource if the JID is bare.
 *
 * Given that we can only create an XMPP connection if we know the domain of
 * the server connect to and we only know this once we know the JID, we also
 * call {@link api.connection.init} (if necessary) to make sure that the
 * connection is set up.
 *
 * @emits _converse#setUserJID
 * @param {string} jid
 */
export async function setUserJID(jid) {
    await initSession(_converse, jid);

    /**
     * Triggered whenever the user's JID has been updated
     * @event _converse#setUserJID
     */
    _converse.api.trigger('setUserJID');
    return jid;
}

/**
 * @param {import('../shared/_converse.js').ConversePrivateGlobal} _converse
 * @param {string} jid
 */
export async function initSession(_converse, jid) {
    /**
     * *Hook* through which a plugin says that the user's session is shared by
     * all tabs (as one held by a shared worker is), so that its data is kept
     * where every tab can read it, rather than in this tab only.
     * @event _converse#shouldShareSession
     * @param {null} context
     * @param {boolean} shared
     */
    const is_shared_session = await _converse.api.hook('shouldShareSession', null, false);

    const bare_jid = Strophe.getBareJidFromJid(jid).toLowerCase();
    const id = `converse.session-${bare_jid}`;
    if (_converse.session?.get('id') !== id) {
        await initPersistentStorage(_converse, bare_jid);

        _converse.session.set({ id });
        initStorage(_converse.session, id, is_shared_session ? 'persistent' : 'session');
        await new Promise((r) => _converse.session.fetch({ success: r, error: r }));

        if (!is_shared_session && _converse.session.get('active')) {
            // If the `active` flag is set, it means this tab was cloned from
            // another (e.g. via middle-click), and its session data was copied over.
            _converse.session.clear();
            _converse.session.save({ id });
        }
        saveJIDtoSession(_converse, jid);

        // Set `active` flag to false when the tab gets reloaded
        addUnloadListener(() => safeSave(_converse.session, { active: false }));

        /**
         * Triggered once the user's session has been initialized. The session is a
         * cache which stores information about the user's current session.
         * @event _converse#userSessionInitialized
         * @memberOf _converse
         */
        _converse.api.trigger('userSessionInitialized');
    } else {
        saveJIDtoSession(_converse, jid);
    }
}

/**
 * @param {import('../shared/_converse.js').ConversePrivateGlobal} _converse
 */
export function registerGlobalEventHandlers(_converse) {
    /**
     * Plugins can listen to this event as cue to register their
     * global event handlers.
     * @event _converse#registeredGlobalEventHandlers
     * @example _converse.api.listen.on('registeredGlobalEventHandlers', () => { ... });
     */
    _converse.api.trigger('registeredGlobalEventHandlers');
}

/**
 * @param {import('../shared/_converse.js').ConversePrivateGlobal} _converse
 */
function unregisterGlobalEventHandlers(_converse) {
    _converse.api.trigger('unregisteredGlobalEventHandlers');
}

/**
 * Make sure everything is reset in case this is a subsequent call to
 * converse.initialize (happens during tests).
 * @param {import('../shared/_converse.js').ConversePrivateGlobal} _converse
 */
export async function cleanup(_converse) {
    const { api } = _converse;
    await api.trigger('cleanup', { 'synchronous': true });
    unregisterGlobalEventHandlers(_converse);
    api.connection.get()?.reset();
    _converse.stopListening();
    _converse.off();
    if (_converse.promises['initialized'].isResolved) {
        // Not replaced on logout, since Converse isn't initialized again then.
        api.promises.add('initialized', false);
    }
}

async function getLoginCredentialsFromSCRAMKeys() {
    const jid = await getRememberedSession();
    if (!jid) return null;

    await setUserJID(jid);

    const login_info = await savedLoginInfo(jid);
    const scram_keys = login_info.get('scram_keys');
    return scram_keys ? { jid, password: scram_keys } : null;
}

/**
 * Whether the account can log in again with credentials that Converse holds
 * itself: a password passed in or set, or stored SCRAM keys.
 * @param {string} jid
 * @param {string} [password]
 * @returns {Promise<boolean>}
 */
async function canLogInWithOwnCredentials(jid, password) {
    const { api } = _converse;
    if (password || api.settings.get('password')) return true;
    return !!(api.settings.get('reuse_scram_keys') && (await savedLoginInfo(jid)).get('scram_keys'));
}

/**
 * Asks the credential sources of last resort for credentials to log in with.
 * @param {Omit<import('./types').FallbackCredentialsHookPayload, 'credentials'>} payload
 * @returns {Promise<import('./types').Credentials|null>}
 */
async function getFallbackCredentials(payload) {
    const { api } = _converse;
    /**
     * *Hook* through which credential sources of last resort, such as the
     * browser's credential store, supply the credentials to log in with, once
     * Converse has none of its own and no other source has any. A source that
     * supplies credentials returns them in `credentials`.
     *
     * It's asked when logging in, and before that when deciding whether a
     * remembered session can be resumed. The payload then has `unattended`
     * set and the remembered account's bare `jid`, and a source may only
     * supply credentials for that account, without asking the user.
     * @event _converse#fallbackLoginCredentials
     * @param {null} context
     * @param {import('./types').FallbackCredentialsHookPayload} payload
     */
    try {
        const { credentials } = await api.hook('fallbackLoginCredentials', null, { ...payload, credentials: null });
        return credentials ?? null;
    } catch (e) {
        log.error('getFallbackCredentials: a credential source failed');
        log.error(e);
        return null;
    }
}

/**
 * Loads the remembered session from the cache, before connecting, if this
 * start-up is to resume it. Plugins do the loading, by listening for
 * `loadSessionCache`, and the connection then retries for as long as the
 * session is remembered.
 *
 * @param {string} [jid] - The JID that the session is started for, if one was given.
 *  A session for another account isn't resumed.
 * @param {string} [password]
 * @returns {Promise<{ credentials: import('./types').Credentials|null }|null>} The
 *  resumed session, with the credentials to log in with if a credential source
 *  obtained them while answering, or `null` if it wasn't resumed.
 */
export async function resumeSession(jid, password) {
    const { api } = _converse;
    const remembered = await getRememberedSession();
    if (!remembered) return null;
    if (jid && Strophe.getBareJidFromJid(jid).toLowerCase() !== remembered) return null;
    if (!isResumable(_converse)) return null;

    // Asked now, rather than when connecting, so that a session is only
    // resumed if it can log in again.
    /**
     * *Hook* which asks whether the remembered account can log in again
     * without the user, so that its session can be resumed from the cache.
     *
     * Core sets `can_log_in` beforehand if it holds credentials itself, and
     * keeps that answer whatever listeners return. A credential source sets
     * `can_log_in` if it can supply credentials for the account without the
     * user, optionally with those credentials, and sets `veto` if the
     * session must not be resumed. Listeners only ever set these flags,
     * never clear them.
     * @event _converse#unattendedLogin
     * @param {null} context
     * @param {import('./types').UnattendedLoginPayload} payload
     */
    const own = await canLogInWithOwnCredentials(remembered, password);
    const answer = await api.hook('unattendedLogin', null, {
        jid: remembered,
        named: !!jid,
        can_log_in: own,
        veto: false,
        credentials: null,
    });
    const { can_log_in, veto } = answer;
    let { credentials } = answer;
    if (veto) return null;
    if (credentials && !isSameBareJID(credentials.jid, remembered)) {
        log.warn(`resumeSession: ignoring credentials for ${credentials.jid}, not the remembered ${remembered}`);
        credentials = null;
    }
    if (!own && !can_log_in) {
        // Nobody vouches for the account, so sources of last resort are
        // asked, which have to answer without the user.
        credentials = await getFallbackCredentials({ automatic: true, unattended: true, jid: remembered });
        if (!credentials || !isSameBareJID(credentials.jid, remembered)) return null;
    }

    await setUserJID(jid || credentials?.jid || remembered);
    const connection = api.connection.get();
    connection.resumed_jid = remembered;
    connection.remembered = true;
    /**
     * Synchronous event triggered when a remembered session is resumed,
     * before connecting, for plugins to load what they've cached. Nothing may
     * be sent in response, since there's no connection yet.
     * @event _converse#loadSessionCache
     */
    try {
        await api.trigger('loadSessionCache', { synchronous: true });
    } catch (e) {
        // What a plugin couldn't load, it loads once connected, as it does
        // for a session that isn't resumed.
        log.error(e);
    }
    return { credentials };
}

/**
 * @param {import('./types').Credentials} [credentials]
 * @param {boolean} [automatic]
 */
export async function attemptNonPreboundSession(credentials, automatic) {
    const { api } = _converse;
    /**
     * *Hook* through which credential sources supply the credentials to log
     * in with. The payload's `credentials` are those passed in, if any. A
     * source that supplies credentials returns them in `credentials`, with
     * `renewable` set on them if they can be replaced when the server rejects
     * them, so that Converse then tries again.
     *
     * Plugins are asked in the order they registered their listeners. If no
     * listener supplies credentials, Converse uses the password of an earlier
     * attempt, then stored SCRAM keys, then asks `fallbackLoginCredentials`.
     * @event _converse#beforeAttemptNonPreboundSession
     * @param {unknown} context
     * @param {import('./types').CredentialsHookPayload} payload
     */
    let new_creds = credentials;
    try {
        ({ credentials: new_creds } = await api.hook('beforeAttemptNonPreboundSession', undefined, {
            credentials,
            automatic,
        }));
    } catch (e) {
        // Carries on as if the source had supplied nothing, rather than
        // leaving the login hanging.
        log.error('attemptNonPreboundSession: a credential source failed');
        log.error(e);
    }
    if (new_creds) return connect(new_creds);

    if (api.settings.get('authentication') === LOGIN) {
        const jid = _converse.session.get('jid');
        // XXX: If EITHER ``keepalive`` or ``auto_login`` is ``true`` and
        // ``authentication`` is set to ``login``, then Converse will try to log the user in,
        // since we don't have a way to distinguish between whether we're
        // restoring a previous session (``keepalive``) or whether we're
        // automatically setting up a new session (``auto_login``).
        // So we can't do the check (!automatic || _converse.api.settings.get("auto_login")) here.
        if (jid && (api.settings.get('password') || api.connection.get()?.pass)) {
            return connect();
        }

        if (api.settings.get('reuse_scram_keys')) {
            const credentials = await getLoginCredentialsFromSCRAMKeys();
            if (credentials) return connect(credentials);
        }

        const fallback = await getFallbackCredentials({ automatic });
        if (fallback) return connect(fallback);

        if (!isTestEnv()) log.debug("attemptNonPreboundSession: Couldn't find credentials to log in with");

        const connection = api.connection.get();
        if (connection?.remembered) {
            // A remembered session that can't log in again, for example a
            // resumed one, would otherwise stay on screen without ever
            // connecting. It ends as one whose credentials are rejected does,
            // so that the user is asked to log in.
            const { __ } = _converse;
            connection.setDisconnectionCause(
                Strophe.Status.AUTHFAIL,
                __('Your session has ended, please log in again.'),
                true,
            );
            await connection.finishDisconnection();
        }
    } else if (
        [ANONYMOUS, EXTERNAL].includes(api.settings.get('authentication')) &&
        (!automatic || api.settings.get('auto_login'))
    ) {
        connect();
    }
}

/**
 * Fetch the stored SCRAM keys for the given JID, if available.
 *
 * The user's plaintext password is not stored, nor any material from which
 * the user's plaintext password could be recovered.
 *
 * @param {String} jid - The XMPP address for which to fetch the SCRAM keys
 * @returns {Promise<Model>} A promise which resolves once we've fetched the previously
 *  used login keys.
 */
export async function savedLoginInfo(jid) {
    const bare_jid = Strophe.getBareJidFromJid(jid);
    const id = `converse.scram-keys-${bare_jid}`;
    if (_converse.state.login_info?.get('id') === id) {
        return _converse.state.login_info;
    }

    // A resumed start-up looks for the keys before setUserJID() has opened
    // the account's persistent store.
    if (!_converse.storage.persistent) await initPersistentStorage(_converse, bare_jid.toLowerCase());

    const login_info = /** @type {Model} */ (new Model({ id }));
    _converse.state.login_info = login_info;
    initStorage(login_info, id, 'persistent');
    await new Promise((f) => login_info.fetch({ 'success': f, 'error': f }));
    return login_info;
}

/**
 * @param {Object} [credentials]
 * @param {string} [credentials.jid]
 * @param {string|{ ck: string }} credentials.password
 * @param {boolean} [credentials.renewable] - Whether the source of the
 *  credentials can renew them if the server rejects them.
 * @returns {Promise<void>}
 */
async function connect(credentials) {
    const { api } = _converse;
    let jid = _converse.session.get('jid');
    const connection = api.connection.get();
    // Fetching the credentials can outlast the connection, for example if the user logs out.
    if (!connection) return;

    connection.renewable_credentials = !!credentials?.renewable;

    const login_jid = credentials?.jid ?? jid;
    if (connection.resumed_jid && login_jid && !isSameBareJID(login_jid, connection.resumed_jid)) {
        // The credentials are for another account than the session resumed
        // from the cache, for example a plugin's token after another user
        // logged into the hosting site. That session ends first, as if
        // logged out, and the other account logs in afresh. Renewable
        // credentials are left to their source, which is asked again.
        const password = credentials?.renewable
            ? undefined
            : (credentials?.password ?? (connection.pass || api.settings.get('password')));
        await api.user.logout();
        return api.user.login(login_jid, password);
    }

    if (connection.has_connected && jid && login_jid && !isSameBareJID(login_jid, jid)) {
        // A session that has logged in stays with its account. Switching it
        // would keep the other account's state, so it ends instead.
        log.warn(`connect: the credentials are for ${login_jid}, not ${jid}, so the session ends`);
        const { __ } = _converse;
        connection.setDisconnectionCause(
            Strophe.Status.AUTHFAIL,
            __('Your session has ended, please log in again.'),
            true,
        );
        return connection.finishDisconnection();
    }

    if (login_jid && !(jid && isSameBareJID(login_jid, jid))) {
        // Credentials supplied by a plugin, for an account that the session isn't for yet.
        await setUserJID(login_jid);
        jid = _converse.session.get('jid');
    }

    if ([ANONYMOUS, EXTERNAL].includes(api.settings.get('authentication'))) {
        if (!jid) {
            throw new Error(
                'Config Error: when using anonymous login ' +
                    "you need to provide the server's domain via the 'jid' option. " +
                    'Either when calling converse.initialize, or when calling ' +
                    '_converse.api.user.login.',
            );
        }
        if (!connection.reconnecting) {
            connection.reset();
        }
        connection.connect(jid.toLowerCase());
    } else if (api.settings.get('authentication') === LOGIN) {
        const password = credentials?.password ?? (connection?.pass || api.settings.get('password'));
        if (!password) {
            if (api.settings.get('auto_login')) {
                throw new Error(
                    'autoLogin: If you use auto_login and ' +
                        "authentication='login' then you also need to provide a password.",
                );
            }
            connection.setDisconnectionCause(Strophe.Status.AUTHFAIL, undefined, true);
            api.connection.disconnect();
            return;
        }
        if (!connection.reconnecting) {
            connection.reset();
            connection.service = getConnectionServiceURL();
        }

        let callback;
        // Save the SCRAM data if we're not already logged in with SCRAM
        if (_converse.state.config.get('trusted') && jid && api.settings.get('reuse_scram_keys') && !password?.ck) {
            // Store scram keys in scram storage
            const login_info = await savedLoginInfo(jid);
            callback =
                /**
                 * @param {number} status
                 * @param {string} message
                 * @param {Element} [elem]
                 */
                (status, message, elem) => {
                    const { scram_keys } = connection;
                    if (scram_keys) login_info.save({ scram_keys });
                    connection.onConnectStatusChanged(status, message, elem);
                };
        }
        connection.connect(jid, password, callback);
    }
}

/**
 * @param {Model} model
 * @param {Record<string, any>} attributes
 * @param {Record<string, any>} [options]
 */
export function safeSave(model, attributes, options) {
    if (isPersistableModel(model)) {
        model.save(attributes, options);
    } else {
        model.set(attributes, options);
    }
}
