/**
 * The send policy a restricted connection is held to: where a send may go,
 * and how fast. The daemon applies it to every restricted send. Full access is
 * the user's own, so it isn't policed.
 *
 * A send goes one of three ways. Direct: the account sends it itself. Draft:
 * its text goes to the owner, who sends it or doesn't, or in "as_user" mode it's
 * held until the user approves it. Refused: the policy doesn't let it through
 * at all. The mode and the target decide which, and the rate limits count
 * direct sends and drafts alike.
 *
 * A room is stricter than a contact. It has its own allowlist, which is empty
 * by default, and its own limit, since one message reaches everyone in the room.
 * @module @converse/daemon/policy
 */

/**
 * @param {import('./types').Config} config
 * @param {Object} [options]
 * @param {() => number} [options.now] - Milliseconds since the epoch
 */
export function createPolicy({ mode, owner, policy, paths }, { now = () => Date.now() } = {}) {
    const { allow, direct, rooms, rate_limit } = policy;
    const window_ms = rate_limit.window * 1000;
    /** @type {number[]} When each send went through in the last window */
    let overall = [];
    /** @type {Map<string, number[]>} */
    const per_target = new Map();

    /**
     * The limit each kind of target is held to, and the rule that names it.
     */
    const limits = {
        contact: {
            max: rate_limit.per_conversation,
            key: 'policy.rate_limit.per_conversation',
            rule: 'rate_conversation',
        },
        room: { max: rate_limit.per_room, key: 'policy.rate_limit.per_room', rule: 'rate_room' },
    };

    /**
     * Drops the sends that have left the window.
     * @param {number[]} sends
     * @param {number} t
     */
    const recent = (sends, t) => sends.filter((sent) => sent > t - window_ms);

    /**
     * The route a send to a contact or a room takes in this mode, if the
     * allowlists let it through at all.
     * @param {string} jid
     * @param {boolean} room
     * @returns {{ allowed: true, route: 'direct'|'draft', kind: 'contact'|'room' } | { allowed: false, rule: string, message: string }}
     */
    function routeOf(jid, room) {
        if (room) {
            if (!rooms.includes(jid)) {
                return refused(
                    'room_allowlist',
                    `Restricted sends are only drafted for the JIDs listed in "policy.rooms" in ${paths.config}, ` +
                        `and ${jid} isn't one of them.`,
                );
            }
            return { allowed: true, route: mode === 'bot' ? 'direct' : 'draft', kind: 'room' };
        }
        // Acting as the user, nothing goes out until the user approves it, so nothing is direct.
        if (jid === owner && mode !== 'as_user') return { allowed: true, route: 'direct', kind: 'contact' };
        if (mode === 'bot' && direct.includes(jid)) return { allowed: true, route: 'direct', kind: 'contact' };
        if (allow.includes(jid)) return { allowed: true, route: 'draft', kind: 'contact' };
        return refused(
            'allowlist',
            `Restricted sends are only drafted for the JIDs listed in "policy.allow" in ${paths.config}, ` +
                `and ${jid} isn't one of them.`,
        );
    }

    return {
        /**
         * Decides how a restricted send to a contact or a room goes: direct,
         * as a draft, or refused. A send that passes the allowlist counts toward
         * the rate limits whichever route it takes, and whatever happens to it
         * afterwards, so a failed send can't be retried for free.
         * @param {string} jid - The bare JID of the recipient, or of the room
         * @param {Object} [target]
         * @param {boolean} [target.room] - Whether the JID is a room
         * @returns {{ allowed: true, route: 'direct'|'draft' } | { allowed: false, rule: string, message: string }}
         */
        admit(jid, { room = false } = {}) {
            return decide(jid, room, true);
        },

        /** Check the current policy without reserving rate-limit capacity. */
        check(jid, { room = false } = {}) {
            return decide(jid, room, false);
        },

        /**
         * Whether restricted access may join or leave a room: only the rooms
         * listed in "policy.rooms".
         * @param {string} jid - The bare JID of the room
         */
        roomAllowed(jid) {
            return rooms.includes(jid);
        },
    };

    function decide(jid, room, consume) {
        const verdict = routeOf(jid, room);
        if (!verdict.allowed) return verdict;

        const t = now();
        overall = recent(overall, t);
        const target = recent(per_target.get(jid) ?? [], t);
        const limit = limits[verdict.kind];
        if (target.length >= limit.max) {
            return refused(
                limit.rule,
                `Too many messages to ${jid} in the last ${rate_limit.window}s (the limit is ` +
                    `${limit.max}). Wait before sending again, or raise "${limit.key}" in ${paths.config}.`,
            );
        }
        if (overall.length >= rate_limit.overall) {
            return refused(
                'rate_overall',
                `Too many messages in the last ${rate_limit.window}s across all conversations (the limit is ` +
                    `${rate_limit.overall}). Wait before sending again, or raise ` +
                    `"policy.rate_limit.overall" in ${paths.config}.`,
            );
        }

        if (consume) {
            overall.push(t);
            per_target.set(jid, [...target, t]);
        }
        return { allowed: true, route: verdict.route };
    }
}

/**
 * @param {string} rule - Names the rule that refused the send
 * @param {string} message - What to do about it
 */
function refused(rule, message) {
    return { allowed: false, rule, message };
}
