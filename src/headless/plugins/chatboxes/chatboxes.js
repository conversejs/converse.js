/**
 * @typedef {import('../../shared/chatbox').default} ChatBoxBase
 */
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import log from '@converse/log';
import { Collection } from '@converse/skeletor';
import { initStorage } from '../../utils/storage.js';
import { isResumed } from '../../utils/session.js';

/**
 * @extends {Collection<ChatBoxBase>}
 */
class ChatBoxes extends Collection {
    /**
     * @param {ChatBoxBase[]} models
     * @param {import('@converse/skeletor').CollectionOptions<ChatBoxBase>} options
     */
    constructor(models, options) {
        super(models, Object.assign({ comparator: 'time_opened' }, options));
    }

    /**
     * Leaves out the stored chats that their type says not to create (see
     * `shouldCreate` on {@link ChatBoxBase}), before they're created.
     * @param {any} resp
     */
    parse(resp) {
        if (!Array.isArray(resp)) return resp;

        return resp.filter((attrs) => {
            const ChatBox = attrs?.type && api.chatboxes.registry.get(attrs.type);
            return ChatBox?.shouldCreate?.(attrs) ?? true;
        });
    }

    /**
     * @param {Collection} collection
     */
    onChatBoxesFetched(collection) {
        collection.filter((c) => !c.isValid()).forEach((c) => c.destroy());
        /**
         * Triggered once all chat boxes have been recreated from the browser cache
         * @event _converse#chatBoxesFetched
         * @example _converse.api.listen.on('chatBoxesFetched', () => { ... });
         */
        api.trigger('chatBoxesFetched');
    }

    /**
     * @param {boolean} reconnecting
     */
    onConnected(reconnecting) {
        // A resumed session read its chats before connecting, unless that failed.
        if (reconnecting || (isResumed(_converse) && this.#read)) return;

        this.fetchCached();
    }

    // Whether the last read of the chats from the cache succeeded.
    #read = false;

    /**
     * Loads the chats from the cache.
     * @returns {Promise<boolean>} Whether the cache could be read.
     */
    fetchCached() {
        const bare_jid = _converse.session.get('bare_jid');
        initStorage(this, `converse.chatboxes-${bare_jid}`);
        this.#read = false;
        return new Promise((resolve) => {
            this.fetch({
                add: true,
                success: (c) => {
                    this.#read = true;
                    this.onChatBoxesFetched(c);
                    resolve(true);
                },
                error: (_c, e) => {
                    log.error(e);
                    resolve(false);
                },
            });
        });
    }

    /**
     * @param {import('./types').CreateModelAttributes} attrs
     * @param {import('@converse/skeletor').ModelOptions} options
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
