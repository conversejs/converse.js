/**
 * @typedef {import('./muc.js').default} MUC
 */
import _converse from '../../shared/_converse.js';
import chatboxes from '../../plugins/chatboxes/api.js';
import log from '@converse/log';
import promise_api from '../../shared/api/promise.js';
import { CHATROOMS_TYPE } from '../../shared/constants.js';
import { Strophe } from 'strophe.js';
import { getJIDFromURI } from '../../utils/jid.js';
import { settings_api as settings } from '../../shared/settings/api.js';

const { waitUntil } = promise_api;

/**
 * The "rooms" namespace groups methods relevant to chatrooms
 * (aka groupchats).
 *
 * @namespace api.rooms
 * @memberOf api
 */
const rooms = {
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
     * @returns {Promise<MUC[]|MUC>} Promise which resolves with the Model representing the chat.
     */
    create(jids, attrs = {}) {
        attrs = typeof attrs === 'string' ? { 'nick': attrs } : attrs || {};
        if (!attrs.nick && settings.get('muc_nickname_from_jid')) {
            const bare_jid = _converse.session.get('bare_jid');
            attrs.nick = Strophe.getNodeFromJid(bare_jid);
        }
        if (jids === undefined) {
            throw new TypeError('rooms.create: You need to provide at least one JID');
        } else if (typeof jids === 'string') {
            return rooms.get(getJIDFromURI(jids), attrs, true);
        }
        return Promise.all(jids.map((jid) => /** @type {Promise<MUC>} */ (rooms.get(getJIDFromURI(jid), attrs, true))));
    },

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
     * @param {boolean} [force=false] - By default, a minimized
     *   room won't be maximized (in `overlayed` view mode) and in
     *   `fullscreen` view mode a newly opened room won't replace
     *   another chat already in the foreground.
     *   Set `force` to `true` if you want to force the room to be
     *   maximized or shown.
     * @returns {Promise<MUC[]|MUC>} Promise which resolves with the Model representing the chat.
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
    async open(jids, attrs = {}, force = false) {
        await waitUntil('chatBoxesFetched');
        if (jids === undefined) {
            const err_msg = 'rooms.open: You need to provide at least one JID';
            log.error(err_msg);
            throw new TypeError(err_msg);
        } else if (typeof jids === 'string') {
            const room = /** @type {MUC} */ (await rooms.get(jids, attrs, true));
            !attrs.hidden && room?.maybeShow(force);
            return room;
        } else {
            const rooms = await Promise.all(jids.map((jid) => rooms.get(jid, attrs, true)));
            rooms.forEach((r) => !attrs.hidden && r.maybeShow(force));
            return rooms;
        }
    },

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
     * @returns {Promise<MUC[]|MUC>}
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
    async get(jids, attrs = {}, create = false) {
        await waitUntil('chatBoxesFetched');

        /** @param {string} jid */
        async function _get(jid) {
            jid = getJIDFromURI(jid);
            let model = await chatboxes.get(jid);
            if (!model && create) {
                model = await chatboxes.create(jid, attrs, _converse.exports.MUC);
            } else {
                model = model && model.get('type') === CHATROOMS_TYPE ? model : null;
                if (model && Object.keys(attrs).length) {
                    model.save(attrs);
                }
            }
            return model;
        }
        if (jids === undefined) {
            const chats = await chatboxes.get();
            return chats.filter((c) => c.get('type') === CHATROOMS_TYPE);
        } else if (typeof jids === 'string') {
            return _get(jids);
        }
        return Promise.all(jids.map((jid) => _get(jid)));
    },
};

const rooms_api = { rooms };

export default rooms_api;
