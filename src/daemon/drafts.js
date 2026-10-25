/**
 * Drafts: sends a restricted client asked for, to someone other than the owner.
 * The daemon never sends them. Their text goes to the owner, who sends it
 * themselves from their own client or doesn't. They're kept in a file, so they
 * survive a restart. Only a full connection can list or reject them.
 * @module @converse/daemon/drafts
 */
import { withdrawalNotice } from './notices.js';
import { sendMessage } from './messages.js';
import { ERRORS, RPCError } from './protocol.js';
import { readStateFile, writeStateFile } from './state-file.js';

/**
 * @param {string} file - In the account's state directory
 */
export function createDraftStore(file) {
    /** @type {{ next: number, drafts: import('./types').Draft[] }} */
    const state = readStateFile(file, { next: 0, drafts: [] }, 'the drafts');
    const save = () => writeStateFile(file, state);

    return {
        /** @returns {import('./types').Draft[]} Oldest first */
        list: () => [...state.drafts],

        /** @returns {import('./types').Draft|undefined} */
        get: (id) => state.drafts.find((d) => d.id === id),

        /**
         * @param {{ to: string, consumer: string|null } & import('./types').DraftAction} attrs
         * @returns {import('./types').Draft}
         */
        add({ to, consumer, ...action }) {
            // Ids are never reused, so a draft named in the audit log is always the one it named.
            state.next += 1;
            const created = new Date().toISOString();
            /** @type {import('./types').Draft} */
            const draft = { id: `d${state.next}`, to, consumer, created, ...action };
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
