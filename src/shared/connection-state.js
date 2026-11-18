/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description What the UI shows of the connection.
 */
import { _converse, converse } from '@converse/headless';

const { Strophe } = converse.env;

/**
 * Whether logging in is underway, so that a spinner is shown rather than the login form.
 * @returns {boolean}
 */
export function isLoggingIn() {
    const { CONNECTED, CONNECTING, AUTHENTICATING, RECONNECTING } = Strophe.Status;
    const status = _converse.state.connfeedback?.get('connection_status');
    return [CONNECTED, CONNECTING, AUTHENTICATING, RECONNECTING].includes(status);
}
