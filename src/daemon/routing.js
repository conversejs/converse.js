/**
 * Applies the daemon's send policy before a restricted client's operation can
 * read, upload, or send its content.
 * @module @converse/daemon/routing
 */
import { ERRORS, RPCError } from './protocol.js';

/**
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {Object} deps
 * @param {ReturnType<typeof import('./policy.js').createPolicy>} deps.policy
 * @param {ReturnType<typeof import('./audit.js').createAudit>} deps.audit
 * @param {import('./types').Mode} deps.mode
 */
export function createSendRouter(_converse, { policy, audit, mode }) {
    const { api } = _converse;

    /**
     * @param {import('./types').Client} client
     * @param {string} to - The bare JID of the conversation
     * @param {Object} routes
     * @param {(routing?: import('./types').Routing) => Promise<import('./types').SendResult>} routes.direct
     * @param {(routing: import('./types').Routing) => Promise<import('./types').SendResult>} [routes.draft]
     * @param {Error} [routes.cannot_draft]
     * @param {import('./types').AuditEntry['action']} [routes.action]
     */
    return async function routeSend(client, to, { direct, draft, cannot_draft, action }) {
        if (client.access === 'full') return direct();

        const room = await api.rooms.get(to);
        if (room && !room.isEntered()) throw notJoined(to);

        const verdict = policy.admit(to, { room: !!room });
        if (!verdict.allowed) {
            audit.record({
                consumer: client.consumer,
                to,
                mode,
                outcome: 'refused',
                rule: verdict.rule,
                ...(action ? { action } : {}),
            });
            return { outcome: 'refused', rule: verdict.rule, message: verdict.message };
        }

        const routing = { route: verdict.route, mode };
        if (verdict.route === 'direct') return direct(routing);
        if (draft) return draft(routing);
        throw cannot_draft;
    };
}

/**
 * A room's messages can't be sent until we're in the room.
 * @param {string} jid
 */
export function notJoined(jid) {
    return new RPCError(
        ERRORS.NOT_FOUND,
        `We aren't in ${jid}, so the message wasn't sent. Join it first with "converse-cli rooms join ${jid}".`,
    );
}
