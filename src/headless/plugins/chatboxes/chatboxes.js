import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import { Collection } from "@converse/skeletor/src/collection";
import { initStorage } from '../../utils/storage.js';

class ChatBoxes extends Collection {
    get comparator () { // eslint-disable-line class-methods-use-this
        return 'time_opened';
    }

    onChatBoxesFetched (collection) { // eslint-disable-line class-methods-use-this
        collection.filter(c => !c.isValid()).forEach(c => c.destroy());
        /**
         * Triggered once all chat boxes have been recreated from the browser cache
         * @event _converse#chatBoxesFetched
         * @type { object }
         * @property { _converse.ChatBox | _converse.ChatRoom } chatbox
         * @property { Element } stanza
         * @example _converse.api.listen.on('chatBoxesFetched', obj => { ... });
         * @example _converse.api.waitUntil('chatBoxesFetched').then(() => { ... });
         */
        api.trigger('chatBoxesFetched');
    }

    onConnected (reconnecting) {
        if (reconnecting) { return; }
        initStorage(this, `converse.chatboxes-${_converse.bare_jid}`);
        this.fetch({
            'add': true,
            'success': c => this.onChatBoxesFetched(c)
        });
    }
}

export default ChatBoxes;
