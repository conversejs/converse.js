import { _converse, api, converse, constants, Model } from '@converse/headless';

const { dayjs } = converse.env;
const { CONTROLBOX_TYPE } = constants;

/** The controlbox has no place in embedded view mode with a single chat. */
function isRelevant() {
    return !(api.settings.get('view_mode') === 'embedded' && api.settings.get('singleton'));
}

/**
 * The ControlBox is the section of the chat that contains the open groupchats,
 * bookmarks and roster.
 *
 * In `overlayed` `view_mode` it's a box like the chat boxes, in `fullscreen`
 * `view_mode` it's a left-aligned sidebar.
 */
class ControlBox extends Model {
    defaults() {
        return {
            box_id: 'controlbox',
            chat_state: undefined,
            closed: !api.settings.get('show_controlbox_by_default'),
            num_unread: 0,
            time_opened: dayjs(0).valueOf(),
            type: CONTROLBOX_TYPE,
            url: '',
        };
    }

    /**
     * Whether the controlbox is to be created, when it's restored from storage.
     * @returns {boolean}
     */
    static shouldCreate() {
        return isRelevant();
    }

    validate(attrs) {
        if (attrs.type === CONTROLBOX_TYPE) {
            return isRelevant() ? undefined : 'Controlbox not relevant in embedded view mode';
        }
        return _converse.state.ChatBox.prototype.validate.call(this, attrs);
    }

    /**
     * @param {boolean} [force]
     */
    maybeShow(force) {
        if (!force && this.get('id') === 'controlbox') {
            // Must return the chatbox
            return this;
        }
        return _converse.state.ChatBox.prototype.maybeShow.call(this, force);
    }

    onReconnection() {
        this.save('connected', true);
    }
}

export default ControlBox;
