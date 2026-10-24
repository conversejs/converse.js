/**
 * Read cursors for each consumer: how far a named consumer (such as `claude`)
 * has read in each conversation. They're kept in a file, so that they survive
 * a restart, and they're separate from the user's own read state, which
 * headless keeps and which no consumer touches.
 * @module @converse/daemon/cursors
 */
import { readStateFile, writeStateFile } from './state-file.js';

/**
 * @param {string} file - Where the cursors are kept, in the account's state directory
 */
export function createCursors(file) {
    /** @type {import('./types').CursorState} */
    const state = readStateFile(file, { consumers: {} }, 'the read cursors');
    const save = () => writeStateFile(file, state);

    /**
     * The consumer's record, created the first time the consumer is seen.
     * @param {string} name
     * @returns {import('./types').ConsumerCursors}
     */
    function consumer(name) {
        if (!Object.hasOwn(state.consumers, name)) {
            state.consumers[name] = { created: new Date().toISOString(), conversations: {} };
            save();
        }
        return state.consumers[name];
    }

    return {
        /**
         * When the consumer was first seen. A consumer that has never read a
         * conversation has everything after this as unread.
         * @param {string} name
         */
        since: (name) => consumer(name).created,

        /**
         * @param {string} name
         * @param {string} jid - The conversation
         * @returns {import('./types').Cursor|undefined}
         */
        get(name, jid) {
            const { conversations } = consumer(name);
            return Object.hasOwn(conversations, jid) ? conversations[jid] : undefined;
        },

        /**
         * @param {string} name
         * @param {string} jid
         * @param {import('./types').Cursor} cursor
         */
        set(name, jid, cursor) {
            consumer(name).conversations[jid] = cursor;
            save();
        },
    };
}
