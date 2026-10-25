/**
 * The send policy a restricted connection is held to: which JIDs and rooms a
 * draft may be for, and how fast drafts are made. The daemon applies it to
 * every restricted send. Full access is the user's own, so it isn't policed.
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
export function createPolicy({ policy, paths }, { now = () => Date.now() } = {}) {
    const { allow, rooms, rate_limit } = policy;
    const window_ms = rate_limit.window * 1000;
    /** @type {number[]} When each send went through in the last window */
    let overall = [];
    /** @type {Map<string, number[]>} */
    const per_target = new Map();

    /**
     * Drops the sends that have left the window.
     * @param {number[]} sends
     * @param {number} t
     */
    const recent = (sends, t) => sends.filter((sent) => sent > t - window_ms);

    /**
     * Applies an allowlist and the rate limits to one target: a contact or a
     * room. The attempt counts toward the limits if it passes the allowlist,
     * whatever happens to it afterwards, so a failed send can't be retried for free.
     * @param {string} jid
     * @param {Object} kind
     * @param {string[]} kind.list - The allowlist for this kind of target
     * @param {string} kind.list_key - The config key of that list, for the error message
     * @param {string} kind.allow_rule - Names the rule that refuses a target not on the list
     * @param {number} kind.limit - Sends allowed to one target per window
     * @param {string} kind.limit_key - The config key of that limit, for the error message
     * @param {string} kind.limit_rule - Names the rule that refuses a target over its limit
     */
    function admitTo(jid, { list, list_key, allow_rule, limit, limit_key, limit_rule }) {
        if (!list.includes(jid)) {
            return refused(
                allow_rule,
                `Restricted sends are only drafted for the JIDs listed in "${list_key}" in ${paths.config}, ` +
                    `and ${jid} isn't one of them.`,
            );
        }

        const t = now();
        overall = recent(overall, t);
        const target = recent(per_target.get(jid) ?? [], t);
        if (target.length >= limit) {
            return refused(
                limit_rule,
                `Too many messages to ${jid} in the last ${rate_limit.window}s (the limit is ` +
                    `${limit}). Wait before sending again, or raise "${limit_key}" in ${paths.config}.`,
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

        overall.push(t);
        per_target.set(jid, [...target, t]);
        return { allowed: true };
    }

    return {
        /**
         * Decides whether a send to a contact may go ahead. The attempt counts
         * toward the rate limits if it passes the allowlist.
         * @param {string} jid - The bare JID of the recipient
         * @returns {{ allowed: true } | { allowed: false, rule: string, message: string }}
         */
        admit(jid) {
            return admitTo(jid, {
                list: allow,
                list_key: 'policy.allow',
                allow_rule: 'allowlist',
                limit: rate_limit.per_conversation,
                limit_key: 'policy.rate_limit.per_conversation',
                limit_rule: 'rate_conversation',
            });
        },

        /**
         * Decides whether a send to a room may go ahead.
         * @param {string} jid - The bare JID of the room
         * @returns {{ allowed: true } | { allowed: false, rule: string, message: string }}
         */
        admitRoom(jid) {
            return admitTo(jid, {
                list: rooms,
                list_key: 'policy.rooms',
                allow_rule: 'room_allowlist',
                limit: rate_limit.per_room,
                limit_key: 'policy.rate_limit.per_room',
                limit_rule: 'rate_room',
            });
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
}

/**
 * @param {string} rule - Names the rule that refused the send
 * @param {string} message - What to do about it
 */
function refused(rule, message) {
    return { allowed: false, rule, message };
}
