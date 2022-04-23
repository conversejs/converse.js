import { converse } from '@converse/headless/core.js';

const { Strophe } = converse.env;

export const REPORTABLE_STATUSES = [
    Strophe.Status.ERROR,
    Strophe.Status.CONNECTING,
    Strophe.Status.CONNFAIL,
    Strophe.Status.AUTHENTICATING,
    Strophe.Status.AUTHFAIL,
    Strophe.Status.DISCONNECTING,
    Strophe.Status.RECONNECTING,
];

export const PRETTY_CONNECTION_STATUS = Object.fromEntries([
    [Strophe.Status.ERROR, 'Error'],
    [Strophe.Status.CONNECTING, 'Connecting'],
    [Strophe.Status.CONNFAIL, 'Connection failure'],
    [Strophe.Status.AUTHENTICATING, 'Authenticating'],
    [Strophe.Status.AUTHFAIL, 'Authentication failure'],
    [Strophe.Status.CONNECTED, 'Connected'],
    [Strophe.Status.DISCONNECTED, 'Disconnected'],
    [Strophe.Status.DISCONNECTING, 'Disconnecting'],
    [Strophe.Status.ATTACHED, 'Attached'],
    [Strophe.Status.REDIRECT, 'Redirect'],
    [Strophe.Status.CONNTIMEOUT, 'Connection timeout'],
    [Strophe.Status.RECONNECTING, 'Reconnecting'],
]);

export const CONNECTION_STATUS_CSS_CLASS = Object.fromEntries([
   [Strophe.Status.ERROR, 'error'],
   [Strophe.Status.CONNECTING, 'info'],
   [Strophe.Status.CONNFAIL, 'error'],
   [Strophe.Status.AUTHENTICATING, 'info'],
   [Strophe.Status.AUTHFAIL, 'error'],
   [Strophe.Status.CONNECTED, 'info'],
   [Strophe.Status.DISCONNECTED, 'error'],
   [Strophe.Status.DISCONNECTING, 'warn'],
   [Strophe.Status.ATTACHED, 'info'],
   [Strophe.Status.REDIRECT, 'info'],
   [Strophe.Status.RECONNECTING, 'warn'],
]);
