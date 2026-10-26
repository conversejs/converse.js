/**
 * Daemon policy and protocol adapter for headless scheduled messages.
 * @module @converse/daemon/schedules
 */
import { ERRORS, RPCError } from './protocol.js';
import { resolveJID } from './resolve.js';
import { ownMessagesOnly } from './messages.js';

/**
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {Object} deps
 * @param {ReturnType<typeof import('./routing.js').createSendRouter>} deps.routeSend
 * @param {(params: Object, client: import('./types').Client) => Promise<import('./types').SendResult>} deps.sendNow
 */
export function scheduleMethods(_converse, { routeSend, sendNow }) {
    const { api } = _converse;

    /** Queue instead of sending when `at` is present. */
    const send = (params, client) => (params.at === undefined ? sendNow(params, client) : schedule(params, client));

    async function schedule({ to, body, reply_to, correct, at }, client) {
        const jid = await resolveJID(_converse, to, 'to');
        validateMessage(body, reply_to, correct);
        const send_at = futureTime(at);
        const add = () => addSchedule({ to: jid, body, reply_to, correct, send_at }, client);
        return routeSend(client, jid, {
            direct: add,
            draft: correct === undefined ? add : undefined,
            cannot_draft: ownMessagesOnly('schedule corrections to'),
            consume: false,
        });
    }

    async function addSchedule(params, client) {
        const scheduled = await api.scheduledMessages.schedule({
            to: params.to,
            body: params.body,
            send_at: params.send_at,
            metadata: {
                access: client.access,
                consumer: client.consumer,
                reply_to: params.reply_to,
                correct: params.correct,
            },
        });
        return { outcome: 'scheduled', schedule: toScheduleDTO(scheduled) };
    }

    /** Rebuild the originating client and pass through the normal send path. */
    async function onDue(scheduled, state) {
        const { to, body, metadata = {} } = scheduled.toJSON();
        const client = {
            access: metadata.access ?? 'full',
            consumer: metadata.consumer ?? null,
            notify: () => {},
        };
        const result = await sendNow({ to, body, reply_to: metadata.reply_to, correct: metadata.correct }, client);
        return { ...state, handled: true, result };
    }

    return {
        onDue,
        methods: {
            'messages.send': send,
            async 'schedules.list'() {
                const schedules = await api.scheduledMessages.get();
                return { schedules: schedules.map(toScheduleDTO) };
            },
            async 'schedules.cancel'({ id }) {
                if (typeof id !== 'string' || !id) {
                    throw new RPCError(ERRORS.INVALID_PARAMS, '"id" must be a scheduled message id.');
                }
                const scheduled = await api.scheduledMessages.cancel(id);
                if (!scheduled) {
                    throw new RPCError(
                        ERRORS.NOT_FOUND,
                        `No scheduled message with id "${id}". List them with "converse-cli schedules list".`,
                    );
                }
                return { schedule: toScheduleDTO(scheduled) };
            },
        },
    };
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
    const { id, to, body, send_at, created, metadata = {} } = scheduled.toJSON();
    return {
        id,
        to,
        body,
        send_at,
        created,
        consumer: metadata.consumer ?? null,
        access: metadata.access ?? 'full',
        reply_to: metadata.reply_to ?? null,
        correct: metadata.correct ?? null,
    };
}
