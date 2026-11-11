import log from '@converse/log';
import sizzle from '#sizzle';
import _converse from '../_converse.js';
import { ANONYMOUS, BOSH_WAIT, LOGOUT } from '../../shared/constants.js';
import { CONNECTION_STATUS } from '../constants.js';
import { MemoryStorageBackend, Strophe } from 'strophe.js';
import { clearSession, endSession, tearDown } from '../../utils/session.js';
import { getOpenPromise } from '@converse/openpromise';
import { setUserJID } from '../../utils/init.js';
import { rememberSession } from '../../utils/remembered-session.js';

const RETRY_BASE_DELAY = 3000;
const RETRY_MAX_DELAY = 60000;

/**
 * Whether an authentication failure means that the server rejected the
 * credentials, rather than that authenticating failed for now
 * (`temporary-auth-failure`) or that binding a resource failed.
 * @param {Element} [elem] - What Strophe reported the failure with.
 * @returns {boolean}
 */
function isCredentialRejection(elem) {
    // Strophe reports a failure without an element when it gives up on SCRAM
    // itself, for example because the stored keys no longer match the
    // server's, or the server's signature doesn't verify. Retrying won't help.
    if (!elem) return true;

    if (elem.namespaceURI !== Strophe.NS.SASL || elem.localName !== 'failure') return false;

    return !Array.from(elem.children).some((c) => c.localName === 'temporary-auth-failure');
}

/**
 * The Connection class manages the connection to the XMPP server. It's
 * agnostic concerning the underlying protocol (i.e. websocket, long-polling
 * via BOSH or websocket inside a shared worker).
 */
export class Connection extends /** @type {import('../types').StropheConnectionConstructor} */ (Strophe.Connection) {
    // Set once this connection has been given up on. A later one replaces it.
    #finished = false;
    // How many retries have been scheduled since the connection last came up.
    #retries = 0;
    /** @type {ReturnType<typeof setTimeout>|null} */
    #retry_timer = null;
    // When the scheduled retry is due, in milliseconds since the epoch.
    #retry_at = 0;
    // Set while `reconnect()` gets ready to log in, before Strophe reports on it.
    #preparing_reconnect = false;
    // Set when an attempt fails, so that the next one uses the other transport.
    #switch_transport = false;
    // Whether the last authentication failure was the server rejecting the credentials.
    #credentials_rejected = false;
    // Set while an attempt that `retry()` started is underway.
    #retrying = false;

    /**
     * @param {string} service - The BOSH or WebSocket service URL.
     * @param {import('strophe.js').ConnectionOptions} options
     */
    constructor(service, options) {
        super(service, options);
        // For new sessions, we need to send out a presence stanza to notify
        // the server/network that we're online.
        // When re-attaching to an existing session we don't need to again send out a presence stanza,
        // because it's as if "we never left" (see onConnectStatusChanged).
        this.send_initial_presence = true;
        // Whether this connection has ever been established.
        this.has_connected = false;
        // The bare JID of the session that was loaded from the cache before
        // connecting, because it was remembered from an earlier start-up.
        // Such a session retries for as long as it's remembered.
        /** @type {string|null} */
        this.cached_jid = null;
    }

    /**
     * Reconnects straight away after losing a working connection. After a
     * failed attempt it waits instead, because Strophe still has a disconnect
     * pending which would tear down an attempt that's started straight away.
     *
     * @param {object} [options]
     * @param {boolean} [options.explicit] - Whether this was asked for, rather
     *  than being the response to a failed attempt. It then doesn't interrupt
     *  an attempt that's underway, and doesn't wait out a long backoff.
     */
    requestReconnect({ explicit = false } = {}) {
        if (explicit && this.#isReconnecting()) return;

        const wait =
            !!this.reconnecting ||
            this.status === Strophe.Status.CONNFAIL ||
            this.status === Strophe.Status.RECONNECTING;

        this.setConnectionStatus(Strophe.Status.RECONNECTING, 'The connection has dropped, attempting to reconnect.');
        if (!wait) return this.reconnect();
        return this.#scheduleReconnect(explicit ? RETRY_BASE_DELAY : RETRY_MAX_DELAY);
    }

    /**
     * Retries now, because whatever kept the connection from coming up has
     * gone away, for example the network is back. The waits between retries
     * start from the shortest again.
     *
     * A working connection is checked rather than replaced, since it may have
     * died unnoticed. An attempt that's underway is started anew, since it
     * most likely started while the network was down and may never finish,
     * unless this started it.
     * @returns {Promise<unknown>|void}
     */
    retry() {
        // Nothing to retry before logging in, for example while the login form is shown.
        if (!_converse.session.get('jid')) return;

        this.#retries = 0;
        const { CONNECTED, ATTACHED } = Strophe.Status;
        if ((this.status === CONNECTED || this.status === ATTACHED) && this.authenticated) {
            /**
             * Triggered when a working connection should be checked, because
             * it may have died unnoticed, for example while the network was
             * down. The ping plugin pings the server, which reconnects if
             * the ping times out.
             * @event _converse#checkConnection
             */
            return _converse.api.trigger('checkConnection');
        }
        // Getting ready to log in, so it hasn't tried the network yet.
        if (this.#preparing_reconnect) return;

        const attempting = this.status === Strophe.Status.CONNECTING || this.status === Strophe.Status.AUTHENTICATING;
        if (attempting && this.#retrying) return;

        this.#cancelScheduledReconnect();
        this.#retrying = true;
        if (attempting) {
            // An attempt that's underway hasn't failed, so there's no
            // disconnect pending that would tear down one started straight
            // away. It's dropped first, so that nothing of it carries over:
            // its socket or BOSH requests, and its handlers, such as those of
            // its SASL exchange. Strophe isn't asked to disconnect, since it
            // would report that as a failed attempt.
            this._proto._abortAllRequests();
            this._proto._doDisconnect();
            this.reset();
            return this.reconnect();
        }
        return this.requestReconnect({ explicit: true });
    }

    /**
     * Whether a reconnection attempt has started and hasn't succeeded or failed yet.
     * @returns {boolean}
     */
    #isReconnecting() {
        if (this.#preparing_reconnect) return true;
        if (!this.reconnecting) return false;
        return this.status === Strophe.Status.CONNECTING || this.status === Strophe.Status.AUTHENTICATING;
    }

    /**
     * Retries the connection after a delay, which doubles with each retry up
     * to {@link RETRY_MAX_DELAY}. While a retry is scheduled, further calls do
     * nothing, unless it's due later than `max_delay` from now, in which case
     * it's brought forward.
     * @param {number} [max_delay]
     */
    #scheduleReconnect(max_delay = RETRY_MAX_DELAY) {
        const is_scheduled = this.#retry_timer !== null;
        if (is_scheduled && this.#retry_at - Date.now() <= max_delay) return;

        this.#cancelScheduledReconnect();
        const delay = Math.min(RETRY_BASE_DELAY * 2 ** this.#retries, max_delay);
        if (!is_scheduled) this.#retries += 1;
        this.#retry_at = Date.now() + delay;
        this.#retry_timer = setTimeout(() => {
            this.#retry_timer = null;
            this.reconnect();
        }, delay);
    }

    #cancelScheduledReconnect() {
        if (this.#retry_timer !== null) clearTimeout(this.#retry_timer);
        this.#retry_timer = null;
    }

    /** @param {Element} body */
    xmlInput(body) {
        log.debug('%c%s', 'color: darkgoldenrod', body.outerHTML);
    }

    /** @param {Element} body */
    xmlOutput(body) {
        log.debug('%c%s', 'color: darkcyan', body.outerHTML);
    }

    async bind() {
        const { api } = _converse;
        /**
         * Synchronous event triggered before we send an IQ to bind the user's
         * JID resource for this session.
         * @event _converse#beforeResourceBinding
         */
        await api.trigger('beforeResourceBinding', { 'synchronous': true });
        super.bind();
    }

    async onDomainDiscovered(response) {
        const { api } = _converse;
        const text = await response.text();
        const xrd = new DOMParser().parseFromString(text, 'text/xml').firstElementChild;
        if (xrd.nodeName != 'XRD' || xrd.namespaceURI != 'http://docs.oasis-open.org/ns/xri/xrd-1.0') {
            return log.info('Could not discover XEP-0156 connection methods');
        }
        const bosh_links = sizzle(`Link[rel="urn:xmpp:alt-connections:xbosh"]`, xrd);
        const ws_links = sizzle(`Link[rel="urn:xmpp:alt-connections:websocket"]`, xrd);
        const bosh_methods = bosh_links.map((el) => el.getAttribute('href')).filter((uri) => uri.startsWith('https:'));
        const ws_methods = ws_links.map((el) => el.getAttribute('href')).filter((uri) => uri.startsWith('wss:'));
        if (bosh_methods.length === 0 && ws_methods.length === 0) {
            log.info('Neither BOSH nor WebSocket connection methods have been specified with XEP-0156.');
        } else {
            // TODO: support multiple endpoints
            api.settings.set('websocket_url', ws_methods.pop());
            api.settings.set('bosh_service_url', bosh_methods.pop());
            this.service = api.settings.get('websocket_url') || api.settings.get('bosh_service_url');
            this.setProtocol();
        }
    }

    /**
     * Adds support for XEP-0156 by querying the XMPP server for alternate
     * connection methods. This allows users to use the websocket or BOSH
     * connection of their own XMPP server instead of a proxy provided by the
     * host of Converse.js.
     * @method Connection.discoverConnectionMethods
     * @param {string} domain
     */
    async discoverConnectionMethods(domain) {
        // Use XEP-0156 to check whether this host advertises websocket or BOSH connection methods.
        const options = {
            mode: /** @type {RequestMode} */ ('cors'),
            headers: {
                Accept: 'application/xrd+xml, text/xml',
            },
        };
        const url = `https://${domain}/.well-known/host-meta`;
        let response;
        try {
            response = await fetch(url, options);
        } catch (e) {
            log.info(`Failed to discover alternative connection methods at ${url}`);
            log.error(e);
            return;
        }
        if (response.status >= 200 && response.status < 400) {
            await this.onDomainDiscovered(response);
        } else {
            log.info('Could not discover XEP-0156 connection methods');
        }
    }

    /**
     * Establish a new XMPP session by logging in with the supplied JID and
     * password.
     * @param {String} jid
     * @param {String} password
     * @param {import('strophe.js').ConnectCallback} [callback]
     */
    async connect(jid, password, callback) {
        const { __, api } = _converse;

        if (api.settings.get('discover_connection_methods')) {
            const domain = Strophe.getDomainFromJid(jid);
            await this.discoverConnectionMethods(domain);
        }
        if (!api.settings.get('bosh_service_url') && !api.settings.get('websocket_url')) {
            // If we don't have a connection URL, we show an input for the user
            // to manually provide it.
            api.settings.set('show_connection_url_input', true);
            (callback || this.onConnectStatusChanged.bind(this))(
                Strophe.Status.DISCONNECTED,
                __('Could not automatically determine a connection URL'),
            );
            return;
        }
        super.connect(jid, password, callback || this.onConnectStatusChanged, BOSH_WAIT);
    }

    /**
     * @param {string} [reason]
     */
    disconnect(reason) {
        super.disconnect(reason);
        this.send_initial_presence = true;
    }

    /**
     * Switch to a different transport if a service URL is available for it.
     *
     * When reconnecting with a new transport, we call setUserJID
     * so that a new resource is generated, to avoid multiple
     * server-side sessions with the same resource.
     *
     * We also call `_proto._doDisconnect` so that connection event handlers
     * for the old transport are removed.
     */
    async switchTransport() {
        const { api } = _converse;

        const bare_jid = _converse.session.get('bare_jid');
        if (api.connection.isType('websocket') && api.settings.get('bosh_service_url')) {
            await setUserJID(bare_jid);
            this._proto._doDisconnect();
            this._proto = new Strophe.Bosh(this);
            this.service = api.settings.get('bosh_service_url');
        } else if (api.connection.isType('bosh') && api.settings.get('websocket_url')) {
            if (api.settings.get('authentication') === ANONYMOUS) {
                // When reconnecting anonymously, we need to connect with only
                // the domain, not the full JID that we had in our previous
                // (now failed) session.
                await setUserJID(api.settings.get('jid'));
            } else {
                await setUserJID(bare_jid);
            }
            this._proto._doDisconnect();
            this._proto = new Strophe.Websocket(this);
            this.service = api.settings.get('websocket_url');
        }
    }

    async reconnect() {
        this.#preparing_reconnect = true;
        try {
            return await this.#prepareAndLogIn();
        } finally {
            this.#preparing_reconnect = false;
        }
    }

    async #prepareAndLogIn() {
        const { api } = _converse;

        log.debug('RECONNECTING: the connection has dropped, attempting to reconnect.');
        this.reconnecting = true;
        await tearDown(_converse);
        if (this.#finished) return;

        const conn_status = _converse.state.connfeedback.get('connection_status');
        if (this.#switch_transport) {
            this.#switch_transport = false;
            await this.switchTransport();
        } else if (conn_status === Strophe.Status.AUTHFAIL && api.settings.get('authentication') === ANONYMOUS) {
            // When reconnecting anonymously, we need to connect with only
            // the domain, not the full JID that we had in our previous
            // (now failed) session.
            await setUserJID(api.settings.get('jid'));
        }
        if (this.#finished) return;

        /**
         * Triggered when the connection has dropped, but Converse will attempt
         * to reconnect again.
         * @event _converse#will-reconnect
         */
        api.trigger('will-reconnect');

        if (api.settings.get('authentication') === ANONYMOUS) {
            await clearSession(_converse);
            if (this.#finished) return;
        }
        const jid = _converse.session.get('jid');
        return api.user.login(jid);
    }

    /**
     * Called as soon as a new connection has been established, either
     * by logging in or by attaching to an existing BOSH session.
     * @method Connection.onConnected
     * @param {Boolean} [reconnecting] - Whether Converse.js reconnected from an earlier dropped session.
     */
    async onConnected(reconnecting) {
        const { api } = _converse;

        delete this.reconnecting;
        if (this.isType('bosh')) {
            // Solves problem of returned PubSub BOSH response not received by browser
            this.flush();
        }

        await setUserJID(this.jid);

        // Save the current JID in persistent storage so that we can attempt to
        // recreate the session from SCRAM keys
        if (_converse.state.config.get('trusted')) {
            await rememberSession(_converse.session.get('bare_jid'));
        }

        /**
         * Synchronous event triggered after we've sent an IQ to bind the
         * user's JID resource for this session.
         * @event _converse#afterResourceBinding
         */
        await api.trigger('afterResourceBinding', reconnecting, { 'synchronous': true });

        if (reconnecting) {
            /**
             * After the connection has dropped and converse.js has reconnected.
             * Any Strophe stanza handlers (as registered via `converse.listen.stanza`) will
             * have to be registered anew.
             * @event _converse#reconnected
             * @example _converse.api.listen.on('reconnected', () => { ... });
             */
            api.trigger('reconnected');
        } else {
            /**
             * Triggered after the connection has been established and Converse
             * has got all its ducks in a row.
             * @event _converse#initialized
             */
            api.trigger('connected');
        }
    }

    /**
     * Used to keep track of why we got disconnected, so that we can
     * decide on what the next appropriate action is (in onDisconnected)
     * @param {Number|'logout'} [cause] - The status number as received from Strophe.
     * @param {String} [reason] - An optional user-facing message as to why
     *  there was a disconnection.
     * @param {Boolean} [override] - An optional flag to replace any previous
     *  disconnection cause and reason.
     */
    setDisconnectionCause(cause, reason, override) {
        if (cause === undefined) {
            delete this.disconnection_cause;
            delete this.disconnection_reason;
        } else if (this.disconnection_cause === undefined || override) {
            this.disconnection_cause = cause;
            this.disconnection_reason = reason;
        }
    }

    /**
     * @param {Number} [status] - The status number as received from Strophe.
     * @param {String} [message] - An optional user-facing message
     */
    setConnectionStatus(status, message) {
        this.status = status;
        const { CONNECTING, AUTHENTICATING, RECONNECTING } = Strophe.Status;
        if (status !== CONNECTING && status !== AUTHENTICATING && status !== RECONNECTING) {
            // The attempt that `retry()` started has succeeded or failed.
            this.#retrying = false;
        }
        _converse.state.connfeedback.set({ connection_status: status, message });
    }

    async finishDisconnection() {
        this.#finished = true;
        this.#cancelScheduledReconnect();
        this.setConnectionStatus(Strophe.Status.DISCONNECTED, this.disconnection_reason);
        const { api } = _converse;
        // Properly tear down the session so that it's possible to manually connect again.
        log.debug('DISCONNECTED');
        delete this.reconnecting;
        this.reset();
        tearDown(_converse);
        await clearSession(_converse);
        // The server rejected the credentials of a session that was resumed,
        // or there are none left to log in with, so it ends as if the user
        // had logged out.
        const ends = !!this.cached_jid && this.disconnection_cause === Strophe.Status.AUTHFAIL;
        api.connection.destroy();

        /**
         * Triggered after converse.js has disconnected from the XMPP server.
         * @event _converse#disconnected
         * @memberOf _converse
         * @example _converse.api.listen.on('disconnected', () => { ... });
         */
        api.trigger('disconnected');
        if (ends) await endSession(_converse);
    }

    /**
     * Whether to stop trying a connection that was never established, so that
     * for example a wrong address is reported instead of being retried forever.
     * One retry is still made after a failure, since it may use the other transport.
     * @returns {boolean}
     */
    #shouldGiveUp() {
        const { api } = _converse;
        if (this.has_connected || this.cached_jid || api.settings.get('retry_initial_connection')) return false;

        return this.status === Strophe.Status.CONNECTING || !!this.reconnecting;
    }

    /**
     * Whether the reason for this disconnection is one that retrying can't fix.
     * @returns {boolean}
     */
    #isUnrecoverable() {
        const reason = this.disconnection_reason;
        if (reason === 'remote-connection-failed') {
            // A gateway reports this while its XMPP server is down, which
            // `retry_initial_connection` and a resumed session wait out.
            if (this.cached_jid) return false;
            return this.has_connected || !_converse.api.settings.get('retry_initial_connection');
        }
        return (
            this.disconnection_cause === LOGOUT ||
            reason === Strophe.ErrorCondition.NO_AUTH_MECH ||
            reason === 'host-unknown' ||
            reason === 'not-well-formed'
        );
    }

    /**
     * Gets called once strophe's status reaches Strophe.Status.DISCONNECTED.
     * Will either start a teardown process for converse.js or attempt
     * to reconnect.
     * @method onDisconnected
     */
    onDisconnected() {
        // Strophe can report a failed attempt as disconnected more than once.
        if (this.#finished) return;

        // The attempt that `retry()` started, if any, has ended.
        this.#retrying = false;

        const { api } = _converse;
        if (api.settings.get('auto_reconnect')) {
            if (this.disconnection_cause === Strophe.Status.AUTHFAIL) {
                if (api.settings.get('credentials_url') || api.settings.get('authentication') === ANONYMOUS) {
                    // If `credentials_url` is set, we reconnect, because we might
                    // be receiving expirable tokens from the credentials_url.
                    //
                    // If `authentication` is anonymous, we reconnect because we
                    // might have tried to attach with stale BOSH session tokens
                    // or with a cached JID and password
                    return this.requestReconnect();
                } else if (this.cached_jid && !this.#credentials_rejected) {
                    // A resumed session only ends when the server rejects its
                    // credentials, not when authenticating fails for now
                    // (`temporary-auth-failure`) or binding a resource fails.
                    return this.requestReconnect();
                } else {
                    return this.finishDisconnection();
                }
            } else if (this.#shouldGiveUp()) {
                const { __ } = _converse;
                this.setConnectionStatus(
                    Strophe.Status.CONNFAIL,
                    __('An error occurred while connecting to the chat server.'),
                );
                return this.finishDisconnection();
            } else if (this.#isUnrecoverable()) {
                return this.finishDisconnection();
            }
            this.requestReconnect();
        } else {
            return this.finishDisconnection();
        }
    }

    /**
     * Callback method called by Strophe as the Connection goes
     * through various states while establishing or tearing down a
     * connection.
     * @param {Number} status
     * @param {String} [condition]
     * @param {Element} [elem] - The stanza that caused the change, for example a SASL `<failure>`.
     */
    onConnectStatusChanged(status, condition, elem) {
        // Tearing down a connection that has been given up on still reports
        // on it, which would overwrite the reason it ended with.
        if (this.#finished) return;

        const { __ } = _converse;
        log.debug(`Status changed to: ${CONNECTION_STATUS[status]}`);
        if (status === Strophe.Status.ATTACHFAIL) {
            this.setConnectionStatus(status);
            this.worker_attach_promise?.resolve(false);
        } else if (status === Strophe.Status.CONNECTED || status === Strophe.Status.ATTACHED) {
            if (this.worker_attach_promise?.isResolved && this.status === Strophe.Status.ATTACHED) {
                // A different tab must have attached, so nothing to do for us here.
                return;
            }
            this.setConnectionStatus(status);
            this.worker_attach_promise?.resolve(true);

            this.setDisconnectionCause();
            if (this.restored) {
                // No need to send an initial presence stanza when
                // we're restoring an existing session (e.g. via SMACKS resume).
                this.send_initial_presence = false;
            }
            // A retry of a connection that never came up is still its first connection.
            const reconnected = this.reconnecting && this.has_connected;
            this.has_connected = true;
            this.#retries = 0;
            this.#cancelScheduledReconnect();
            if (reconnected) {
                log.debug(status === Strophe.Status.CONNECTED ? 'Reconnected' : 'Reattached');
                this.onConnected(true);
            } else {
                log.debug(status === Strophe.Status.CONNECTED ? 'Connected' : 'Attached');
                this.onConnected();
            }
        } else if (status === Strophe.Status.DISCONNECTED) {
            this.setDisconnectionCause(status, condition);
            this.onDisconnected();
        } else if (status === Strophe.Status.BINDREQUIRED) {
            this.bind();
        } else if (status === Strophe.Status.ERROR) {
            this.setConnectionStatus(status, __('An error occurred while connecting to the chat server.'));
        } else if (status === Strophe.Status.CONNECTING) {
            this.setConnectionStatus(status);
        } else if (status === Strophe.Status.AUTHENTICATING) {
            this.setConnectionStatus(status);
        } else if (status === Strophe.Status.AUTHFAIL) {
            this.#credentials_rejected = isCredentialRejection(elem);
            if (!condition) {
                condition = __('Your XMPP address and/or password is incorrect. Please try again.');
            }
            this.setConnectionStatus(status, condition);
            this.setDisconnectionCause(status, condition, true);
            this.onDisconnected();
        } else if (status === Strophe.Status.CONNFAIL) {
            let feedback = condition;
            if (condition === 'host-unknown' || condition == 'remote-connection-failed') {
                feedback = __(
                    'We could not connect to %1$s, is your XMPP address correct?',
                    Strophe.getDomainFromJid(this.jid),
                );
            } else if (condition === 'policy-violation') {
                feedback = __('The XMPP server rejected the connection because of a policy violation');
            } else if (condition !== undefined && condition === Strophe?.ErrorCondition?.NO_AUTH_MECH) {
                feedback = __('The XMPP server did not offer a supported authentication mechanism');
            }
            this.setConnectionStatus(status, feedback);
            this.setDisconnectionCause(status, condition);
            this.#switch_transport = true;
        } else if (status === Strophe.Status.DISCONNECTING) {
            this.setConnectionStatus(status);
            this.setDisconnectionCause(status, condition);
        }
    }

    /**
     * @param {string} type
     */
    isType(type) {
        if (type.toLowerCase() === 'websocket') {
            return this._proto instanceof Strophe.Websocket;
        } else if (type.toLowerCase() === 'bosh') {
            return Strophe.Bosh && this._proto instanceof Strophe.Bosh;
        }
    }

    hasResumed() {
        const { api } = _converse;
        if (api.settings.get('connection_options')?.worker || this.isType('bosh')) {
            return _converse.state.connfeedback.get('connection_status') === Strophe.Status.ATTACHED;
        }
        // Strophe knows whether its XEP-0198 engine resumed the session.
        return super.hasResumed();
    }

    restoreWorkerSession() {
        this.attach(this.onConnectStatusChanged);
        this.worker_attach_promise = getOpenPromise();
        return this.worker_attach_promise;
    }
}

/**
 * The MockConnection class is used during testing, to mock an XMPP connection.
 */
export class MockConnection extends Connection {
    /**
     * @param {string} service - The BOSH or WebSocket service URL.
     * @param {import('strophe.js').ConnectionOptions} options - The configuration options
     */
    constructor(service, options) {
        super(service, {
            ...options,
            // Tests must not leak resumable XEP-0198 state into each other
            // via sessionStorage, so default to in-memory storage. A test
            // can still supply its own (pre-seeded) backend via
            // connection_options.streamManagement.storage.
            streamManagement: { storage: new MemoryStorageBackend(), ...options.streamManagement },
        });

        this.sent_stanzas = [];
        this.IQ_stanzas = [];
        this.IQ_ids = [];

        this.features = Strophe.xmlHtmlNode(
            '<stream:features xmlns:stream="http://etherx.jabber.org/streams" xmlns="jabber:client">' +
                '<ver xmlns="urn:xmpp:features:rosterver"/>' +
                '<csi xmlns="urn:xmpp:csi:0"/>' +
                '<this xmlns="http://jabber.org/protocol/caps" ver="UwBpfJpEt3IoLYfWma/o/p3FFRo=" hash="sha-1" node="http://prosody.im"/>' +
                '<bind xmlns="urn:ietf:params:xml:ns:xmpp-bind">' +
                '<required/>' +
                '</bind>' +
                `<sm xmlns='urn:xmpp:sm:3'/>` +
                '<session xmlns="urn:ietf:params:xml:ns:xmpp-session">' +
                '<optional/>' +
                '</session>' +
                '</stream:features>',
        ).firstElementChild;

        // @ts-expect-error Only the BOSH transport has _processRequest, but the mock stubs it out regardless
        this._proto._processRequest = () => {};
        // Record the unavailable presence that a graceful disconnect sends,
        // as a real transport would put it on the wire.
        this._proto._disconnect = (pres) => {
            if (pres) this.sent_stanzas.push(pres);
            this._onDisconnectTimeout();
        };
        this._proto._onDisconnectTimeout = () => {};

        // Drain the send queue synchronously into sent_stanzas: this
        // captures everything Strophe queues in wire order (stanzas as
        // well as the XEP-0198 nonzas that the SM engine pushes directly
        // onto _data).
        this._proto._send = () => {
            while (this._data.length) {
                const el = this._data.shift();
                if (typeof el !== 'string') this.sent_stanzas.push(el);
            }
        };
        this._proto._connect = () => {
            this.connected = true;
            this.mock = true;
            this.jid = 'romeo@montague.lit/orchard';
            // Feed the mock stream features through the same post-SASL
            // decision point the real connect flow uses. With Stream
            // Management enabled this is where Strophe chooses between
            // <resume/> and resource binding; without it, it proceeds
            // straight to binding (BINDREQUIRED, since Converse uses
            // explicitResourceBinding).
            this._onStreamFeaturesAfterSASL(this.features);
        };
    }

    /**
     * Strophe's `Connection._dataRecv` unwraps an injected request into its
     * stanza element via the transport's `_reqToData`, but only for BOSH; on
     * websocket it expects the element directly. Tests inject a Request-shaped
     * object on both transports (see `createRequest`), so unwrap it here for
     * the websocket case before Strophe processes it.
     * @param {any} req
     * @param {string} [raw]
     */
    _dataRecv(req, raw) {
        const elem = this._proto instanceof Strophe.Bosh ? req : (req?.getResponse?.() ?? req);
        return super._dataRecv(elem, raw);
    }

    /** @returns {InstanceType<typeof import('strophe.js').Strophe.SASLSHA256>} */
    // @ts-expect-error Overrides the _sasl_mechanism property with a getter
    get _sasl_mechanism() {
        return new Strophe.SASLSHA256();
    }

    _processRequest() {
        // Don't attempt to send out stanzas
    }

    sendIQ(iq, callback, errback, timeout) {
        iq = iq.tree?.() ?? iq;

        this.IQ_stanzas.push(iq);
        const id = super.sendIQ(iq, callback, errback, timeout);
        this.IQ_ids.push(id);
        return id;
    }

    send(stanza) {
        stanza = stanza.tree?.() ?? stanza;
        // No sent_stanzas.push here: the stanza lands there via the
        // _proto._send drain (see constructor), like all outbound traffic.
        return super.send(stanza);
    }

    async bind() {
        const { api } = _converse;
        await api.trigger('beforeResourceBinding', { 'synchronous': true });
        this.authenticated = true;
        // The real bind-result handler calls this before emitting
        // CONNECTED; with SM enabled it sends the native <enable/>.
        this._onSessionReady();
        this._changeConnectStatus(Strophe.Status.CONNECTED);
    }
}
