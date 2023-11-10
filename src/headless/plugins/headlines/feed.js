import ChatBox from '../../plugins/chat/model.js';
import api from "../../shared/api/index.js";
import { HEADLINES_TYPE } from '../../shared/constants.js';


/**
 * Shows headline messages
 * @class
 * @namespace _converse.HeadlinesFeed
 * @memberOf _converse
 */
export default class HeadlinesFeed extends ChatBox {

    defaults () {
        return {
            'bookmarked': false,
            'hidden': ['mobile', 'fullscreen'].includes(api.settings.get("view_mode")),
            'message_type': 'headline',
            'num_unread': 0,
            'time_opened': this.get('time_opened') || (new Date()).getTime(),
            'time_sent': undefined,
            'type': HEADLINES_TYPE
        }
    }

    constructor (attrs, options) {
        super(attrs, options);
        this.disable_mam = true; // Don't do MAM queries for this box
    }

    async initialize () {
        super.initialize();
        this.set({'box_id': `box-${this.get('jid')}`});
        this.initUI();
        this.initMessages();
        await this.fetchMessages();
        /**
         * Triggered once a { @link _converse.HeadlinesFeed } has been created and initialized.
         * @event _converse#headlinesFeedInitialized
         * @type {HeadlinesFeed}
         * @example _converse.api.listen.on('headlinesFeedInitialized', model => { ... });
         */
        api.trigger('headlinesFeedInitialized', this);
    }
}
