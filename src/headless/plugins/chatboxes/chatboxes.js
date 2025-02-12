/**
 * @typedef {import('../../plugins/chat/model.js').default} ChatBox
 * @typedef {import('../../plugins/muc/muc').default} MUC
 * @typedef {import('@converse/skeletor').Model} Model
 */
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import { Collection } from '@converse/skeletor';
import { initStorage } from '../../utils/storage.js';

class ChatBoxes extends Collection {
    /**
     * @param {Model[]} models
     * @param {object} options
     */
    constructor(models, options) {
        super(models, Object.assign({ comparator: 'time_opened' }, options));
    }

    /**
     * @param {Collection} collection
     */
    onChatBoxesFetched(collection) {
        collection.filter((c) => !c.isValid()).forEach((c) => c.destroy());
        /**
         * Triggered once all chat boxes have been recreated from the browser cache
         * @event _converse#chatBoxesFetched
         * @type {object}
         * @property {ChatBox|MUC} chatbox
         * @property {Element} stanza
         * @example _converse.api.listen.on('chatBoxesFetched', obj => { ... });
         * @example _converse.api.waitUntil('chatBoxesFetched').then(() => { ... });
         */
        api.trigger('chatBoxesFetched');
    }

    /**
     * @param {boolean} reconnecting
     */
    onConnected(reconnecting) {
        if (reconnecting) return;

        const bare_jid = _converse.session.get('bare_jid');
        initStorage(this, `converse.chatboxes-${bare_jid}`);
        this.fetch({
            'add': true,
            'success': (c) => this.onChatBoxesFetched(c),
        });
    }

    /**
     * @param {object} attrs
     * @param {object} options
     */
    createModel(attrs, options) {
        if (!attrs.type) {
            throw new Error('You need to specify a type of chatbox to be created');
        }
        const ChatBox = api.chatboxes.registry.get(attrs.type);
        return new ChatBox(attrs, options);
    }
}

export default ChatBoxes;
