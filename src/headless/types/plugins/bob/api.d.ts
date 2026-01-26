declare namespace _default {
    namespace bob {
        /**
         * Check if CID is cached
         * @param {string} cid
         * @returns {Promise<boolean>}
         */
        function has(cid: string): Promise<boolean>;
        /**
         * Store BOB data in persistent cache
         * @param {string} cid
         * @param {string} data - Base64 encoded data
         * @param {string} type - MIME type
         * @param {number} [max_age=86400] - Max age in seconds
         */
        function store(cid: string, data: string, type: string, max_age?: number): Promise<void>;
        /**
         * Get BOB data as Blob URL
         * @param {string} cid
         * @param {string} [from_jid] - JID to request from if not cached
         * @returns {Promise<string|null>} - Blob URL or null
         */
        function get(cid: string, from_jid?: string): Promise<string | null>;
        /**
         * Fetch BOB data via IQ-get
         * @param {string} cid
         * @param {string} from_jid
         * @returns {Promise<void>}
         */
        function fetch(cid: string, from_jid: string): Promise<void>;
    }
}
export default _default;
//# sourceMappingURL=api.d.ts.map