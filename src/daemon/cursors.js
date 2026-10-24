/**
 * Read cursors for each consumer: how far a named consumer (such as `claude`)
 * has read in each conversation. They're kept in a file, so that they survive
 * a restart, and they're separate from the user's own read state, which
 * headless keeps and which no consumer touches.
 * @module @converse/daemon/cursors
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {string} file - Where the cursors are kept, in the account's state directory
 */
export function createCursors(file) {
    const state = load(file);

    function save() {
        fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
        // Written beside the file and renamed over it, so a crash mid-write
        // leaves the previous version intact.
        fs.writeFileSync(`${file}.tmp`, JSON.stringify(state, null, 2), { mode: 0o600 });
        fs.renameSync(`${file}.tmp`, file);
    }

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

/**
 * @param {string} file
 * @returns {import('./types').CursorState}
 */
function load(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        if (e.code === 'ENOENT') return { consumers: {} };
        throw new Error(`Couldn't read the read cursors in ${file}: ${e.message}`, { cause: e });
    }
}
