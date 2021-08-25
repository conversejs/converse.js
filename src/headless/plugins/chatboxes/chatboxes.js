import { Collection } from "@converse/skeletor/src/collection";
import { _converse, api } from "../../core.js";
import { initStorage } from '@converse/headless/utils/storage.js';

const ChatBoxes = Collection.extend({
    comparator: 'time_opened',

    model (attrs, options) {
        return new _converse.ChatBox(attrs, options);
    },

    onChatBoxesFetched (collection) {
        collection.filter(c => !c.isValid()).forEach(c => c.destroy());
        /**
         * Triggered once all chat boxes have been recreated from the browser cache
         * @event _converse#chatBoxesFetched
         * @type { object }
         * @property { _converse.ChatBox | _converse.ChatRoom } chatbox
         * @property { XMLElement } stanza
         * @example _converse.api.listen.on('chatBoxesFetched', obj => { ... });
         * @example _converse.api.waitUntil('chatBoxesFetched').then(() => { ... });
         */
        api.trigger('chatBoxesFetched');
    },

    onConnected (reconnecting) {
        if (reconnecting) { return; }
        initStorage(this, `converse.chatboxes-${_converse.bare_jid}`);
        this.fetch({
            'add': true,
            'success': c => this.onChatBoxesFetched(c)
        });
    }
});


export default ChatBoxes;
