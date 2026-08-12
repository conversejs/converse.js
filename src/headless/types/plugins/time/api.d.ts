declare namespace _default {
    namespace time {
        /**
         * Gets the entity time from a JID per XEP-0202
         * @method api.time.get
         * @param {string} jid - The JID to query for time
         * @param {number} [timeout=10000] - Timeout in milliseconds
         * @returns {Promise<import('./types').EntityTime|null>} The entity's
         *  time info, or `null` if the entity didn't respond or doesn't
         *  support XEP-0202.
         */
        function get(jid: string, timeout?: number): Promise<import("./types").EntityTime | null>;
    }
}
export default _default;
//# sourceMappingURL=api.d.ts.map