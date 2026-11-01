/**
 * Drafts: sends a restricted client asked for, which the policy doesn't let
 * go out directly. In "owner_only" and "bot" modes the daemon never sends
 * them: their text goes to the owner, who sends it themselves from their own
 * client or doesn't. In "as_user" mode the account is the user's own, so a
 * draft is held in the daemon, and delivered nowhere, until the user approves
 * it from a full access client, which sends it as the user. They're kept in a
 * file, so they survive a restart.
 * @module @converse/daemon/drafts
 */
import { withdrawalNotice, draftNotice } from './notices.js';
import { findOwn, findTarget, retractMessage, sendMessage, sendReaction, toMessageDTO } from './messages.js';
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
 * Makes the drafts for every send path, so that they're made one way: stored,
 * delivered to the owner unless the mode holds them, audited and announced.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {Object} deps
 * @param {ReturnType<typeof createDraftStore>} deps.drafts
 * @param {ReturnType<typeof import('./audit.js').createAudit>} deps.audit
 * @param {ReturnType<typeof import('./events.js').createEvents>} deps.events
 * @param {string} deps.owner - Bare JID of the user
 * @param {import('./types').Mode} deps.mode
 */
export function createDrafter(_converse, { drafts, audit, events, owner, mode }) {
    /**
     * @param {import('./types').Client} client
     * @param {{ to: string } & import('./types').DraftAction} attrs
     * @param {import('./types').Routing} routing
     * @param {import('./types').MessageDTO|null} [target] - The message the draft acts on, for the owner's notice
     * @returns {Promise<import('./types').SendResult>}
     */
    return async function queueDraft(client, attrs, routing, target = null) {
        const added = drafts.add({ ...attrs, consumer: client.consumer });
        // Acting as the user, there's no other account to deliver it to: it waits for approval.
        if (mode !== 'as_user') {
            try {
                await sendMessage(_converse, owner, draftNotice(added, target));
            } catch (e) {
                // Without the owner's copy, the draft would be one nobody can see, so it's dropped.
                drafts.remove(added.id);
                throw e;
            }
        }
        audit.record({
            consumer: client.consumer,
            to: added.to,
            outcome: 'draft',
            draft: added.id,
            ...actionOf(added),
            ...routing,
        });
        events.publishDraft('queued', added);
        return { outcome: 'draft', draft_id: added.id };
    };
}

/**
 * The `drafts.*` methods. Listing and showing drafts is for full access, and
 * in "as_user" mode for restricted access too (see daemon.js). Rejecting one
 * only drops it. Sending one is for full access in "as_user" mode alone.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {Object} deps
 * @param {ReturnType<typeof createDraftStore>} deps.drafts
 * @param {ReturnType<typeof import('./audit.js').createAudit>} deps.audit
 * @param {ReturnType<typeof import('./events.js').createEvents>} deps.events
 * @param {string} deps.owner - Bare JID of the user
 * @param {import('./types').Mode} deps.mode
 */
export function draftMethods(_converse, { drafts, audit, events, owner, mode }) {
    /** The drafts being sent right now, so that one can't be sent twice. */
    const sending = new Set();

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
            throw new RPCError(ERRORS.NOT_FOUND, `No draft with id "${id}". List the drafts with "drafts.list".`);
        }
        return draft;
    };

    return {
        /** @returns {{ drafts: import('./types').Draft[] }} */
        'drafts.list': () => ({ drafts: drafts.list() }),

        /**
         * One draft, with the message it replies to, corrects, retracts or
         * reacts to, so that the user can review it before sending it.
         * @param {{ id: string }} params
         * @returns {Promise<{ draft: import('./types').Draft, target: import('./types').MessageDTO|null }>}
         *  The target is null if the draft doesn't act on a message, or the message is no longer held.
         */
        async 'drafts.get'({ id }) {
            const draft = find(id);
            return { draft, target: 'target' in draft ? await findHeld(_converse, draft.target, draft.to) : null };
        },

        /**
         * Sends a draft as the user, and removes it. If it can't be sent, it's kept.
         * @param {{ id: string }} params
         * @param {import('./types').Client} client
         * @returns {Promise<import('./types').SendResult>}
         */
        async 'drafts.send'({ id }, client) {
            if (mode !== 'as_user') {
                throw new RPCError(
                    ERRORS.ACCESS_DENIED,
                    `The daemon only sends drafts in "as_user" mode, and this one runs in "${mode}". ` +
                        "Here a draft's text was delivered to you: send it from your own client, or withdraw " +
                        'it with "drafts.reject".',
                );
            }
            const draft = find(id);
            if (sending.has(id)) {
                throw new RPCError(ERRORS.CONFLICT, `Draft ${id} is already being sent.`);
            }
            sending.add(id);
            let message;
            try {
                message = await deliver(_converse, draft);
            } finally {
                sending.delete(id);
            }
            drafts.remove(id);
            audit.record({
                consumer: client.consumer,
                to: draft.to,
                outcome: 'sent',
                id: message.id,
                draft: id,
                approved_by: client.access,
                ...actionOf(draft),
                route: 'draft',
                mode,
            });
            events.publishDraft('sent', draft);
            return { outcome: 'sent', message };
        },

        /**
         * Drops the draft. In the modes that deliver drafts, the owner is told,
         * if the daemon can reach them.
         * @param {{ id: string }} params
         * @param {import('./types').Client} client
         * @returns {Promise<{ draft: import('./types').Draft }>}
         */
        async 'drafts.reject'({ id }, client) {
            const draft = find(id);
            if (sending.has(id)) {
                throw new RPCError(ERRORS.CONFLICT, `Draft ${id} is being sent, so it can't be withdrawn.`);
            }
            drafts.remove(id);
            audit.record({
                consumer: client.consumer,
                to: draft.to,
                outcome: 'rejected',
                draft: id,
                route: 'draft',
                mode,
            });
            events.publishDraft('rejected', draft);
            if (mode !== 'as_user' && _converse.api.connection.connected()) {
                await sendMessage(_converse, owner, withdrawalNotice(id));
            }
            return { draft };
        },
    };
}

/**
 * Does what a draft says, as the user: sends it, or applies it to the message
 * it acts on.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {import('./types').Draft} draft
 * @returns {Promise<import('./types').MessageDTO>}
 */
async function deliver(_converse, draft) {
    const { to } = draft;
    switch (draft.action) {
        case 'retract':
            return retractMessage(_converse, await findOwn(_converse, draft.target, to, 'retract'), draft.target);
        case 'react':
            return sendReaction(_converse, await findTarget(_converse, draft.target, to), draft.body, draft.remove);
        case 'reply':
            return sendMessage(_converse, to, draft.body, {
                replying_to: await findTarget(_converse, draft.target, to),
            });
        case 'correct':
            return sendMessage(_converse, to, draft.body, {
                correcting: await findOwn(_converse, draft.target, to, 'correct'),
            });
        case 'upload':
            return sendMessage(_converse, to, draft.body, {}, { oob_url: draft.body });
        default:
            return sendMessage(_converse, to, draft.body);
    }
}

/**
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {string} id
 * @param {string} jid - The bare JID of the conversation
 * @returns {Promise<import('./types').MessageDTO|null>}
 */
async function findHeld(_converse, id, jid) {
    try {
        return toMessageDTO(await findTarget(_converse, id, jid), jid, _converse.session.get('bare_jid'));
    } catch (e) {
        if (e instanceof RPCError && e.code === ERRORS.NOT_FOUND) return null;
        throw e;
    }
}

/**
 * What a draft does, as the audit log names it.
 * @param {import('./types').Draft} draft
 * @returns {{ action?: import('./types').AuditEntry['action'], target?: string }}
 */
function actionOf(draft) {
    return {
        // The log names no action for a plain message.
        ...(draft.action === 'send' ? {} : { action: draft.action }),
        ...('target' in draft ? { target: draft.target } : {}),
    };
}
