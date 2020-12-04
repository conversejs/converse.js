import { _converse, api, converse } from '@converse/headless/core';

const { dayjs } = converse.env;

/**
 * Mixin which turns a ChatBox model into a ControlBox model.
 *
 * The ControlBox is the section of the chat that contains the open groupchats,
 * bookmarks and roster.
 *
 * In `overlayed` `view_mode` it's a box like the chat boxes, in `fullscreen`
 * `view_mode` it's a left-aligned sidebar.
 * @mixin
 */
const ControlBoxMixin = {
    defaults () {
        return {
            'bookmarked': false,
            'box_id': 'controlbox',
            'chat_state': undefined,
            'closed': !api.settings.get('show_controlbox_by_default'),
            'num_unread': 0,
            'time_opened': this.get('time_opened') || new Date().getTime(),
            'type': _converse.CONTROLBOX_TYPE,
            'url': ''
        };
    },

    initialize () {
        if (this.get('id') === 'controlbox') {
            this.set({ 'time_opened': dayjs(0).valueOf() });
        } else {
            _converse.ChatBox.prototype.initialize.apply(this, arguments);
        }
    },

    validate (attrs) {
        if (attrs.type === _converse.CONTROLBOX_TYPE) {
            if (api.settings.get('view_mode') === 'embedded' && api.settings.get('singleton')) {
                return 'Controlbox not relevant in embedded view mode';
            }
            return;
        }
        return _converse.ChatBox.prototype.validate.call(this, attrs);
    },

    maybeShow (force) {
        if (!force && this.get('id') === 'controlbox') {
            // Must return the chatbox
            return this;
        }
        return _converse.ChatBox.prototype.maybeShow.call(this, force);
    },

    onReconnection: function onReconnection () {}
};

export default ControlBoxMixin;
