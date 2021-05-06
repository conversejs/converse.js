import { _converse, api } from "../../core.js";
import log from "../../log.js";


export default {
    /**
     * The "chats" namespace (used for one-on-one chats)
     *
     * @namespace api.chats
     * @memberOf api
     */
    chats: {
        /**
         * @method api.chats.create
         * @param {string|string[]} jid|jids An jid or array of jids
         * @param {object} [attrs] An object containing configuration attributes.
         */
        async create (jids, attrs) {
            if (typeof jids === 'string') {
                if (attrs && !attrs?.fullname) {
                    const contact = await api.contacts.get(jids);
                    attrs.fullname = contact?.attributes?.fullname;
                }
                const chatbox = api.chats.get(jids, attrs, true);
                if (!chatbox) {
                    log.error("Could not open chatbox for JID: "+jids);
                    return;
                }
                return chatbox;
            }
            if (Array.isArray(jids)) {
                return Promise.all(jids.forEach(async jid => {
                    const contact = await api.contacts.get(jids);
                    attrs.fullname = contact?.attributes?.fullname;
                    return api.chats.get(jid, attrs, true).maybeShow();
                }));
            }
            log.error("chats.create: You need to provide at least one JID");
            return null;
        },

        /**
         * Opens a new one-on-one chat.
         *
         * @method api.chats.open
         * @param {String|string[]} name - e.g. 'buddy@example.com' or ['buddy1@example.com', 'buddy2@example.com']
         * @param {Object} [attrs] - Attributes to be set on the _converse.ChatBox model.
         * @param {Boolean} [attrs.minimized] - Should the chat be created in minimized state.
         * @param {Boolean} [force=false] - By default, a minimized
         *   chat won't be maximized (in `overlayed` view mode) and in
         *   `fullscreen` view mode a newly opened chat won't replace
         *   another chat already in the foreground.
         *   Set `force` to `true` if you want to force the chat to be
         *   maximized or shown.
         * @returns {Promise} Promise which resolves with the
         *   _converse.ChatBox representing the chat.
         *
         * @example
         * // To open a single chat, provide the JID of the contact you're chatting with in that chat:
         * converse.plugins.add('myplugin', {
         *     initialize: function() {
         *         const _converse = this._converse;
         *         // Note, buddy@example.org must be in your contacts roster!
         *         api.chats.open('buddy@example.com').then(chat => {
         *             // Now you can do something with the chat model
         *         });
         *     }
         * });
         *
         * @example
         * // To open an array of chats, provide an array of JIDs:
         * converse.plugins.add('myplugin', {
         *     initialize: function () {
         *         const _converse = this._converse;
         *         // Note, these users must first be in your contacts roster!
         *         api.chats.open(['buddy1@example.com', 'buddy2@example.com']).then(chats => {
         *             // Now you can do something with the chat models
         *         });
         *     }
         * });
         */
        async open (jids, attrs, force) {
            if (typeof jids === 'string') {
                const chat = await api.chats.get(jids, attrs, true);
                if (chat) {
                    return chat.maybeShow(force);
                }
                return chat;
            } else if (Array.isArray(jids)) {
                return Promise.all(
                    jids.map(j => api.chats.get(j, attrs, true).then(c => c && c.maybeShow(force)))
                        .filter(c => c)
                );
            }
            const err_msg = "chats.open: You need to provide at least one JID";
            log.error(err_msg);
            throw new Error(err_msg);
        },

        /**
         * Retrieves a chat or all chats.
         *
         * @method api.chats.get
         * @param {String|string[]} jids - e.g. 'buddy@example.com' or ['buddy1@example.com', 'buddy2@example.com']
         * @param {Object} [attrs] - Attributes to be set on the _converse.ChatBox model.
         * @param {Boolean} [create=false] - Whether the chat should be created if it's not found.
         * @returns { Promise<_converse.ChatBox> }
         *
         * @example
         * // To return a single chat, provide the JID of the contact you're chatting with in that chat:
         * const model = await api.chats.get('buddy@example.com');
         *
         * @example
         * // To return an array of chats, provide an array of JIDs:
         * const models = await api.chats.get(['buddy1@example.com', 'buddy2@example.com']);
         *
         * @example
         * // To return all open chats, call the method without any parameters::
         * const models = await api.chats.get();
         *
         */
        async get (jids, attrs={}, create=false) {
            await api.waitUntil('chatBoxesFetched');

            async function _get (jid) {
                let model = await api.chatboxes.get(jid);
                if (!model && create) {
                    model = await api.chatboxes.create(jid, attrs, _converse.ChatBox);
                } else {
                    model = (model && model.get('type') === _converse.PRIVATE_CHAT_TYPE) ? model : null;
                    if (model && Object.keys(attrs).length) {
                        model.save(attrs);
                    }
                }
                return model;
            }
            if (jids === undefined) {
                const chats = await api.chatboxes.get();
                return chats.filter(c => (c.get('type') === _converse.PRIVATE_CHAT_TYPE));
            } else if (typeof jids === 'string') {
                return _get(jids);
            }
            return Promise.all(jids.map(jid => _get(jid)));
        }
    }
}
