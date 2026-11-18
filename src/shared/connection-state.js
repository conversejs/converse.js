/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description What the UI shows of the connection.
 */
import { _converse, api, converse } from '@converse/headless';

const { Strophe } = converse.env;

/**
 * - `connected`: there's a working connection.
 * - `connecting`: an attempt to connect is underway.
 * - `offline`: there's no connection, and no attempt underway. Either
 *   Converse is waiting to retry, or the browser reports that there's no
 *   network, in which case a connection that hasn't timed out yet doesn't count.
 * @returns {import('./types').ConnectionState}
 */
export function getConnectionState() {
    if (navigator.onLine === false) return 'offline';

    const { CONNECTED, ATTACHED, CONNECTING, AUTHENTICATING } = Strophe.Status;
    const status = _converse.state.connfeedback?.get('connection_status');
    if (status === CONNECTED || status === ATTACHED) {
        return api.connection.authenticated() ? 'connected' : 'connecting';
    }
    return status === CONNECTING || status === AUTHENTICATING ? 'connecting' : 'offline';
}

/**
 * Whether logging in is underway, so that a spinner is shown rather than the login form.
 * That includes start-up, while Converse resumes a session or looks for
 * credentials, before it starts to connect.
 * @returns {boolean}
 */
export function isLoggingIn() {
    if (!_converse.promises.initialized?.isResolved) return true;

    const { CONNECTED, CONNECTING, AUTHENTICATING, RECONNECTING } = Strophe.Status;
    const status = _converse.state.connfeedback?.get('connection_status');
    return [CONNECTED, CONNECTING, AUTHENTICATING, RECONNECTING].includes(status);
}

/**
 * Keeps a component up to date with the connection, by updating it whenever
 * the connection's state may have changed.
 *
 * @example
 *  this.connection_state = new ConnectionStateController(this);
 *  // In the template
 *  this.connection_state.state === 'offline'
 */
export class ConnectionStateController {
    /**
     * @param {import('lit').ReactiveControllerHost} host
     */
    constructor(host) {
        this.host = host;
        this.update = () => this.host.requestUpdate();
        host.addController(this);
    }

    hostConnected() {
        this.connfeedback = _converse.state.connfeedback;
        this.connfeedback?.on('change:connection_status', this.update);
        // The browser knows that the network is gone before the connection times out.
        window.addEventListener('online', this.update);
        window.addEventListener('offline', this.update);
    }

    hostDisconnected() {
        this.connfeedback?.off('change:connection_status', this.update);
        window.removeEventListener('online', this.update);
        window.removeEventListener('offline', this.update);
    }

    /** @returns {import('./types').ConnectionState} */
    get state() {
        return getConnectionState();
    }

    /** @returns {boolean} */
    get is_online() {
        return this.state === 'connected';
    }
}
