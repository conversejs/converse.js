/**
 * Drafts: sends a restricted client asked for, to someone other than the owner.
 * The daemon never sends them. Their text goes to the owner, who sends it
 * themselves from their own client or doesn't. They're kept in a file, so they
 * survive a restart. Only a full connection can list or reject them.
 * @module @converse/daemon/drafts
 */
import fs from 'node:fs';
import path from 'node:path';
import { withdrawalNotice } from './notices.js';
import { sendMessage } from './messages.js';
import { ERRORS, RPCError } from './protocol.js';

/**
 * @param {string} file - In the account's state directory
 */
export function createDraftStore(file) {
    const state = load(file);

    function save() {
        fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
        // Written beside the file and renamed over it, so a crash mid-write
        // leaves the previous version intact.
        fs.writeFileSync(`${file}.tmp`, JSON.stringify(state, null, 2), { mode: 0o600 });
        fs.renameSync(`${file}.tmp`, file);
    }

    return {
        /** @returns {import('./types').Draft[]} Oldest first */
        list: () => state.drafts.map(withDefaults),

        /** @returns {import('./types').Draft|undefined} */
        get: (id) => {
            const draft = state.drafts.find((d) => d.id === id);
            return draft && withDefaults(draft);
        },

        /**
         * @param {Pick<import('./types').Draft, 'to'|'body'|'consumer'> & Partial<import('./types').Draft>} attrs
         * @returns {import('./types').Draft}
         */
        add({ to, body, consumer, reply_to = null, reaction_to = null }) {
            // Ids are never reused, so a draft named in the audit log is always the one it named.
            state.next += 1;
            const created = new Date().toISOString();
            const draft = { id: `d${state.next}`, to, body, consumer, created, reply_to, reaction_to };
            state.drafts.push(draft);
            save();
            return draft;
        },

        /** @param {string} id */
        remove(id) {
            state.drafts = state.drafts.filter((draft) => draft.id !== id);
            save();
        },
    };
}

/**
 * The `drafts.*` methods. Both are full-access only. Neither sends anything
 * to a recipient: rejecting a draft only drops it, and tells the owner.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {Object} deps
 * @param {ReturnType<typeof createDraftStore>} deps.drafts
 * @param {ReturnType<typeof import('./audit.js').createAudit>} deps.audit
 * @param {ReturnType<typeof import('./events.js').createEvents>} deps.events
 * @param {string} deps.owner - Bare JID of the user
 */
export function draftMethods(_converse, { drafts, audit, events, owner }) {
    /**
     * @param {unknown} id
     * @returns {import('./types').Draft}
     */
    const find = (id) => {
        if (typeof id !== 'string') {
            throw new RPCError(ERRORS.INVALID_PARAMS, '"id" must be a draft id, such as "d17".');
        }
        const draft = drafts.get(id);
        if (!draft) {
            throw new RPCError(
                ERRORS.NOT_FOUND,
                `No draft with id "${id}". List the drafts with "converse-cli drafts list".`,
            );
        }
        return draft;
    };

    return {
        /** @returns {{ drafts: import('./types').Draft[] }} */
        'drafts.list': () => ({ drafts: drafts.list() }),

        /**
         * Drops the draft. The owner is told, if the daemon can reach them.
         * @param {{ id: string }} params
         * @param {import('./types').Client} client
         * @returns {Promise<{ draft: import('./types').Draft }>}
         */
        async 'drafts.reject'({ id }, client) {
            const draft = find(id);
            drafts.remove(id);
            audit.record({ consumer: client.consumer, to: draft.to, outcome: 'rejected', draft: id });
            events.publishDraft('rejected', draft);
            if (_converse.api.connection.connected()) {
                await sendMessage(_converse, owner, withdrawalNotice(id));
            }
            return { draft };
        },
    };
}

/**
 * Drafts stored before a field existed get its default.
 * @param {import('./types').Draft} draft
 * @returns {import('./types').Draft}
 */
const withDefaults = (draft) => ({ reply_to: null, reaction_to: null, ...draft });

/**
 * @param {string} file
 * @returns {{ next: number, drafts: import('./types').Draft[] }}
 */
function load(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        if (e.code === 'ENOENT') return { next: 0, drafts: [] };
        throw new Error(`Couldn't read the drafts in ${file}: ${e.message}`, { cause: e });
    }
}
