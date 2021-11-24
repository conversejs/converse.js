import log from '../../log';
import u from '../../utils/form';
import { Strophe } from 'strophe.js/src/strophe';
import { _converse, api } from '../../core.js';


export default {
    /**
     * The "rooms" namespace groups methods relevant to chatrooms
     * (aka groupchats).
     *
     * @namespace api.rooms
     * @memberOf api
     */
    rooms: {
        /**
         * Creates a new MUC chatroom (aka groupchat)
         *
         * Similar to {@link api.rooms.open}, but creates
         * the chatroom in the background (i.e. doesn't cause a view to open).
         *
         * @method api.rooms.create
         * @param {(string[]|string)} jid|jids The JID or array of
         *     JIDs of the chatroom(s) to create
         * @param {object} [attrs] attrs The room attributes
         * @returns {Promise} Promise which resolves with the Model representing the chat.
         */
        create (jids, attrs = {}) {
            attrs = typeof attrs === 'string' ? { 'nick': attrs } : attrs || {};
            if (!attrs.nick && api.settings.get('muc_nickname_from_jid')) {
                attrs.nick = Strophe.getNodeFromJid(_converse.bare_jid);
            }
            if (jids === undefined) {
                throw new TypeError('rooms.create: You need to provide at least one JID');
            } else if (typeof jids === 'string') {
                return api.rooms.get(u.getJIDFromURI(jids), attrs, true);
            }
            return jids.map(jid => api.rooms.get(u.getJIDFromURI(jid), attrs, true));
        },

        /**
         * Opens a MUC chatroom (aka groupchat)
         *
         * Similar to {@link api.chats.open}, but for groupchats.
         *
         * @method api.rooms.open
         * @param {string} jid The room JID or JIDs (if not specified, all
         *     currently open rooms will be returned).
         * @param {string} attrs A map  containing any extra room attributes.
         * @param {string} [attrs.nick] The current user's nickname for the MUC
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
         * @param {Boolean} [force=false] - By default, a minimized
         *   room won't be maximized (in `overlayed` view mode) and in
         *   `fullscreen` view mode a newly opened room won't replace
         *   another chat already in the foreground.
         *   Set `force` to `true` if you want to force the room to be
         *   maximized or shown.
         * @returns {Promise} Promise which resolves with the Model representing the chat.
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
        async open (jids, attrs = {}, force = false) {
            await api.waitUntil('chatBoxesFetched');
            if (jids === undefined) {
                const err_msg = 'rooms.open: You need to provide at least one JID';
                log.error(err_msg);
                throw new TypeError(err_msg);
            } else if (typeof jids === 'string') {
                const room = await api.rooms.get(jids, attrs, true);
                !attrs.hidden && room?.maybeShow(force);
                return room;
            } else {
                const rooms = await Promise.all(jids.map(jid => api.rooms.get(jid, attrs, true)));
                rooms.forEach(r => !attrs.hidden && r.maybeShow(force));
                return rooms;
            }
        },

        /**
         * Fetches the object representing a MUC chatroom (aka groupchat)
         *
         * @method api.rooms.get
         * @param { String } [jid] The room JID (if not specified, all rooms will be returned).
         * @param { Object } [attrs] A map containing any extra room attributes
         *  to be set if `create` is set to `true`
         * @param { String } [attrs.nick] Specify the nickname
         * @param { String } [attrs.password ] Specify a password if needed to enter a new room
         * @param { Boolean } create A boolean indicating whether the room should be created
         *     if not found (default: `false`)
         * @returns { Promise<_converse.ChatRoom> }
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
        async get (jids, attrs = {}, create = false) {
            await api.waitUntil('chatBoxesFetched');

            async function _get (jid) {
                jid = u.getJIDFromURI(jid);
                let model = await api.chatboxes.get(jid);
                if (!model && create) {
                    model = await api.chatboxes.create(jid, attrs, _converse.ChatRoom);
                } else {
                    model = model && model.get('type') === _converse.CHATROOMS_TYPE ? model : null;
                    if (model && Object.keys(attrs).length) {
                        model.save(attrs);
                    }
                }
                return model;
            }
            if (jids === undefined) {
                const chats = await api.chatboxes.get();
                return chats.filter(c => c.get('type') === _converse.CHATROOMS_TYPE);
            } else if (typeof jids === 'string') {
                return _get(jids);
            }
            return Promise.all(jids.map(jid => _get(jid)));
        }
    }
}
