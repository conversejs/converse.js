import { _converse, api } from "@converse/headless/core";

export default {
    /**
     * The "headlines" namespace, which is used for headline-channels
     * which are read-only channels containing messages of type
     * "headline".
     *
     * @namespace api.headlines
     * @memberOf api
     */
    headlines: {
        /**
         * Retrieves a headline-channel or all headline-channels.
         *
         * @method api.headlines.get
         * @param {String|String[]} jids - e.g. 'buddy@example.com' or ['buddy1@example.com', 'buddy2@example.com']
         * @param {Object} [attrs] - Attributes to be set on the _converse.ChatBox model.
         * @param {Boolean} [create=false] - Whether the chat should be created if it's not found.
         * @returns { Promise<_converse.HeadlinesFeed> }
         */
        async get (jids, attrs={}, create=false) {
            async function _get (jid) {
                let model = await api.chatboxes.get(jid);
                if (!model && create) {
                    model = await api.chatboxes.create(jid, attrs, _converse.HeadlinesFeed);
                } else {
                    model = (model && model.get('type') === _converse.HEADLINES_TYPE) ? model : null;
                    if (model && Object.keys(attrs).length) {
                        model.save(attrs);
                    }
                }
                return model;
            }
            if (jids === undefined) {
                const chats = await api.chatboxes.get();
                return chats.filter(c => (c.get('type') === _converse.HEADLINES_TYPE));
            } else if (typeof jids === 'string') {
                return _get(jids);
            }
            return Promise.all(jids.map(jid => _get(jid)));
        }
    }
};
