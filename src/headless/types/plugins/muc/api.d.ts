declare namespace _default {
    namespace rooms {
        /**
         * Creates a new MUC chatroom (aka groupchat)
         *
         * Similar to {@link api.rooms.open}, but creates
         * the chatroom in the background (i.e. doesn't cause a view to open).
         *
         * @method api.rooms.create
         * @param {(string[]|string)} jids The JID or array of
         *     JIDs of the chatroom(s) to create
         * @param {object} [attrs] attrs The room attributes
         * @returns {Promise[]} Promise which resolves with the Model representing the chat.
         */
        function create(jids: string | string[], attrs?: any): Promise<any>[];
        /**
         * Opens a MUC chatroom (aka groupchat)
         *
         * Similar to {@link api.chats.open}, but for groupchats.
         *
         * @method api.rooms.open
         * @param {string|string[]} jids The room JID or JIDs (if not specified, all
         *     currently open rooms will be returned).
         * @param {object} attrs A map  containing any extra room attributes.
         * @param {string} [attrs.nick] The current user's nickname for the MUC
         * @param {boolean} [attrs.hidden]
         * @param {boolean} [attrs.auto_configure] A boolean, indicating
         *     whether the room should be configured automatically or not.
         *     If set to `true`, then it makes sense to pass in configuration settings.
         * @param {object} [attrs.roomconfig] A map of configuration settings to be used when the room gets
         *     configured automatically. Currently it doesn't make sense to specify
         *     `roomconfig` values if `auto_configure` is set to `false`.
         *     For a list of configuration values that can be passed in, refer to these values
         *     in the [XEP-0045 MUC specification](https://xmpp.org/extensions/xep-0045.html#registrar-formtype-owner).
         *     The values should be named without the `muc#roomconfig_` prefix.
         * @param {boolean} [attrs.minimized] A boolean, indicating whether the room should be opened minimized or not.
         * @param {boolean} [attrs.bring_to_foreground] A boolean indicating whether the room should be
         *     brought to the foreground and therefore replace the currently shown chat.
         *     If there is no chat currently open, then this option is ineffective.
         * @param {boolean} [force=false] - By default, a minimized
         *   room won't be maximized (in `overlayed` view mode) and in
         *   `fullscreen` view mode a newly opened room won't replace
         *   another chat already in the foreground.
         *   Set `force` to `true` if you want to force the room to be
         *   maximized or shown.
         * @returns {Promise<MUC[]>} Promise which resolves with the Model representing the chat.
         *
         * @example
         * api.rooms.open('group@muc.example.com')
         *
         * @example
         * // To return an array of rooms, provide an array of room JIDs:
         * api.rooms.open(['group1@muc.example.com', 'group2@muc.example.com'])
         *
         * @example
         * // To setup a custom nickname when joining the room, provide the optional nick argument:
         * api.rooms.open('group@muc.example.com', {'nick': 'mycustomnick'})
         *
         * @example
         * // For example, opening a room with a specific default configuration:
         * api.rooms.open(
         *     'myroom@conference.example.org',
         *     { 'nick': 'coolguy69',
         *       'auto_configure': true,
         *       'roomconfig': {
         *           'changesubject': false,
         *           'membersonly': true,
         *           'persistentroom': true,
         *           'publicroom': true,
         *           'roomdesc': 'Comfy room for hanging out',
         *           'whois': 'anyone'
         *       }
         *     }
         * );
         */
        function open(jids: string | string[], attrs?: {
            nick?: string;
            hidden?: boolean;
            auto_configure?: boolean;
            roomconfig?: any;
            minimized?: boolean;
            bring_to_foreground?: boolean;
        }, force?: boolean): Promise<import("./muc.js").default[]>;
        /**
         * Fetches the object representing a MUC chatroom (aka groupchat)
         *
         * @method api.rooms.get
         * @param {string|string[]} [jids] The room JID (if not specified, all rooms will be returned).
         * @param {object} [attrs] A map containing any extra room attributes
         *  to be set if `create` is set to `true`
         * @param {string} [attrs.nick] Specify the nickname
         * @param {string} [attrs.password ] Specify a password if needed to enter a new room
         * @param {boolean} create A boolean indicating whether the room should be created
         *     if not found (default: `false`)
         * @returns {Promise<MUC[]>}
         * @example
         * api.waitUntil('roomsAutoJoined').then(() => {
         *     const create_if_not_found = true;
         *     api.rooms.get(
         *         'group@muc.example.com',
         *         {'nick': 'dread-pirate-roberts', 'password': 'secret'},
         *         create_if_not_found
         *     )
         * });
         */
        function get(jids?: string | string[], attrs?: {
            nick?: string;
            password?: string;
        }, create?: boolean): Promise<import("./muc.js").default[]>;
    }
}
export default _default;
export type MUC = import('./muc.js').default;
//# sourceMappingURL=api.d.ts.map