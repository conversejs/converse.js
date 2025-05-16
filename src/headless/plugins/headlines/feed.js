import api from '../../shared/api/index.js';
import { isUniView } from '../../utils/session.js';
import { HEADLINES_TYPE } from '../../shared/constants.js';
import ChatBoxBase from '../../shared/chatbox.js';

/**
 * Shows headline messages
 */
export default class HeadlinesFeed extends ChatBoxBase {
    defaults() {
        return {
            'bookmarked': false,
            'hidden': isUniView() && !api.settings.get('singleton'),
            'message_type': 'headline',
            'num_unread': 0,
            'time_opened': this.get('time_opened') || new Date().getTime(),
            'time_sent': undefined,
            'type': HEADLINES_TYPE,
        };
    }

    constructor(attrs, options) {
        super(attrs, options);
        this.disable_mam = true; // Don't do MAM queries for this box
    }

    async initialize() {
        await super.initialize();
        await this.fetchMessages();
        /**
         * Triggered once a { @link _converse.HeadlinesFeed } has been created and initialized.
         * @event _converse#headlinesFeedInitialized
         * @type {HeadlinesFeed}
         * @example _converse.api.listen.on('headlinesFeedInitialized', model => { ... });
         */
        api.trigger('headlinesFeedInitialized', this);
    }

    canPostMessages() {
        return false;
    }

    /**
     * @param {import('../../shared/message').default} message
     */
    isChatMessage(message) {
        const type = message.get('type');
        return type === this.get('message_type') || type === 'normal';
    }
}
