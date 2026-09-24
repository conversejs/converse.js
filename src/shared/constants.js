import { __ } from 'i18n';

// These are all the view-layer plugins.
//
// For the full Converse build, this list serves
// as a whitelist (see src/converse.js) in addition to the
// CORE_PLUGINS list in src/headless/consts.js.
export const VIEW_PLUGINS = [
    'converse-adhoc-views',
    'converse-bookmark-views',
    'converse-app-chat',
    'converse-app-social',
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
    'converse-time-views',
    'converse-reaction-views',
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
    offline: __('Offline'),
    unavailable: __('Unavailable'),
    xa: __('Extended Away'),
    away: __('Away'),
    dnd: __('Do not disturb'),
    chat: __('Chatty'),
    online: __('Online'),
};

// The width in pixels below which a conversation takes up the whole page,
// one at a time. Below it the controlbox (250px) and one overlayed chat
// (300px) no longer fit beside each other, so the overlayed model has nothing
// left to lay out. This is Bootstrap's `sm` grid breakpoint, which is also
// where `$mobile_portrait_length` in shared/styles/_variables.scss puts the
// matching SCSS rules.
export const MOBILE_CUTOFF = 576;

// The height in pixels below which a conversation also takes up the whole
// page, for a phone held in landscape: wide enough for the overlayed model but
// too short to float a box in. `$mobile_landscape_height` in
// shared/styles/_variables.scss, where every full-page block is written twice,
// once against the width and once against this height.
export const MOBILE_LANDSCAPE_CUTOFF = 450;

// The width in pixels below which the controlbox alone takes up the whole
// page, so nothing can sit beside it. Bootstrap's `md` grid breakpoint, where
// `plugins/controlbox/styles/_controlbox.scss` gives `#controlbox` its
// `width: 100%`. Deliberately a separate name from the cutoff below even
// though they share a number: they answer different questions and either is
// free to move.
export const CONTROLBOX_FULLPAGE_CUTOFF = 768;

// The width in pixels below which there is no room for the MUC occupants list
// beside the chat, so it starts out hidden. Bootstrap's `md` grid breakpoint,
// which is also where the fullscreen rules give the chat only 8 of the 12
// columns (see plugins/chatview/styles/index.scss).
export const OCCUPANTS_SIDEBAR_CUTOFF = 768;

// Media queries for the cutoffs above, for the JS that has to make the same
// call the stylesheets do.
//
// The 0.02px is Bootstrap's. A `max-width` query has to stop just short of the
// breakpoint, or it overlaps the `min-width` query that starts there and both
// apply on the boundary pixel. There is no such offset on the height, which
// the stylesheets state inclusively. Use these rather than building a query
// from the bare constant, so that every caller states the boundary one way.
//
// As shipped these agree with the stylesheets, but the breakpoint is written in
// both places, so the agreement is a convention rather than something enforced:
// a theme overriding `$mobile_portrait_length`, or Bootstrap's
// `$grid-breakpoints`, moves the CSS and leaves these behind. The two have to be
// kept in step by hand.
//
// `MOBILE_MEDIA_QUERY` carries both halves of the full-page condition, because
// so do the stylesheets: a viewport can be short enough to go full-page while
// still being wide enough to float a box in. Asking only the width would leave
// inline geometry overriding the mobile rules on a landscape phone.
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_CUTOFF - 0.02}px), (max-height: ${MOBILE_LANDSCAPE_CUTOFF}px)`;
export const CONTROLBOX_FULLPAGE_MEDIA_QUERY = `(max-width: ${CONTROLBOX_FULLPAGE_CUTOFF - 0.02}px)`;
export const OCCUPANTS_SIDEBAR_MEDIA_QUERY = `(max-width: ${OCCUPANTS_SIDEBAR_CUTOFF - 0.02}px)`;
