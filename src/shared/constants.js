import { __ } from 'i18n';

// These are all the view-layer plugins.
//
// For the full Converse build, this list serves
// as a whitelist (see src/converse.js) in addition to the
// CORE_PLUGINS list in src/headless/consts.js.
export const VIEW_PLUGINS = [
    'converse-adhoc-views',
    'converse-bookmark-views',
    'converse-chatboxviews',
    'converse-chatview',
    'converse-controlbox',
    'converse-disco-views',
    'converse-dragresize',
    'converse-fullscreen',
    'converse-headlines-view',
    'converse-mam-views',
    'converse-minimize',
    'converse-modal',
    'converse-muc-views',
    'converse-notification',
    'converse-omemo-views',
    'converse-profile',
    'converse-push',
    'converse-register',
    'converse-roomslist',
    'converse-rootview',
    'converse-rosterview',
    'converse-singleton',
    'converse-app-todo',
];

/**
 * @typedef {Object} PrettyChatStatus
 * @property {string} offline
 * @property {string} unavailable
 * @property {string} xa
 * @property {string} away
 * @property {string} dnd
 * @property {string} chatty
 * @property {string} online
 */
export const PRETTY_CHAT_STATUS = {
    offline:      __('Offline'),
    unavailable:  __('Unavailable'),
    xa:           __('Extended Away'),
    away:         __('Away'),
    dnd:          __('Do not disturb'),
    chat:         __('Chatty'),
    online:       __('Online')
};


// The width in pixels below which we're considered on a mobile device and
// above a desktop device.
export const MOBILE_CUTOFF = 768;
