import api from '../../shared/api/index.js';

export default {
    /**
     * This API namespace lets you access the BOSH tokens
     * @namespace api.tokens
     * @memberOf api
     */
    tokens: {
        /**
         * @method api.tokens.get
         * @param {string} [id] The type of token to return ('rid' or 'sid').
         * @returns {string} A token, either the RID or SID token depending on what's asked for.
         * @example _converse.api.tokens.get('rid');
         */
        get (id) {
            const connection = api.connection.get();
            if (!connection) return null;

            if (id.toLowerCase() === 'rid') {
                return connection.rid || connection._proto.rid;
            } else if (id.toLowerCase() === 'sid') {
                return connection.sid || connection._proto.sid;
            }
        }
    }

};
