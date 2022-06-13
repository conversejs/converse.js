import ChatBox from '@converse/headless/plugins/chat/model.js';
import { _converse, api } from '../../core.js';


export default class HeadlinesFeed extends ChatBox {

    defaults () {
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
        this.set({'box_id': `box-${this.get('jid')}`});
        this.initUI();
        this.initMessages();
        await this.fetchMessages();
        /**
         * Triggered once a { @link _converse.HeadlinesFeed } has been created and initialized.
         * @event _converse#headlinesFeedInitialized
         * @type { _converse.HeadlinesFeed }
         * @example _converse.api.listen.on('headlinesFeedInitialized', model => { ... });
         */
        api.trigger('headlinesFeedInitialized', this);
    }
}
