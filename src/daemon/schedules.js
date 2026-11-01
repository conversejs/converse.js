/**
 * Sending a message later: the RPC methods, and the send policy applied again
 * when a message comes due.
 * @module @converse/daemon/schedules
 */
import { u } from '@converse/headless';
import { ERRORS, RPCError } from './protocol.js';
import { resolveJID } from './resolve.js';
import { ownMessagesOnly } from './messages.js';
import { createScheduler } from './scheduler.js';

/** The policy rules that refuse a send only for now. */
const RATE_LIMITS = ['rate_conversation', 'rate_room', 'rate_overall'];

/**
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {Object} deps
 * @param {ReturnType<typeof import('./routing.js').createSendRouter>} deps.routeSend
 * @param {(params: Object, client: import('./types').Client) => Promise<import('./types').SendResult>} deps.sendNow
 * @param {import('./types').Mode} deps.mode
 */
export function scheduleMethods(_converse, { routeSend, sendNow, mode }) {
    const scheduler = createScheduler(_converse, onDue);

    /**
     * Holds a message to send at a later time. The send policy decides now
     * whether it may be scheduled, and again when it comes due.
     * @param {Object} params - Those of `messages.send`, and when to send it
     * @param {string} params.to - A JID, or the name of a contact or room
     * @param {string} params.body
     * @param {string} [params.reply_to]
     * @param {string} [params.correct]
     * @param {string} params.at - When to send it: an ISO 8601 time, in the future
     * @param {import('./types').Client} client
     * @returns {Promise<import('./types').SendResult>}
     */
    async function schedule({ to, body, reply_to, correct, at }, client) {
        const jid = await resolveJID(_converse, to, 'to');
        validateMessage(body, reply_to, correct);
        const send_at = futureTime(at);
        const add = () => addSchedule({ to: jid, body, reply_to, correct, send_at }, client);
        return routeSend(client, jid, {
            direct: add,
            // A due send is routed again, so where it would be drafted, it's drafted then.
            // Only "as_user" mode drafts a correction.
            draft: correct === undefined || mode === 'as_user' ? add : undefined,
            cannot_draft: ownMessagesOnly('schedule corrections to'),
            consume: false,
        });
    }

    async function addSchedule(params, client) {
        const schedules = await scheduler.get();
        const scheduled = await schedules.schedule({
            id: u.getUniqueId('scheduled'),
            to: params.to,
            body: params.body,
            send_at: params.send_at,
            created: new Date().toISOString(),
            metadata: {
                access: client.access,
                consumer: client.consumer,
                reply_to: params.reply_to,
                correct: params.correct,
            },
        });
        return { outcome: 'scheduled', schedule: toScheduleDTO(scheduled) };
    }

    /**
     * Rebuild the originating client and pass through the normal send path.
     * @param {import('./scheduler.js').ScheduledMessage} scheduled
     */
    async function onDue(scheduled) {
        const { to, body, metadata = {} } = scheduled.toJSON();
        const client = {
            // One that doesn't say who asked for it is held to policy, as an agent's is.
            access: metadata.access ?? 'restricted',
            consumer: metadata.consumer ?? null,
            notify: () => {},
        };
        const result = await sendNow({ to, body, reply_to: metadata.reply_to, correct: metadata.correct }, client);
        if (result.outcome !== 'refused') return;

        // A rate limit lets it through once the window has moved on. Any other
        // refusal stands, so it's kept for the owner to see why it wasn't sent,
        // instead of being dropped silently.
        const { rule, message } = result;
        if (RATE_LIMITS.includes(rule)) return { retry: true };

        return { park: { rule, message } };
    }

    return {
        methods: {
            'schedules.create': schedule,
            async 'schedules.list'(_params, client) {
                const schedules = await scheduler.get();
                return {
                    schedules: schedules.models.filter((scheduled) => canManage(client, scheduled)).map(toScheduleDTO),
                };
            },
            async 'schedules.cancel'({ id }, client) {
                if (typeof id !== 'string' || !id) {
                    throw new RPCError(ERRORS.INVALID_PARAMS, '"id" must be a scheduled message id.');
                }
                const schedules = await scheduler.get();
                const existing = schedules.get(id);
                if (!existing || !canManage(client, existing)) {
                    throw new RPCError(
                        ERRORS.NOT_FOUND,
                        `No scheduled message with id "${id}". List them with "schedules.list".`,
                    );
                }
                return { schedule: toScheduleDTO(await schedules.cancel(id)) };
            },
        },
    };
}

/**
 * Full access manages every schedule. A restricted connection manages only the
 * restricted schedules its own consumer created, so it cannot see or cancel
 * anything a full-access owner scheduled.
 */
function canManage(client, scheduled) {
    if (client.access === 'full') return true;
    const { metadata = {} } = scheduled.toJSON();
    return metadata.access === 'restricted' && !!client.consumer && metadata.consumer === client.consumer;
}

function validateMessage(body, reply_to, correct) {
    if (typeof body !== 'string' || !body.trim()) {
        throw new RPCError(ERRORS.INVALID_PARAMS, 'There is nothing to schedule: "body" is empty.');
    }
    if (reply_to !== undefined && correct !== undefined) {
        throw new RPCError(
            ERRORS.INVALID_PARAMS,
            'A message either replies or corrects: pass one of "reply_to" and "correct".',
        );
    }
}

function futureTime(value) {
    const time = typeof value === 'string' ? Date.parse(value) : NaN;
    if (Number.isNaN(time) || time <= Date.now()) {
        throw new RPCError(ERRORS.INVALID_PARAMS, '"at" must be an ISO 8601 time in the future.');
    }
    return new Date(time).toISOString();
}

/** @returns {import('./types').ScheduleDTO} */
function toScheduleDTO(scheduled) {
    const { id, to, body, send_at, created, metadata = {}, parked = null } = scheduled.toJSON();
    return {
        id,
        to,
        body,
        send_at,
        created,
        consumer: metadata.consumer ?? null,
        access: metadata.access ?? 'restricted',
        reply_to: metadata.reply_to ?? null,
        correct: metadata.correct ?? null,
        parked,
    };
}
