import ChatBox from '../../plugins/chat/model.js';
import _converse from '../../shared/_converse.js';
import api from "../../shared/api/index.js";


export default class HeadlinesFeed extends ChatBox {

    defaults () { // eslint-disable-line class-methods-use-this
        return {
            'bookmarked': false,
            'hidden': ['mobile', 'fullscreen'].includes(api.settings.get("view_mode")),
            'message_type': 'headline',
            'num_unread': 0,
            'time_opened': this.get('time_opened') || (new Date()).getTime(),
            'type': _converse.HEADLINES_TYPE
        }
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
