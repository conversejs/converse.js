import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from '../../log.js';
import { MUC_ROLE_WEIGHTS } from './constants.js';
import { safeSave } from '../../utils/index.js';
import { CHATROOMS_TYPE } from '../../shared/constants.js';
import { getUnloadEvent } from '../../utils/session.js';

const { Strophe, sizzle, u } = converse.env;

/**
 * @param {import('@converse/skeletor').Model} model
 */
export function isChatRoom (model) {
    return model?.get('type') === 'chatroom';
}

export function shouldCreateGroupchatMessage (attrs) {
    return attrs.nick && (u.shouldCreateMessage(attrs) || attrs.is_tombstone);
}

/**
 * @param {import('./occupant').default} occupant1
 * @param {import('./occupant').default} occupant2
 */
export function occupantsComparator (occupant1, occupant2) {
    const role1 = occupant1.get('role') || 'none';
    const role2 = occupant2.get('role') || 'none';
    if (MUC_ROLE_WEIGHTS[role1] === MUC_ROLE_WEIGHTS[role2]) {
        const nick1 = occupant1.getDisplayName().toLowerCase();
        const nick2 = occupant2.getDisplayName().toLowerCase();
        return nick1 < nick2 ? -1 : nick1 > nick2 ? 1 : 0;
    } else {
        return MUC_ROLE_WEIGHTS[role1] < MUC_ROLE_WEIGHTS[role2] ? -1 : 1;
    }
}

export function registerDirectInvitationHandler () {
    api.connection.get().addHandler(
        (message) => {
            _converse.exports.onDirectMUCInvitation(message);
            return true;
        },
        'jabber:x:conference',
        'message'
    );
}

export function disconnectChatRooms () {
    /* When disconnecting, mark all groupchats as
     * disconnected, so that they will be properly entered again
     * when fetched from session storage.
     */
    return _converse.state.chatboxes
        .filter(m => m.get('type') === CHATROOMS_TYPE)
        .forEach(m => m.session.save({ 'connection_status': converse.ROOMSTATUS.DISCONNECTED }));
}

export async function onWindowStateChanged () {
    if (!document.hidden && api.connection.connected()) {
        const rooms = await api.rooms.get();
        rooms.forEach(room => room.rejoinIfNecessary());
    }
}

/**
 * @param {Event} [event]
 */
export async function routeToRoom (event) {
    if (!location.hash.startsWith('#converse/room?jid=')) {
        return;
    }
    event?.preventDefault();
    const jid = location.hash.split('=').pop();
    if (!u.isValidMUCJID(jid)) {
        return log.warn(`invalid jid "${jid}" provided in url fragment`);
    }
    await api.waitUntil('roomsAutoJoined');
    if (api.settings.get('allow_bookmarks')) {
        await api.waitUntil('bookmarksInitialized');
    }
    api.rooms.open(jid, {}, true);
}

/* Opens a groupchat, making sure that certain attributes
 * are correct, for example that the "type" is set to
 * "chatroom".
 * @param {string} jid
 * @param {Object} settings
 */
export async function openChatRoom (jid, settings) {
    settings.type = CHATROOMS_TYPE;
    settings.id = jid;
    const chatbox = await api.rooms.get(jid, settings, true);
    chatbox.maybeShow(true);
    return chatbox;
}


/**
 * A direct MUC invitation to join a groupchat has been received
 * See XEP-0249: Direct MUC invitations.
 * @private
 * @method _converse.ChatRoom#onDirectMUCInvitation
 * @param {Element} message - The message stanza containing the invitation.
 */
export async function onDirectMUCInvitation (message) {
    const x_el = sizzle('x[xmlns="jabber:x:conference"]', message).pop(),
        from = Strophe.getBareJidFromJid(message.getAttribute('from')),
        room_jid = x_el.getAttribute('jid'),
        reason = x_el.getAttribute('reason');

    let result;
    if (api.settings.get('auto_join_on_invite')) {
        result = true;
    } else {
        // Invite request might come from someone not your roster list
        const contact = _converse.state.roster.get(from)?.getDisplayName() ?? from;

        /**
         * *Hook* which is used to gather confirmation whether a direct MUC
         * invitation should be accepted or not.
         *
         * It's meant for consumers of `@converse/headless` to subscribe to
         * this hook and then ask the user to confirm.
         *
         * @event _converse#confirmDirectMUCInvitation
         */
        result = await api.hook('confirmDirectMUCInvitation', { contact, reason, jid: room_jid }, false);
    }

    if (result) {
        const chatroom = await openChatRoom(room_jid, { 'password': x_el.getAttribute('password') });
        if (chatroom.session.get('connection_status') === converse.ROOMSTATUS.DISCONNECTED) {
            _converse.state.chatboxes.get(room_jid).rejoin();
        }
    }
}

export function getDefaultMUCNickname () {
    // XXX: if anything changes here, update the docs for the
    // locked_muc_nickname setting.
    const { xmppstatus } = _converse.state;
    if (!xmppstatus) {
        log.error("Called getDefaultMUCNickname before statusInitialized has been fired.");
        return '';

    }
    const nick = xmppstatus.getNickname();
    if (nick) {
        return nick;
    } else if (api.settings.get('muc_nickname_from_jid')) {
        const bare_jid = _converse.session.get('bare_jid');
        return Strophe.unescapeNode(Strophe.getNodeFromJid(bare_jid));
    }
}

/**
 * Determines info message visibility based on
 * muc_show_info_messages configuration setting
 * @param {import('./types').MUCStatusCode} code
 * @memberOf _converse
 */
export function isInfoVisible (code) {
    const info_messages = api.settings.get('muc_show_info_messages');
    if (info_messages.includes(code)) {
        return true;
    }
    return false;
}


/**
 * Automatically join groupchats, based on the
 * "auto_join_rooms" configuration setting, which is an array
 * of strings (groupchat JIDs) or objects (with groupchat JID and other settings).
 */
export async function autoJoinRooms () {
    await Promise.all(
        api.settings.get('auto_join_rooms').map(muc => {
            if (typeof muc === 'string') {
                if (_converse.state.chatboxes.where({ 'jid': muc }).length) {
                    return Promise.resolve();
                }
                return api.rooms.open(muc);
            } else if (muc instanceof Object) {
                return api.rooms.open(muc.jid, { ...muc });
            } else {
                log.error('Invalid muc criteria specified for "auto_join_rooms"');
                return Promise.resolve();
            }
        })
    );
    /**
     * Triggered once any rooms that have been configured to be automatically joined,
     * specified via the _`auto_join_rooms` setting, have been entered.
     * @event _converse#roomsAutoJoined
     * @example _converse.api.listen.on('roomsAutoJoined', () => { ... });
     * @example _converse.api.waitUntil('roomsAutoJoined').then(() => { ... });
     */
    api.trigger('roomsAutoJoined');
}


export function onAddClientFeatures () {
    api.disco.own.features.add(Strophe.NS.MUC);

    if (api.settings.get('allow_muc_invitations')) {
        api.disco.own.features.add('jabber:x:conference'); // Invites
    }
}

export function onBeforeTearDown () {
    _converse.state.chatboxes
        .where({ 'type': CHATROOMS_TYPE })
        .forEach(muc => safeSave(muc.session, { 'connection_status': converse.ROOMSTATUS.DISCONNECTED }));
}

export function onStatusInitialized () {
    window.addEventListener(getUnloadEvent(), () => {
        const using_websocket = api.connection.isType('websocket');
        if (
            using_websocket &&
            (!api.settings.get('enable_smacks') || !_converse.session.get('smacks_stream_id'))
        ) {
            // For non-SMACKS websocket connections, or non-resumeable
            // connections, we disconnect all chatrooms when the page unloads.
            // See issue #1111
            disconnectChatRooms();
        }
    });
}

export function onBeforeResourceBinding () {
    api.connection.get().addHandler(
        /** @param {Element} stanza */
        (stanza) => {
            const muc_jid = Strophe.getBareJidFromJid(stanza.getAttribute('from'));
            if (!_converse.state.chatboxes.get(muc_jid)) {
                api.waitUntil('chatBoxesFetched').then(async () => {
                    const muc = _converse.state.chatboxes.get(muc_jid);
                    if (muc) {
                        await muc.initialized;
                        muc.message_handler.run(stanza);
                    }
                });
            }
            return true;
        },
        null,
        'message',
        'groupchat'
    );
}
