/**
 * Drafts: sends a restricted client queued because the send policy wants a
 * person to approve them first. They're kept in a file, so they survive a
 * restart. Only a full connection can list, approve, edit or reject them.
 * @module @converse/daemon/drafts
 */
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
        get: (id) => state.drafts.find((draft) => draft.id === id),

        /**
         * @param {Omit<import('./types').Draft, 'id'|'created'>} attrs
         * @returns {import('./types').Draft}
         */
        add({ to, body, consumer }) {
            // Ids are never reused, so a draft named in the audit log is always the one it named.
            state.next += 1;
            const draft = { id: `d${state.next}`, to, body, consumer, created: new Date().toISOString() };
            state.drafts.push(draft);
            save();
            return draft;
        },

        /**
         * @param {string} id
         * @param {string} body
         * @returns {import('./types').Draft}
         */
        update(id, body) {
            const draft = state.drafts.find((d) => d.id === id);
            draft.body = body;
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
 * The `drafts.*` methods. All of them are full-access only: the connection
 * that queued a draft can't approve it.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {Object} deps
 * @param {ReturnType<typeof createDraftStore>} deps.drafts
 * @param {ReturnType<typeof import('./audit.js').createAudit>} deps.audit
 * @param {ReturnType<typeof import('./events.js').createEvents>} deps.events
 */
export function draftMethods(_converse, { drafts, audit, events }) {
    /**
     * Drafts being sent right now. Approving one twice would send it twice.
     * @type {Set<string>}
     */
    const sending = new Set();

    /**
     * @param {unknown} id
     * @returns {import('./types').Draft}
     */
    const find = (id) => {
        if (typeof id !== 'string')
            throw new RPCError(ERRORS.INVALID_PARAMS, '"id" must be a draft id, such as "d17".');
        const draft = drafts.get(id);
        if (!draft) {
            throw new RPCError(
                ERRORS.NOT_FOUND,
                `No draft with id "${id}". List the drafts waiting for approval with "converse-cli drafts list".`,
            );
        }
        return draft;
    };

    /**
     * A draft that's being sent can't be changed or dropped under the send.
     * @param {string} id
     */
    const notBeingSent = (id) => {
        if (sending.has(id)) throw new RPCError(ERRORS.CONFLICT, `Draft ${id} is being sent right now.`);
    };

    return {
        /** @returns {{ drafts: import('./types').Draft[] }} */
        'drafts.list': () => ({ drafts: drafts.list() }),

        /**
         * Sends the draft as it's stored now, then removes it. If the send
         * doesn't go, the draft stays queued.
         * @param {{ id: string }} params
         * @param {import('./types').Client} client
         * @returns {Promise<import('./types').SendResult>}
         */
        async 'drafts.approve'({ id }, client) {
            const draft = find(id);
            notBeingSent(id);
            sending.add(id);
            try {
                const message = await sendMessage(_converse, draft.to, draft.body);
                drafts.remove(id);
                audit.record({ consumer: client.consumer, to: draft.to, outcome: 'sent', id: message.id, draft: id });
                events.publishDraft('approved', draft);
                return { outcome: 'sent', message };
            } finally {
                sending.delete(id);
            }
        },

        /**
         * Changes what will be sent. The draft stays queued for approval.
         * @param {{ id: string, body: string }} params
         * @returns {{ draft: import('./types').Draft }}
         */
        'drafts.edit'({ id, body }) {
            const draft = find(id);
            if (typeof body !== 'string' || !body.trim()) {
                throw new RPCError(ERRORS.INVALID_PARAMS, 'There is nothing to send: "body" is empty.');
            }
            notBeingSent(id);
            const edited = drafts.update(draft.id, body);
            events.publishDraft('edited', edited);
            return { draft: edited };
        },

        /**
         * Drops the draft, so that nothing is sent.
         * @param {{ id: string }} params
         * @param {import('./types').Client} client
         * @returns {{ draft: import('./types').Draft }}
         */
        'drafts.reject'({ id }, client) {
            const draft = find(id);
            notBeingSent(id);
            drafts.remove(id);
            audit.record({ consumer: client.consumer, to: draft.to, outcome: 'rejected', draft: id });
            events.publishDraft('rejected', draft);
            return { draft };
        },
    };
}
