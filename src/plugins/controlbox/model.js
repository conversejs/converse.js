import { _converse, api, converse } from '@converse/headless/core';
import { Model } from '@converse/skeletor/src/model.js';

const { dayjs } = converse.env;

/**
 * The ControlBox is the section of the chat that contains the open groupchats,
 * bookmarks and roster.
 *
 * In `overlayed` `view_mode` it's a box like the chat boxes, in `fullscreen`
 * `view_mode` it's a left-aligned sidebar.
 * @mixin
 */
const ControlBox = Model.extend({

    defaults () {
        return {
            'bookmarked': false,
            'box_id': 'controlbox',
            'chat_state': undefined,
            'closed': !api.settings.get('show_controlbox_by_default'),
            'num_unread': 0,
            'time_opened': dayjs(0).valueOf(),
            'type': _converse.CONTROLBOX_TYPE,
            'url': ''
        };
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

    onReconnection () {
        this.save('connected', true);
    }
});

export default ControlBox;
