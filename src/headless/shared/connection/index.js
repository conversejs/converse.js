import debounce from 'lodash-es/debounce';
import log from "../../log.js";
import sizzle from 'sizzle';
import _converse from '../_converse.js';
import { ANONYMOUS, BOSH_WAIT, LOGOUT } from '../../shared/constants.js';
import { CONNECTION_STATUS } from '../constants';
import { Strophe } from 'strophe.js';
import { clearSession, tearDown } from "../../utils/session.js";
import { getOpenPromise } from '@converse/openpromise';
import { setUserJID, } from '../../utils/init.js';

const i = Object.keys(Strophe.Status).reduce((max, k) => Math.max(max, Strophe.Status[k]), 0);
Strophe.Status.RECONNECTING = i + 1;


/**
 * The Connection class manages the connection to the XMPP server. It's
 * agnostic concerning the underlying protocol (i.e. websocket, long-polling
 * via BOSH or websocket inside a shared worker).
 */
export class Connection extends Strophe.Connection {

    constructor (service, options) {
        super(service, options);
        // For new sessions, we need to send out a presence stanza to notify
        // the server/network that we're online.
        // When re-attaching to an existing session we don't need to again send out a presence stanza,
        // because it's as if "we never left" (see onConnectStatusChanged).
        this.send_initial_presence = true;
        this.debouncedReconnect = debounce(this.reconnect, 3000);
    }

    /** @param {Element} body */
    xmlInput (body) {
        log.debug(body.outerHTML, 'color: darkgoldenrod');
    }

    /** @param {Element} body */
    xmlOutput (body) {
        log.debug(body.outerHTML, 'color: darkcyan');
    }

    async bind () {
        const { api } = _converse;
        /**
         * Synchronous event triggered before we send an IQ to bind the user's
         * JID resource for this session.
         * @event _converse#beforeResourceBinding
         */
        await api.trigger('beforeResourceBinding', {'synchronous': true});
        super.bind();
    }

    async onDomainDiscovered (response) {
        const { api } = _converse;
        const text = await response.text();
        const xrd = (new DOMParser()).parseFromString(text, "text/xml").firstElementChild;
        if (xrd.nodeName != "XRD" || xrd.namespaceURI != "http://docs.oasis-open.org/ns/xri/xrd-1.0") {
            return log.info("Could not discover XEP-0156 connection methods");
        }
        const bosh_links = sizzle(`Link[rel="urn:xmpp:alt-connections:xbosh"]`, xrd);
        const ws_links = sizzle(`Link[rel="urn:xmpp:alt-connections:websocket"]`, xrd);
        const bosh_methods = bosh_links.map(el => el.getAttribute('href')).filter(uri => uri.startsWith('https:'));
        const ws_methods = ws_links.map(el => el.getAttribute('href')).filter(uri => uri.startsWith('wss:'));
        if (bosh_methods.length === 0 && ws_methods.length === 0) {
            log.info("Neither BOSH nor WebSocket connection methods have been specified with XEP-0156.");
        } else {
            // TODO: support multiple endpoints
            api.settings.set("websocket_url", ws_methods.pop());
            api.settings.set('bosh_service_url', bosh_methods.pop());
            this.service = api.settings.get("websocket_url") || api.settings.get('bosh_service_url');
            this.setProtocol();
        }
    }

    /**
     * Adds support for XEP-0156 by quering the XMPP server for alternate
     * connection methods. This allows users to use the websocket or BOSH
     * connection of their own XMPP server instead of a proxy provided by the
     * host of Converse.js.
     * @method Connnection.discoverConnectionMethods
     * @param {string} domain
     */
    async discoverConnectionMethods (domain) {
        // Use XEP-0156 to check whether this host advertises websocket or BOSH connection methods.
        const options = {
            'mode': /** @type {RequestMode} */('cors'),
            'headers': {
                'Accept': 'application/xrd+xml, text/xml'
            }
        };
        const url = `https://${domain}/.well-known/host-meta`;
        let response;
        try {
            response = await fetch(url, options);
        } catch (e) {
            log.error(`Failed to discover alternative connection methods at ${url}`);
            log.error(e);
            return;
        }
        if (response.status >= 200 && response.status < 400) {
            await this.onDomainDiscovered(response);
        } else {
            log.info("Could not discover XEP-0156 connection methods");
        }
    }

    /**
     * Establish a new XMPP session by logging in with the supplied JID and
     * password.
     * @method Connnection.connect
     * @param {String} jid
     * @param {String} password
     * @param {Function} callback
     */
    async connect (jid, password, callback) {
        const { api } = _converse;

        if (api.settings.get("discover_connection_methods")) {
            const domain = Strophe.getDomainFromJid(jid);
            await this.discoverConnectionMethods(domain);
        }
        if (!api.settings.get('bosh_service_url') && !api.settings.get("websocket_url")) {
            // If we don't have a connection URL, we show an input for the user
            // to manually provide it.
            api.settings.set('show_connection_url_input', true);
        }
        super.connect(jid, password, callback || this.onConnectStatusChanged, BOSH_WAIT);
    }

    /**
     * @param {string} reason
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
    async switchTransport () {
        const { api } = _converse;

        const bare_jid = _converse.session.get('bare_jid');
        if (api.connection.isType('websocket') && api.settings.get('bosh_service_url')) {
            await setUserJID(bare_jid);
            this._proto._doDisconnect();
            this._proto = new Strophe.Bosh(this);
            this.service = api.settings.get('bosh_service_url');
        } else if (api.connection.isType('bosh') && api.settings.get("websocket_url")) {
            if (api.settings.get("authentication") === ANONYMOUS) {
                // When reconnecting anonymously, we need to connect with only
                // the domain, not the full JID that we had in our previous
                // (now failed) session.
                await setUserJID(api.settings.get("jid"));
            } else {
                await setUserJID(bare_jid);
            }
            this._proto._doDisconnect();
            this._proto = new Strophe.Websocket(this);
            this.service = api.settings.get("websocket_url");
        }
    }

    async reconnect () {
        const { api } = _converse;

        log.debug('RECONNECTING: the connection has dropped, attempting to reconnect.');
        this.reconnecting = true;
        await tearDown(_converse);

        const conn_status = _converse.state.connfeedback.get('connection_status');
        if (conn_status === Strophe.Status.CONNFAIL) {
            this.switchTransport();
        } else if (conn_status === Strophe.Status.AUTHFAIL && api.settings.get("authentication") === ANONYMOUS) {
            // When reconnecting anonymously, we need to connect with only
            // the domain, not the full JID that we had in our previous
            // (now failed) session.
            await setUserJID(api.settings.get("jid"));
        }

        /**
         * Triggered when the connection has dropped, but Converse will attempt
         * to reconnect again.
         * @event _converse#will-reconnect
         */
        api.trigger('will-reconnect');

        if (api.settings.get("authentication") === ANONYMOUS) {
            await clearSession(_converse);
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
    async onConnected (reconnecting) {
        const { api } = _converse;

        delete this.reconnecting;
        this.flush(); // Solves problem of returned PubSub BOSH response not received by browser
        await setUserJID(this.jid);

        // Save the current JID in persistent storage so that we can attempt to
        // recreate the session from SCRAM keys
        if (_converse.state.config.get('trusted')) {
            const bare_jid = _converse.session.get('bare_jid');
            localStorage.setItem('conversejs-session-jid', bare_jid);
        }

        /**
         * Synchronous event triggered after we've sent an IQ to bind the
         * user's JID resource for this session.
         * @event _converse#afterResourceBinding
         */
        await api.trigger('afterResourceBinding', reconnecting, {'synchronous': true});

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
     * @method Connection.setDisconnectionCause
     * @param {Number|'logout'} [cause] - The status number as received from Strophe.
     * @param {String} [reason] - An optional user-facing message as to why
     *  there was a disconnection.
     * @param {Boolean} [override] - An optional flag to replace any previous
     *  disconnection cause and reason.
     */
    setDisconnectionCause (cause, reason, override) {
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
    setConnectionStatus (status, message) {
        this.status = status;
        _converse.state.connfeedback.set({'connection_status': status, message });
    }

    async finishDisconnection () {
        const { api } = _converse;
        // Properly tear down the session so that it's possible to manually connect again.
        log.debug('DISCONNECTED');
        delete this.reconnecting;
        this.reset();
        tearDown(_converse);
        await clearSession(_converse);
        api.connection.destroy();

        /**
        * Triggered after converse.js has disconnected from the XMPP server.
        * @event _converse#disconnected
        * @memberOf _converse
        * @example _converse.api.listen.on('disconnected', () => { ... });
        */
        api.trigger('disconnected');
    }

    /**
     * Gets called once strophe's status reaches Strophe.Status.DISCONNECTED.
     * Will either start a teardown process for converse.js or attempt
     * to reconnect.
     * @method onDisconnected
     */
    onDisconnected () {
        const { api } = _converse;
        if (api.settings.get("auto_reconnect")) {
            const reason = this.disconnection_reason;
            if (this.disconnection_cause === Strophe.Status.AUTHFAIL) {
                if (api.settings.get("credentials_url") || api.settings.get("authentication") === ANONYMOUS) {
                    // If `credentials_url` is set, we reconnect, because we might
                    // be receiving expirable tokens from the credentials_url.
                    //
                    // If `authentication` is anonymous, we reconnect because we
                    // might have tried to attach with stale BOSH session tokens
                    // or with a cached JID and password
                    return api.connection.reconnect();
                } else {
                    return this.finishDisconnection();
                }
            } else if (this.status === Strophe.Status.CONNECTING) {
                // Don't try to reconnect if we were never connected to begin
                // with, otherwise an infinite loop can occur (e.g. when the
                // BOSH service URL returns a 404).
                const { __ } = _converse;
                this.setConnectionStatus(
                    Strophe.Status.CONNFAIL,
                    __('An error occurred while connecting to the chat server.')
                );
                return this.finishDisconnection();
            } else if (
                this.disconnection_cause === LOGOUT ||
                reason === Strophe.ErrorCondition.NO_AUTH_MECH ||
                reason === "host-unknown" ||
                reason === "remote-connection-failed"
            ) {
                return this.finishDisconnection();
            }
            api.connection.reconnect();
        } else {
            return this.finishDisconnection();
        }
    }

    /**
     * Callback method called by Strophe as the Connection goes
     * through various states while establishing or tearing down a
     * connection.
     * @param {Number} status
     * @param {String} message
     */
    onConnectStatusChanged (status, message) {
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
            if (this.reconnecting) {
                log.debug(status === Strophe.Status.CONNECTED ? 'Reconnected' : 'Reattached');
                this.onConnected(true);
            } else {
                log.debug(status === Strophe.Status.CONNECTED ? 'Connected' : 'Attached');
                if (this.restored) {
                    // No need to send an initial presence stanza when
                    // we're restoring an existing session.
                    this.send_initial_presence = false;
                }
                this.onConnected();
            }
        } else if (status === Strophe.Status.DISCONNECTED) {
            this.setDisconnectionCause(status, message);
            this.onDisconnected();
        } else if (status === Strophe.Status.BINDREQUIRED) {
            this.bind();
        } else if (status === Strophe.Status.ERROR) {
            this.setConnectionStatus(
                status,
                __('An error occurred while connecting to the chat server.')
            );
        } else if (status === Strophe.Status.CONNECTING) {
            this.setConnectionStatus(status);
        } else if (status === Strophe.Status.AUTHENTICATING) {
            this.setConnectionStatus(status);
        } else if (status === Strophe.Status.AUTHFAIL) {
            if (!message) {
                message = __('Your XMPP address and/or password is incorrect. Please try again.');
            }
            this.setConnectionStatus(status, message);
            this.setDisconnectionCause(status, message, true);
            this.onDisconnected();
        } else if (status === Strophe.Status.CONNFAIL) {
            let feedback = message;
            if (message === "host-unknown" || message == "remote-connection-failed") {
                feedback = __("Sorry, we could not connect to the XMPP host with domain: %1$s",
                    `\"${Strophe.getDomainFromJid(this.jid)}\"`);
            } else if (message !== undefined && message === Strophe?.ErrorCondition?.NO_AUTH_MECH) {
                feedback = __("The XMPP server did not offer a supported authentication mechanism");
            }
            this.setConnectionStatus(status, feedback);
            this.setDisconnectionCause(status, message);
        } else if (status === Strophe.Status.DISCONNECTING) {
            this.setDisconnectionCause(status, message);
        }
    }

    /**
     * @param {string} type
     */
    isType (type) {
        if (type.toLowerCase() === 'websocket') {
            return this._proto instanceof Strophe.Websocket;
        } else if (type.toLowerCase() === 'bosh') {
            return Strophe.Bosh && this._proto instanceof Strophe.Bosh;
        }
    }

    hasResumed () {
        const { api } = _converse;
        if (api.settings.get("connection_options")?.worker || this.isType('bosh')) {
            return _converse.state.connfeedback.get('connection_status') === Strophe.Status.ATTACHED;
        } else {
            // Not binding means that the session was resumed.
            return !this.do_bind;
        }
    }

    restoreWorkerSession () {
        this.attach(this.onConnectStatusChanged);
        this.worker_attach_promise = getOpenPromise();
        return this.worker_attach_promise;
    }
}


/**
 * The MockConnection class is used during testing, to mock an XMPP connection.
 * @class
 */
export class MockConnection extends Connection {

    /**
     * @param {string} service - The BOSH or WebSocket service URL.
     * @param {import('strophe.js/src/types/connection').ConnectionOptions} options - The configuration options
     */
    constructor (service, options) {
        super(service, options);

        this.sent_stanzas = [];
        this.IQ_stanzas = [];
        this.IQ_ids = [];

        this.features = Strophe.xmlHtmlNode(
            '<stream:features xmlns:stream="http://etherx.jabber.org/streams" xmlns="jabber:client">'+
                '<ver xmlns="urn:xmpp:features:rosterver"/>'+
                '<csi xmlns="urn:xmpp:csi:0"/>'+
                '<this xmlns="http://jabber.org/protocol/caps" ver="UwBpfJpEt3IoLYfWma/o/p3FFRo=" hash="sha-1" node="http://prosody.im"/>'+
                '<bind xmlns="urn:ietf:params:xml:ns:xmpp-bind">'+
                    '<required/>'+
                '</bind>'+
                `<sm xmlns='urn:xmpp:sm:3'/>`+
                '<session xmlns="urn:ietf:params:xml:ns:xmpp-session">'+
                    '<optional/>'+
                '</session>'+
            '</stream:features>').firstElementChild;

        // @ts-ignore
        this._proto._processRequest = () => {};
        this._proto._disconnect = () => this._onDisconnectTimeout();
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        this._proto._onDisconnectTimeout = () => {};
        this._proto._connect = () => {
            this.connected = true;
            this.mock = true;
            this.jid = 'romeo@montague.lit/orchard';
            this._changeConnectStatus(Strophe.Status.BINDREQUIRED);
        }
    }

    _processRequest () { // eslint-disable-line class-methods-use-this
        // Don't attempt to send out stanzas
    }

    sendIQ (iq, callback, errback) {
        iq = iq.tree?.() ?? iq;

        this.IQ_stanzas.push(iq);
        const id = super.sendIQ(iq, callback, errback);
        this.IQ_ids.push(id);
        return id;
    }

    send (stanza) {
        stanza = stanza.tree?.() ?? stanza;
        this.sent_stanzas.push(stanza);
        return super.send(stanza);
    }

    async bind () {
        const { api } = _converse;
        await api.trigger('beforeResourceBinding', {'synchronous': true});
        this.authenticated = true;
        this._changeConnectStatus(Strophe.Status.CONNECTED);
    }
}
