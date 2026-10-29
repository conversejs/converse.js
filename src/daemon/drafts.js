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
import fs from 'node:fs';
import path from 'node:path';
import { withdrawalNotice, draftNotice } from './notices.js';
import { findOwn, findTarget, retractMessage, sendMessage, sendReaction, toMessageDTO } from './messages.js';
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
        add({ to, body, consumer, ...targets }) {
            // Ids are never reused, so a draft named in the audit log is always the one it named.
            state.next += 1;
            const created = new Date().toISOString();
            const draft = { id: `d${state.next}`, to, body, consumer, created, ...withDefaults(targets) };
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
     * @param {Pick<import('./types').Draft, 'to'|'body'> & Partial<import('./types').Draft>} attrs
     * @param {import('./types').Routing} routing
     * @param {Object} [about]
     * @param {import('./types').MessageDTO|null} [about.target] - The message the draft acts on
     * @param {import('./types').AuditEntry['action']} [about.action]
     * @returns {Promise<import('./types').SendResult>}
     */
    return async function queueDraft(client, attrs, routing, { target = null, action } = {}) {
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
            ...(action ? { action } : {}),
            ...(target ? { target: target.id } : {}),
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
         * One draft, with the message it replies to, corrects, retracts or
         * reacts to, so that the user can review it before sending it.
         * @param {{ id: string }} params
         * @returns {Promise<{ draft: import('./types').Draft, target: import('./types').MessageDTO|null }>}
         *  The target is null if the draft doesn't act on a message, or the message is no longer held.
         */
        async 'drafts.get'({ id }) {
            const draft = find(id);
            const { target } = actionOf(draft);
            return { draft, target: target ? await findHeld(_converse, target, draft.to) : null };
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
                        'it with "converse-cli drafts reject".',
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
            const { action, target } = actionOf(draft);
            audit.record({
                consumer: client.consumer,
                to: draft.to,
                outcome: 'sent',
                id: message.id,
                draft: id,
                approved_by: client.access,
                ...(action ? { action } : {}),
                ...(target ? { target } : {}),
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
    const { to, body } = draft;
    if (draft.retract) {
        return retractMessage(_converse, await findOwn(_converse, draft.retract, to, 'retract'), draft.retract);
    }
    if (draft.reaction_to) {
        return sendReaction(_converse, await findTarget(_converse, draft.reaction_to, to), body, draft.remove);
    }
    const replying_to = draft.reply_to ? await findTarget(_converse, draft.reply_to, to) : undefined;
    const correcting = draft.correct ? await findOwn(_converse, draft.correct, to, 'correct') : undefined;
    return sendMessage(_converse, to, body, { replying_to, correcting }, draft.upload ? { oob_url: body } : {});
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
function actionOf({ reply_to, reaction_to, correct, retract, upload }) {
    if (retract) return { action: 'retract', target: retract };
    if (reaction_to) return { action: 'react', target: reaction_to };
    if (correct) return { action: 'correct', target: correct };
    if (reply_to) return { action: 'reply', target: reply_to };
    if (upload) return { action: 'upload' };
    return {};
}

/**
 * Drafts stored before a field existed get its default.
 * @param {Partial<import('./types').Draft>} draft
 * @returns {import('./types').Draft}
 */
const withDefaults = (draft) =>
    /** @type {import('./types').Draft} */ ({
        reply_to: null,
        reaction_to: null,
        correct: null,
        retract: null,
        remove: false,
        upload: false,
        ...draft,
    });

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
