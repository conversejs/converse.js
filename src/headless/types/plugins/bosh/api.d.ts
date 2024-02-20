declare namespace _default {
    namespace tokens {
        /**
         * @method api.tokens.get
         * @param {string} [id] The type of token to return ('rid' or 'sid').
         * @returns {string} A token, either the RID or SID token depending on what's asked for.
         * @example _converse.api.tokens.get('rid');
         */
        function get(id?: string): string;
    }
}
export default _default;
//# sourceMappingURL=api.d.ts.map