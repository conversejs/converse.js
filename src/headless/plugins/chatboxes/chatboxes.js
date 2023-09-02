import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import { Collection } from "@converse/skeletor/src/collection";
import { initStorage } from '../../utils/storage.js';

class ChatBoxes extends Collection {
    get comparator () {
        return 'time_opened';
    }

    onChatBoxesFetched (collection) {
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

    createModel (attrs, options) {
        if (!attrs.type) {
            throw new Error("You need to specify a type of chatbox to be created");
        }
        const ChatBox = api.chatboxes.registry.get(attrs.type);
        return new ChatBox(attrs, options);
    }
}

export default ChatBoxes;
