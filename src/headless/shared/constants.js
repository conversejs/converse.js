import { Strophe } from 'strophe.js';

export const BOSH_WAIT = 59;
export const VERSION_NAME = "v11.0.0";

export const STATUS_WEIGHTS = {
    offline: 6,
    unavailable: 5,
    xa: 4,
    away: 3,
    dnd: 2,
    chat: 1, // We don't differentiate between "chat" and "online"
    online: 1,
};

export const METADATA_ATTRIBUTES = [
    "og:article:author",
    "og:article:published_time",
    "og:description",
    "og:image",
    "og:image:height",
    "og:image:width",
    "og:site_name",
    "og:title",
    "og:type",
    "og:url",
    "og:video:height",
    "og:video:secure_url",
    "og:video:tag",
    "og:video:type",
    "og:video:url",
    "og:video:width"
];

export const ANONYMOUS = 'anonymous';
export const CLOSED = 'closed';
export const EXTERNAL = 'external';
export const LOGIN = 'login';
export const LOGOUT = 'logout';
export const OPENED = 'opened';
export const PREBIND = 'prebind';
export const SUCCESS = 'success';
export const FAILURE = 'failure';

// XEP-0085 Chat states
// https =//xmpp.org/extensions/xep-0085.html
export const INACTIVE = 'inactive';
export const ACTIVE = 'active';
export const COMPOSING = 'composing';
export const PAUSED = 'paused';
export const GONE = 'gone';

// Chat types
export const PRIVATE_CHAT_TYPE = 'chatbox';
export const CHATROOMS_TYPE = 'chatroom';
export const HEADLINES_TYPE = 'headline';
export const CONTROLBOX_TYPE = 'controlbox';

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

// Add Strophe Namespaces
Strophe.addNamespace('ACTIVITY', 'http://jabber.org/protocol/activity');
Strophe.addNamespace('CARBONS', 'urn:xmpp:carbons:2');
Strophe.addNamespace('CHATSTATES', 'http://jabber.org/protocol/chatstates');
Strophe.addNamespace('CSI', 'urn:xmpp:csi:0');
Strophe.addNamespace('DELAY', 'urn:xmpp:delay');
Strophe.addNamespace('EME', 'urn:xmpp:eme:0');
Strophe.addNamespace('FALLBACK', 'urn:xmpp:fallback:0');
Strophe.addNamespace('FASTEN', 'urn:xmpp:fasten:0');
Strophe.addNamespace('FORWARD', 'urn:xmpp:forward:0');
Strophe.addNamespace('HINTS', 'urn:xmpp:hints');
Strophe.addNamespace('HTTPUPLOAD', 'urn:xmpp:http:upload:0');
Strophe.addNamespace('MAM', 'urn:xmpp:mam:2');
Strophe.addNamespace('MARKERS', 'urn:xmpp:chat-markers:0');
Strophe.addNamespace('MENTIONS', 'urn:xmpp:mmn:0');
Strophe.addNamespace('MESSAGE_CORRECT', 'urn:xmpp:message-correct:0');
Strophe.addNamespace('MODERATE', 'urn:xmpp:message-moderate:1');
Strophe.addNamespace('MODERATE0', 'urn:xmpp:message-moderate:0');
Strophe.addNamespace('NICK', 'http://jabber.org/protocol/nick');
Strophe.addNamespace('OCCUPANTID', 'urn:xmpp:occupant-id:0');
Strophe.addNamespace('OMEMO', 'eu.siacs.conversations.axolotl');
Strophe.addNamespace('OUTOFBAND', 'jabber:x:oob');
Strophe.addNamespace('PUBSUB', 'http://jabber.org/protocol/pubsub');
Strophe.addNamespace('RAI', 'urn:xmpp:rai:0');
Strophe.addNamespace('RECEIPTS', 'urn:xmpp:receipts');
Strophe.addNamespace('REFERENCE', 'urn:xmpp:reference:0');
Strophe.addNamespace('REGISTER', 'jabber:iq:register');
Strophe.addNamespace('RETRACT', 'urn:xmpp:message-retract:1');
Strophe.addNamespace('RETRACT0', 'urn:xmpp:message-retract:0');
Strophe.addNamespace('ROSTERX', 'http://jabber.org/protocol/rosterx');
Strophe.addNamespace('RSM', 'http://jabber.org/protocol/rsm');
Strophe.addNamespace('SID', 'urn:xmpp:sid:0');
Strophe.addNamespace('SPOILER', 'urn:xmpp:spoiler:0');
Strophe.addNamespace('STANZAS', 'urn:ietf:params:xml:ns:xmpp-stanzas');
Strophe.addNamespace('STYLING', 'urn:xmpp:styling:0');
Strophe.addNamespace('VCARD', 'vcard-temp');
Strophe.addNamespace('VCARDUPDATE', 'vcard-temp:x:update');
Strophe.addNamespace('XFORM', 'jabber:x:data');
Strophe.addNamespace('XHTML', 'http://www.w3.org/1999/xhtml');

// Core plugins are whitelisted automatically
// These are just the @converse/headless plugins, for the full converse,
// the other plugins are whitelisted in src/consts.js
export const CORE_PLUGINS = [
    'converse-adhoc',
    'converse-bookmarks',
    'converse-blocklist',
    'converse-bosh',
    'converse-caps',
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
    'converse-vcard',
];

export const URL_PARSE_OPTIONS = { 'start': /(\b|_)(?:([a-z][a-z0-9.+-]*:\/\/)|xmpp:|mailto:|www\.)/gi };

export const CHAT_STATES = ['active', 'composing', 'gone', 'inactive', 'paused'];

export const KEYCODES = {
    TAB: 9,
    ENTER: 13,
    SHIFT: 16,
    CTRL: 17,
    ALT: 18,
    ESCAPE: 27,
    LEFT_ARROW: 37,
    UP_ARROW: 38,
    RIGHT_ARROW: 39,
    DOWN_ARROW: 40,
    FORWARD_SLASH: 47,
    AT: 50,
    META: 91,
    META_RIGHT: 93,
};

export const XFORM_TYPE_MAP = {
    'text-private': 'password',
    'text-single': 'text',
    'fixed': 'label',
    'boolean': 'checkbox',
    'hidden': 'hidden',
    'jid-multi': 'textarea',
    'list-single': 'dropdown',
    'list-multi': 'dropdown'
};

export const XFORM_VALIDATE_TYPE_MAP = {
    'xs:anyURI': 'url',
    'xs:byte': 'number',
    'xs:date': 'date',
    'xs:dateTime': 'datetime',
    'xs:int': 'number',
    'xs:integer': 'number',
    'xs:time': 'time',
};
