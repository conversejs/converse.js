import { Strophe } from 'strophe.js/src/strophe';

export const BOSH_WAIT = 59;

export const CONNECTION_STATUS = {};
CONNECTION_STATUS[Strophe.Status.ATTACHED] = 'ATTACHED';
CONNECTION_STATUS[Strophe.Status.AUTHENTICATING] = 'AUTHENTICATING';
CONNECTION_STATUS[Strophe.Status.AUTHFAIL] = 'AUTHFAIL';
CONNECTION_STATUS[Strophe.Status.CONNECTED] = 'CONNECTED';
CONNECTION_STATUS[Strophe.Status.CONNECTING] = 'CONNECTING';
CONNECTION_STATUS[Strophe.Status.CONNFAIL] = 'CONNFAIL';
CONNECTION_STATUS[Strophe.Status.DISCONNECTED] = 'DISCONNECTED';
CONNECTION_STATUS[Strophe.Status.DISCONNECTING] = 'DISCONNECTING';
CONNECTION_STATUS[Strophe.Status.ERROR] = 'ERROR';
CONNECTION_STATUS[Strophe.Status.RECONNECTING] = 'RECONNECTING';
CONNECTION_STATUS[Strophe.Status.REDIRECT] = 'REDIRECT';

// Core plugins are whitelisted automatically
// These are just the @converse/headless plugins, for the full converse,
// the other plugins are whitelisted in src/consts.js
export const CORE_PLUGINS = [
    'converse-adhoc',
    'converse-bookmarks',
    'converse-bosh',
    'converse-caps',
    'converse-carbons',
    'converse-chat',
    'converse-chatboxes',
    'converse-disco',
    'converse-emoji',
    'converse-headlines',
    'converse-mam',
    'converse-muc',
    'converse-ping',
    'converse-pubsub',
    'converse-roster',
    'converse-smacks',
    'converse-status',
    'converse-vcard'
];

export const URL_PARSE_OPTIONS = { 'start': /(\b|_)(?:([a-z][a-z0-9.+-]*:\/\/)|xmpp:|mailto:|www\.)/gi };
