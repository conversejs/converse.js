import { converse } from '@converse/headless';
import { __ } from 'i18n';

const { Strophe } = converse.env;

export const CONNECTION_STATUS_CSS_CLASS = Object.fromEntries([
   [Strophe.Status.ERROR, 'danger'],
   [Strophe.Status.CONNECTING, 'info'],
   [Strophe.Status.CONNFAIL, 'danger'],
   [Strophe.Status.AUTHENTICATING, 'info'],
   [Strophe.Status.AUTHFAIL, 'danger'],
   [Strophe.Status.CONNECTED, 'info'],
   [Strophe.Status.DISCONNECTED, 'danger'],
   [Strophe.Status.DISCONNECTING, 'warning'],
   [Strophe.Status.ATTACHED, 'info'],
   [Strophe.Status.REDIRECT, 'info'],
   [Strophe.Status.RECONNECTING, 'warning'],
]);
