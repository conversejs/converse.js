import { _converse, api, converse } from '@converse/headless';
import { Model } from '@converse/skeletor';
import { CONTROLBOX_TYPE } from '@converse/headless/shared/constants';

const { dayjs } = converse.env;

/**
 * The ControlBox is the section of the chat that contains the open groupchats,
 * bookmarks and roster.
 *
 * In `overlayed` `view_mode` it's a box like the chat boxes, in `fullscreen`
 * `view_mode` it's a left-aligned sidebar.
 * @mixin
 */
class ControlBox extends Model {

    defaults () {  // eslint-disable-line class-methods-use-this
        return {
            'bookmarked': false,
            'box_id': 'controlbox',
            'chat_state': undefined,
            'closed': !api.settings.get('show_controlbox_by_default'),
            'num_unread': 0,
            'time_opened': dayjs(0).valueOf(),
            'type': CONTROLBOX_TYPE,
            'url': ''
        };
    }

    validate (attrs) {
        if (attrs.type === CONTROLBOX_TYPE) {
            if (api.settings.get('view_mode') === 'embedded' && api.settings.get('singleton')) {
                return 'Controlbox not relevant in embedded view mode';
            }
            return;
        }
        return _converse.ChatBox.prototype.validate.call(this, attrs);
    }

    maybeShow (force) {
        if (!force && this.get('id') === 'controlbox') {
            // Must return the chatbox
            return this;
        }
        return _converse.ChatBox.prototype.maybeShow.call(this, force);
    }

    onReconnection () {
        this.save('connected', true);
    }
}

export default ControlBox;
