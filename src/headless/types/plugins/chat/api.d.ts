declare namespace _default {
    namespace chats {
        /**
         * @method api.chats.create
         * @param {string|string[]} jids An jid or array of jids
         * @param {object} [attrs] An object containing configuration attributes.
         * @returns {Promise<ChatBox|ChatBox[]>}
         */
        function create(jids: string | string[], attrs?: object): Promise<ChatBox | ChatBox[]>;
        /**
         * Opens a new one-on-one chat.
         *
         * @method api.chats.open
         * @param {String|string[]} jids - e.g. 'buddy@example.com' or ['buddy1@example.com', 'buddy2@example.com']
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
        function open(jids: string | string[], attrs?: {
            minimized?: boolean;
        }, force?: boolean): Promise<any>;
        /**
         * Retrieves a chat or all chats.
         *
         * @method api.chats.get
         * @param {String|string[]} jids - e.g. 'buddy@example.com' or ['buddy1@example.com', 'buddy2@example.com']
         * @param {Object} [attrs] - Attributes to be set on the _converse.ChatBox model.
         * @param {Boolean} [create=false] - Whether the chat should be created if it's not found.
         * @returns {Promise<ChatBox[]>}
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
        function get(jids: string | string[], attrs?: any, create?: boolean): Promise<ChatBox[]>;
    }
}
export default _default;
export type ChatBox = import("./model.js").default;
//# sourceMappingURL=api.d.ts.map