/**
 * The send policy a restricted connection is held to: which JIDs it may
 * message, and how fast. The daemon applies it to every restricted send. Full
 * access is the user's own, so it isn't policed.
 * @module @converse/daemon/policy
 */

/**
 * @param {import('./types').Config} config
 * @param {Object} [options]
 * @param {() => number} [options.now] - Milliseconds since the epoch
 */
export function createPolicy({ policy, paths }, { now = () => Date.now() } = {}) {
    const { allow, rate_limit } = policy;
    const window_ms = rate_limit.window * 1000;
    /** @type {number[]} When each send went through in the last window */
    let overall = [];
    /** @type {Map<string, number[]>} */
    const per_conversation = new Map();

    /**
     * Drops the sends that have left the window.
     * @param {number[]} sends
     * @param {number} t
     */
    const recent = (sends, t) => sends.filter((sent) => sent > t - window_ms);

    return {
        /**
         * Decides whether a send to `jid` may go ahead. The attempt counts
         * toward the rate limits if it passes the allowlist, whatever happens
         * to it afterwards, so a failed send can't be retried for free.
         * @param {string} jid - The bare JID of the recipient
         * @returns {{ allowed: true } | { allowed: false, rule: string, message: string }}
         */
        admit(jid) {
            if (!allow.includes(jid)) {
                return refused(
                    'allowlist',
                    `Restricted sends only go to the JIDs listed in "policy.allow" in ${paths.config}, ` +
                        `and ${jid} isn't one of them.`,
                );
            }

            const t = now();
            overall = recent(overall, t);
            const conversation = recent(per_conversation.get(jid) ?? [], t);
            if (conversation.length >= rate_limit.per_conversation) {
                return refused(
                    'rate_conversation',
                    `Too many messages to ${jid} in the last ${rate_limit.window}s (the limit is ` +
                        `${rate_limit.per_conversation}). Wait before sending again, or raise ` +
                        `"policy.rate_limit.per_conversation" in ${paths.config}.`,
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
            per_conversation.set(jid, [...conversation, t]);
            return { allowed: true };
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
