import Storage from '@converse/skeletor/src/storage.js';
import _converse from '@converse/headless/shared/_converse';
import debounce from 'lodash-es/debounce';
import localDriver from 'localforage-webextensionstorage-driver/local';
import log from '@converse/headless/log';
import syncDriver from 'localforage-webextensionstorage-driver/sync';
import { CORE_PLUGINS } from '@converse/headless/shared/constants.js';
import { Connection } from '@converse/headless/shared/connection/index.js';
import { Model } from '@converse/skeletor/src/model.js';
import { Strophe } from 'strophe.js/src/strophe';
import { createStore, initStorage } from '@converse/headless/utils/storage.js';
import { getLoginCredentialsFromBrowser } from '@converse/headless/utils/core.js';


export function initPlugins (_converse) {
    // If initialize gets called a second time (e.g. during tests), then we
    // need to re-apply all plugins (for a new converse instance), and we
    // therefore need to clear this array that prevents plugins from being
    // initialized twice.
    // If initialize is called for the first time, then this array is empty
    // in any case.
    _converse.pluggable.initialized_plugins = [];
    const whitelist = CORE_PLUGINS.concat(_converse.api.settings.get("whitelisted_plugins"));

    if (_converse.api.settings.get("singleton")) {
        [
            'converse-bookmarks',
            'converse-controlbox',
            'converse-headline',
            'converse-register'
        ].forEach(name => _converse.api.settings.get("blacklisted_plugins").push(name));
    }

    _converse.pluggable.initializePlugins(
        { _converse },
        whitelist,
        _converse.api.settings.get("blacklisted_plugins")
    );

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

export async function initClientConfig (_converse) {
    /* The client config refers to configuration of the client which is
     * independent of any particular user.
     * What this means is that config values need to persist across
     * user sessions.
     */
    const id = 'converse.client-config';
    _converse.config = new Model({ id, 'trusted': true });
    _converse.config.browserStorage = createStore(id, "session");
    await new Promise(r => _converse.config.fetch({'success': r, 'error': r}));
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

export async function initSessionStorage (_converse) {
    await Storage.sessionStorageInitialized;
    _converse.storage = {
        'session': Storage.localForage.createInstance({
            'name': _converse.isTestEnv() ? 'converse-test-session' : 'converse-session',
            'description': 'sessionStorage instance',
            'driver': ['sessionStorageWrapper']
        })
    };
}

function initPersistentStorage (_converse, store_name) {
    if (_converse.api.settings.get('persistent_store') === 'sessionStorage') {
        return;
    } else if (_converse.api.settings.get("persistent_store") === 'BrowserExtLocal') {
        Storage.localForage.defineDriver(localDriver).then(
            () => Storage.localForage.setDriver('webExtensionLocalStorage')
        );
        _converse.storage['persistent'] = Storage.localForage;
        return;

    } else if (_converse.api.settings.get("persistent_store") === 'BrowserExtSync') {
        Storage.localForage.defineDriver(syncDriver).then(
            () => Storage.localForage.setDriver('webExtensionSyncStorage')
        );
        _converse.storage['persistent'] = Storage.localForage;
        return;
    }

    const config = {
        'name': _converse.isTestEnv() ? 'converse-test-persistent' : 'converse-persistent',
        'storeName': store_name
    }
    if (_converse.api.settings.get("persistent_store") === 'localStorage') {
        config['description'] = 'localStorage instance';
        config['driver'] = [Storage.localForage.LOCALSTORAGE];
    } else if (_converse.api.settings.get("persistent_store") === 'IndexedDB') {
        config['description'] = 'indexedDB instance';
        config['driver'] = [Storage.localForage.INDEXEDDB];
    }
    _converse.storage['persistent'] = Storage.localForage.createInstance(config);
}

function saveJIDtoSession (_converse, jid) {
    jid = _converse.session.get('jid') || jid;
    if (_converse.api.settings.get("authentication") !== _converse.ANONYMOUS && !Strophe.getResourceFromJid(jid)) {
        jid = jid.toLowerCase() + Connection.generateResource();
    }
    _converse.jid = jid;
    _converse.bare_jid = Strophe.getBareJidFromJid(jid);
    _converse.resource = Strophe.getResourceFromJid(jid);
    _converse.domain = Strophe.getDomainFromJid(jid);
    _converse.session.save({
       'jid': jid,
       'bare_jid': _converse.bare_jid,
       'resource': _converse.resource,
       'domain': _converse.domain,
        // We use the `active` flag to determine whether we should use the values from sessionStorage.
        // When "cloning" a tab (e.g. via middle-click), the `active` flag will be set and we'll create
        // a new empty user session, otherwise it'll be false and we can re-use the user session.
        // When the tab is reloaded, the `active` flag is set to `false`.
       'active': true
    });
    // Set JID on the connection object so that when we call `connection.bind`
    // the new resource is found by Strophe.js and sent to the XMPP server.
    _converse.connection.jid = jid;
}

/**
 * Stores the passed in JID for the current user, potentially creating a
 * resource if the JID is bare.
 *
 * Given that we can only create an XMPP connection if we know the domain of
 * the server connect to and we only know this once we know the JID, we also
 * call {@link _converse.initConnection } (if necessary) to make sure that the
 * connection is set up.
 *
 * @emits _converse#setUserJID
 * @params { String } jid
 */
export async function setUserJID (jid) {
    await initSession(_converse, jid);
    /**
     * Triggered whenever the user's JID has been updated
     * @event _converse#setUserJID
     */
    _converse.api.trigger('setUserJID');
    return jid;
}

export async function initSession (_converse, jid) {
    const is_shared_session = _converse.api.settings.get('connection_options').worker;

    const bare_jid = Strophe.getBareJidFromJid(jid).toLowerCase();
    const id = `converse.session-${bare_jid}`;
    if (_converse.session?.get('id') !== id) {
        initPersistentStorage(_converse, bare_jid);

        _converse.session = new Model({ id });
        initStorage(_converse.session, id, is_shared_session ? "persistent" : "session");
        await new Promise(r => _converse.session.fetch({'success': r, 'error': r}));

        if (!is_shared_session && _converse.session.get('active')) {
            // If the `active` flag is set, it means this tab was cloned from
            // another (e.g. via middle-click), and its session data was copied over.
            _converse.session.clear();
            _converse.session.save({id});
        }
        saveJIDtoSession(_converse, jid);

        // Set `active` flag to false when the tab gets reloaded
        window.addEventListener(_converse.unloadevent, () => _converse.session?.save('active', false));

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

export function registerGlobalEventHandlers (_converse) {
    document.addEventListener("visibilitychange", _converse.saveWindowState);
    _converse.saveWindowState({'type': document.hidden ? "blur" : "focus"}); // Set initial state
    /**
     * Called once Converse has registered its global event handlers
     * (for events such as window resize or unload).
     * Plugins can listen to this event as cue to register their own
     * global event handlers.
     * @event _converse#registeredGlobalEventHandlers
     * @example _converse.api.listen.on('registeredGlobalEventHandlers', () => { ... });
     */
    _converse.api.trigger('registeredGlobalEventHandlers');
}


function unregisterGlobalEventHandlers (_converse) {
    const { api } = _converse;
    document.removeEventListener("visibilitychange", _converse.saveWindowState);
    api.trigger('unregisteredGlobalEventHandlers');
}

// Make sure everything is reset in case this is a subsequent call to
// converse.initialize (happens during tests).
export async function cleanup (_converse) {
    const { api } = _converse;
    await api.trigger('cleanup', {'synchronous': true});
    _converse.router.history.stop();
    unregisterGlobalEventHandlers(_converse);
    _converse.connection?.reset();
    _converse.stopListening();
    _converse.off();
    if (_converse.promises['initialized'].isResolved) {
        api.promises.add('initialized')
    }
}

async function getLoginCredentials () {
    let credentials;
    let wait = 0;
    while (!credentials) {
        try {
            credentials = await fetchLoginCredentials(wait); // eslint-disable-line no-await-in-loop
        } catch (e) {
            log.error('Could not fetch login credentials');
            log.error(e);
        }
        // If unsuccessful, we wait 2 seconds between subsequent attempts to
        // fetch the credentials.
        wait = 2000;
    }
    return credentials;
}


function fetchLoginCredentials (wait=0) {
    return new Promise(
        debounce(async (resolve, reject) => {
            let xhr = new XMLHttpRequest();
            xhr.open('GET', _converse.api.settings.get("credentials_url"), true);
            xhr.setRequestHeader('Accept', 'application/json, text/javascript');
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 400) {
                    const data = JSON.parse(xhr.responseText);
                    setUserJID(data.jid).then(() => {
                        resolve({
                            jid: data.jid,
                            password: data.password
                        });
                    });
                } else {
                    reject(new Error(`${xhr.status}: ${xhr.responseText}`));
                }
            };
            xhr.onerror = reject;
            /**
             * *Hook* which allows modifying the server request
             * @event _converse#beforeFetchLoginCredentials
             */
            xhr = await _converse.api.hook('beforeFetchLoginCredentials', this, xhr);
            xhr.send();
        }, wait)
    );
}

export async function attemptNonPreboundSession (credentials, automatic) {
    const { api } = _converse;
    if (api.settings.get("authentication") === _converse.LOGIN) {
        // XXX: If EITHER ``keepalive`` or ``auto_login`` is ``true`` and
        // ``authentication`` is set to ``login``, then Converse will try to log the user in,
        // since we don't have a way to distinguish between wether we're
        // restoring a previous session (``keepalive``) or whether we're
        // automatically setting up a new session (``auto_login``).
        // So we can't do the check (!automatic || _converse.api.settings.get("auto_login")) here.
        if (credentials) {
            connect(credentials);
        } else if (api.settings.get("credentials_url")) {
            // We give credentials_url preference, because
            // _converse.connection.pass might be an expired token.
            connect(await getLoginCredentials());
        } else if (_converse.jid && (api.settings.get("password") || _converse.connection.pass)) {
            connect();
        } else if (!_converse.isTestEnv() && 'credentials' in navigator) {
            connect(await getLoginCredentialsFromBrowser());
        } else {
            !_converse.isTestEnv() && log.warn("attemptNonPreboundSession: Couldn't find credentials to log in with");
        }
    } else if (
        [_converse.ANONYMOUS, _converse.EXTERNAL].includes(api.settings.get("authentication")) &&
        (!automatic || api.settings.get("auto_login"))
    ) {
        connect();
    }
}


export function getConnectionServiceURL () {
    const { api } = _converse;
    if (('WebSocket' in window || 'MozWebSocket' in window) && api.settings.get("websocket_url")) {
        return api.settings.get('websocket_url');
    } else if (api.settings.get('bosh_service_url')) {
        return api.settings.get('bosh_service_url');
    }
    return '';
}


function connect (credentials) {
    const { api } = _converse;
    if ([_converse.ANONYMOUS, _converse.EXTERNAL].includes(api.settings.get("authentication"))) {
        if (!_converse.jid) {
            throw new Error("Config Error: when using anonymous login " +
                "you need to provide the server's domain via the 'jid' option. " +
                "Either when calling converse.initialize, or when calling " +
                "_converse.api.user.login.");
        }
        if (!_converse.connection.reconnecting) {
            _converse.connection.reset();
        }
        _converse.connection.connect(_converse.jid.toLowerCase());
    } else if (api.settings.get("authentication") === _converse.LOGIN) {
        const password = credentials?.password ?? (_converse.connection?.pass || api.settings.get("password"));
        if (!password) {
            if (api.settings.get("auto_login")) {
                throw new Error("autoLogin: If you use auto_login and "+
                    "authentication='login' then you also need to provide a password.");
            }
            _converse.connection.setDisconnectionCause(Strophe.Status.AUTHFAIL, undefined, true);
            api.connection.disconnect();
            return;
        }
        if (!_converse.connection.reconnecting) {
            _converse.connection.reset();
            _converse.connection.service = getConnectionServiceURL();
        }
        _converse.connection.connect(_converse.jid, password);
    }
}
