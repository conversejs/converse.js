declare namespace _default {
    namespace version {
        /**
         * Queries an XMPP entity for its software version, as specified in
         * XEP-0092: Software Version.
         *
         * @method api.version.get
         * @param {string} [jid] The JID of the entity to query. If not provided,
         *  the user's own server (the domain part of their JID) is queried.
         * @param {number} [timeout] The amount of time in milliseconds to wait
         *  for a response.
         * @returns {Promise<import('./types').SoftwareVersion|null>} A promise
         *  which resolves with the software version details, or with `null` if
         *  the entity didn't respond or doesn't support XEP-0092.
         * @example
         * const version = await api.version.get();
         * // { name: 'Prosody', version: '0.12.0', os: 'Debian GNU/Linux' }
         */
        function get(jid?: string, timeout?: number): Promise<import("./types").SoftwareVersion | null>;
    }
}
export default _default;
//# sourceMappingURL=api.d.ts.map