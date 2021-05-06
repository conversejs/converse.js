/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Implements the non-view logic for XEP-0045 Multi-User Chat
 */
import '../chat/index.js';
import '../disco/index.js';
import '../emoji/index.js';
import ChatRoomMessageMixin from './message.js';
import ChatRoomMixin from './muc.js';
import ChatRoomOccupant from './occupant.js';
import ChatRoomOccupants from './occupants.js';
import affiliations_api from './affiliations/api.js';
import isObject from 'lodash-es/isObject';
import log from '@converse/headless/log';
import muc_api from './api.js';
import u from '../../utils/form';
import { Collection } from '@converse/skeletor/src/collection';
import { _converse, api, converse } from '../../core.js';
import { computeAffiliationsDelta } from './affiliations/utils.js';

export const ROLES = ['moderator', 'participant', 'visitor'];
export const AFFILIATIONS = ['owner', 'admin', 'member', 'outcast', 'none'];

converse.AFFILIATION_CHANGES = {
    OWNER: 'owner',
    ADMIN: 'admin',
    MEMBER: 'member',
    EXADMIN: 'exadmin',
    EXOWNER: 'exowner',
    EXOUTCAST: 'exoutcast',
    EXMEMBER: 'exmember'
};
converse.AFFILIATION_CHANGES_LIST = Object.values(converse.AFFILIATION_CHANGES);
converse.MUC_TRAFFIC_STATES = { ENTERED: 'entered', EXITED: 'exited' };
converse.MUC_TRAFFIC_STATES_LIST = Object.values(converse.MUC_TRAFFIC_STATES);
converse.MUC_ROLE_CHANGES = { OP: 'op', DEOP: 'deop', VOICE: 'voice', MUTE: 'mute' };
converse.MUC_ROLE_CHANGES_LIST = Object.values(converse.MUC_ROLE_CHANGES);

converse.MUC = {};

converse.MUC.INFO_CODES = {
    'visibility_changes': ['100', '102', '103', '172', '173', '174'],
    'self': ['110'],
    'non_privacy_changes': ['104', '201'],
    'muc_logging_changes': ['170', '171'],
    'nickname_changes': ['210', '303'],
    'disconnected': ['301', '307', '321', '322', '332', '333'],
    'affiliation_changes': [...converse.AFFILIATION_CHANGES_LIST],
    'join_leave_events': [...converse.MUC_TRAFFIC_STATES_LIST],
    'role_changes': [...converse.MUC_ROLE_CHANGES_LIST]
};

const { Strophe, sizzle } = converse.env;

// Add Strophe Namespaces
Strophe.addNamespace('MUC_ADMIN', Strophe.NS.MUC + '#admin');
Strophe.addNamespace('MUC_OWNER', Strophe.NS.MUC + '#owner');
Strophe.addNamespace('MUC_REGISTER', 'jabber:iq:register');
Strophe.addNamespace('MUC_ROOMCONF', Strophe.NS.MUC + '#roomconfig');
Strophe.addNamespace('MUC_USER', Strophe.NS.MUC + '#user');
Strophe.addNamespace('MUC_HATS', 'xmpp:prosody.im/protocol/hats:1');

converse.MUC_NICK_CHANGED_CODE = '303';

converse.ROOM_FEATURES = [
    'passwordprotected',
    'unsecured',
    'hidden',
    'publicroom',
    'membersonly',
    'open',
    'persistent',
    'temporary',
    'nonanonymous',
    'semianonymous',
    'moderated',
    'unmoderated',
    'mam_enabled'
];

// No longer used in code, but useful as reference.
//
// const ROOM_FEATURES_MAP = {
//     'passwordprotected': 'unsecured',
//     'unsecured': 'passwordprotected',
//     'hidden': 'publicroom',
//     'publicroom': 'hidden',
//     'membersonly': 'open',
//     'open': 'membersonly',
//     'persistent': 'temporary',
//     'temporary': 'persistent',
//     'nonanonymous': 'semianonymous',
//     'semianonymous': 'nonanonymous',
//     'moderated': 'unmoderated',
//     'unmoderated': 'moderated'
// };

converse.ROOMSTATUS = {
    CONNECTED: 0,
    CONNECTING: 1,
    NICKNAME_REQUIRED: 2,
    PASSWORD_REQUIRED: 3,
    DISCONNECTED: 4,
    ENTERED: 5,
    DESTROYED: 6,
    BANNED: 7
};


function registerDirectInvitationHandler () {
    _converse.connection.addHandler(
        message => {
            _converse.onDirectMUCInvitation(message);
            return true;
        },
        'jabber:x:conference',
        'message'
    );
}

function disconnectChatRooms () {
    /* When disconnecting, mark all groupchats as
     * disconnected, so that they will be properly entered again
     * when fetched from session storage.
     */
    return _converse.chatboxes
        .filter(m => m.get('type') === _converse.CHATROOMS_TYPE)
        .forEach(m => m.session.save({ 'connection_status': converse.ROOMSTATUS.DISCONNECTED }));
}

async function onWindowStateChanged (data) {
    if (data.state === 'visible' && api.connection.connected()) {
        const rooms = await api.rooms.get();
        rooms.forEach(room => room.rejoinIfNecessary());
    }
}

async function routeToRoom (jid) {
    if (!u.isValidMUCJID(jid)) {
        return log.warn(`invalid jid "${jid}" provided in url fragment`);
    }
    await api.waitUntil('roomsAutoJoined');
    if (api.settings.get('allow_bookmarks')) {
        await api.waitUntil('bookmarksInitialized');
    }
    api.rooms.open(jid);
}

/* Opens a groupchat, making sure that certain attributes
 * are correct, for example that the "type" is set to
 * "chatroom".
 */
async function openChatRoom (jid, settings) {
    settings.type = _converse.CHATROOMS_TYPE;
    settings.id = jid;
    const chatbox = await api.rooms.get(jid, settings, true);
    chatbox.maybeShow(true);
    return chatbox;
}

/* Automatically join groupchats, based on the
 * "auto_join_rooms" configuration setting, which is an array
 * of strings (groupchat JIDs) or objects (with groupchat JID and other settings).
 */
async function autoJoinRooms () {
    await Promise.all(
        api.settings.get('auto_join_rooms').map(muc => {
            if (typeof muc === 'string') {
                if (_converse.chatboxes.where({ 'jid': muc }).length) {
                    return Promise.resolve();
                }
                return api.rooms.open(muc);
            } else if (isObject(muc)) {
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


converse.plugins.add('converse-muc', {
    /* Optional dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin. They are called "optional" because they might not be
     * available, in which case any overrides applicable to them will be
     * ignored.
     *
     * It's possible however to make optional dependencies non-optional.
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found.
     *
     * NB: These plugins need to have already been loaded via require.js.
     */
    dependencies: ['converse-chatboxes', 'converse-chat', 'converse-disco', 'converse-controlbox'],

    overrides: {
        ChatBoxes: {
            model (attrs, options) {
                const { _converse } = this.__super__;
                if (attrs && attrs.type == _converse.CHATROOMS_TYPE) {
                    return new _converse.ChatRoom(attrs, options);
                } else {
                    return this.__super__.model.apply(this, arguments);
                }
            }
        }
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { __, ___ } = _converse;

        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        api.settings.extend({
            'allow_muc': true,
            'allow_muc_invitations': true,
            'auto_join_on_invite': false,
            'auto_join_rooms': [],
            'auto_register_muc_nickname': false,
            'hide_muc_participants': false,
            'locked_muc_domain': false,
            'muc_clear_messages_on_leave': true,
            'muc_domain': undefined,
            'muc_fetch_members': true,
            'muc_history_max_stanzas': undefined,
            'muc_instant_rooms': true,
            'muc_nickname_from_jid': false,
            'muc_send_probes': false,
            'muc_show_info_messages': [
                ...converse.MUC.INFO_CODES.visibility_changes,
                ...converse.MUC.INFO_CODES.self,
                ...converse.MUC.INFO_CODES.non_privacy_changes,
                ...converse.MUC.INFO_CODES.muc_logging_changes,
                ...converse.MUC.INFO_CODES.nickname_changes,
                ...converse.MUC.INFO_CODES.disconnected,
                ...converse.MUC.INFO_CODES.affiliation_changes,
                ...converse.MUC.INFO_CODES.join_leave_events,
                ...converse.MUC.INFO_CODES.role_changes
            ],
            'muc_show_logs_before_join': false,
            'muc_show_ogp_unfurls': true,
            'muc_subscribe_to_rai': false,
        });
        api.promises.add(['roomsAutoJoined']);

        if (api.settings.get('locked_muc_domain') && typeof api.settings.get('muc_domain') !== 'string') {
            throw new Error(
                'Config Error: it makes no sense to set locked_muc_domain ' + 'to true when muc_domain is not set'
            );
        }

        // This is for tests (at least until we can import modules inside tests)
        converse.env.muc_utils = { computeAffiliationsDelta };
        Object.assign(api, muc_api);
        Object.assign(api.rooms, affiliations_api);

        /* https://xmpp.org/extensions/xep-0045.html
         * ----------------------------------------
         * 100 message      Entering a groupchat         Inform user that any occupant is allowed to see the user's full JID
         * 101 message (out of band)                     Affiliation change  Inform user that his or her affiliation changed while not in the groupchat
         * 102 message      Configuration change         Inform occupants that groupchat now shows unavailable members
         * 103 message      Configuration change         Inform occupants that groupchat now does not show unavailable members
         * 104 message      Configuration change         Inform occupants that a non-privacy-related groupchat configuration change has occurred
         * 110 presence     Any groupchat presence       Inform user that presence refers to one of its own groupchat occupants
         * 170 message or initial presence               Configuration change    Inform occupants that groupchat logging is now enabled
         * 171 message      Configuration change         Inform occupants that groupchat logging is now disabled
         * 172 message      Configuration change         Inform occupants that the groupchat is now non-anonymous
         * 173 message      Configuration change         Inform occupants that the groupchat is now semi-anonymous
         * 174 message      Configuration change         Inform occupants that the groupchat is now fully-anonymous
         * 201 presence     Entering a groupchat         Inform user that a new groupchat has been created
         * 210 presence     Entering a groupchat         Inform user that the service has assigned or modified the occupant's roomnick
         * 301 presence     Removal from groupchat       Inform user that he or she has been banned from the groupchat
         * 303 presence     Exiting a groupchat          Inform all occupants of new groupchat nickname
         * 307 presence     Removal from groupchat       Inform user that he or she has been kicked from the groupchat
         * 321 presence     Removal from groupchat       Inform user that he or she is being removed from the groupchat because of an affiliation change
         * 322 presence     Removal from groupchat       Inform user that he or she is being removed from the groupchat because the groupchat has been changed to members-only and the user is not a member
         * 332 presence     Removal from groupchat       Inform user that he or she is being removed from the groupchat because of a system shutdown
         */
        _converse.muc = {
            info_messages: {
                100: __('This groupchat is not anonymous'),
                102: __('This groupchat now shows unavailable members'),
                103: __('This groupchat does not show unavailable members'),
                104: __('The groupchat configuration has changed'),
                170: __('Groupchat logging is now enabled'),
                171: __('Groupchat logging is now disabled'),
                172: __('This groupchat is now no longer anonymous'),
                173: __('This groupchat is now semi-anonymous'),
                174: __('This groupchat is now fully-anonymous'),
                201: __('A new groupchat has been created')
            },

            new_nickname_messages: {
                // XXX: Note the triple underscore function and not double underscore.
                210: ___('Your nickname has been automatically set to %1$s'),
                303: ___('Your nickname has been changed to %1$s')
            },

            disconnect_messages: {
                301: __('You have been banned from this groupchat'),
                333: __('You have exited this groupchat due to a technical problem'),
                307: __('You have been kicked from this groupchat'),
                321: __('You have been removed from this groupchat because of an affiliation change'),
                322: __(
                    "You have been removed from this groupchat because the groupchat has changed to members-only and you're not a member"
                ),
                332: __('You have been removed from this groupchat because the service hosting it is being shut down')
            }
        };

        /**
         * Determines info message visibility based on
         * muc_show_info_messages configuration setting
         * @param {*} code
         * @memberOf _converse
         */
        _converse.isInfoVisible = function (code) {
            const info_messages = api.settings.get('muc_show_info_messages');
            if (info_messages.includes(code)) {
                return true;
            }
            return false;
        };

        _converse.router.route('converse/room?jid=:jid', routeToRoom);

        _converse.ChatRoom = _converse.ChatBox.extend(ChatRoomMixin);
        _converse.ChatRoomMessage = _converse.Message.extend(ChatRoomMessageMixin);
        _converse.ChatRoomOccupants = ChatRoomOccupants;
        _converse.ChatRoomOccupant = ChatRoomOccupant;

        _converse.getDefaultMUCNickname = function () {
            // XXX: if anything changes here, update the docs for the
            // locked_muc_nickname setting.
            if (!_converse.xmppstatus) {
                throw new Error(
                    "Can't call _converse.getDefaultMUCNickname before the statusInitialized has been fired."
                );
            }
            const nick = _converse.xmppstatus.getNickname();
            if (nick) {
                return nick;
            } else if (api.settings.get('muc_nickname_from_jid')) {
                return Strophe.unescapeNode(Strophe.getNodeFromJid(_converse.bare_jid));
            }
        };

        /**
         * Collection which stores MUC messages
         * @class
         * @namespace _converse.ChatRoomMessages
         * @memberOf _converse
         */
        _converse.ChatRoomMessages = Collection.extend({
            model: _converse.ChatRoomMessage,
            comparator: 'time'
        });


        /**
         * A direct MUC invitation to join a groupchat has been received
         * See XEP-0249: Direct MUC invitations.
         * @private
         * @method _converse.ChatRoom#onDirectMUCInvitation
         * @param { XMLElement } message - The message stanza containing the invitation.
         */
        _converse.onDirectMUCInvitation = async function (message) {
            const x_el = sizzle('x[xmlns="jabber:x:conference"]', message).pop(),
                from = Strophe.getBareJidFromJid(message.getAttribute('from')),
                room_jid = x_el.getAttribute('jid'),
                reason = x_el.getAttribute('reason');

            let result;
            if (api.settings.get('auto_join_on_invite')) {
                result = true;
            } else {
                // Invite request might come from someone not your roster list
                let contact = _converse.roster.get(from);
                contact = contact ? contact.getDisplayName() : from;
                if (!reason) {
                    result = confirm(__('%1$s has invited you to join a groupchat: %2$s', contact, room_jid));
                } else {
                    result = confirm(
                        __(
                            '%1$s has invited you to join a groupchat: %2$s, and left the following reason: "%3$s"',
                            contact,
                            room_jid,
                            reason
                        )
                    );
                }
            }
            if (result === true) {
                const chatroom = await openChatRoom(room_jid, { 'password': x_el.getAttribute('password') });
                if (chatroom.session.get('connection_status') === converse.ROOMSTATUS.DISCONNECTED) {
                    _converse.chatboxes.get(room_jid).rejoin();
                }
            }
        };

        /************************ BEGIN Event Handlers ************************/

        if (api.settings.get('allow_muc_invitations')) {
            api.listen.on('connected', registerDirectInvitationHandler);
            api.listen.on('reconnected', registerDirectInvitationHandler);
        }

        api.listen.on('beforeTearDown', () => {
            const groupchats = _converse.chatboxes.where({ 'type': _converse.CHATROOMS_TYPE });
            groupchats.forEach(muc =>
                u.safeSave(muc.session, { 'connection_status': converse.ROOMSTATUS.DISCONNECTED })
            );
        });

        api.listen.on('windowStateChanged', onWindowStateChanged);

        api.listen.on('addClientFeatures', () => {
            if (api.settings.get('allow_muc')) {
                api.disco.own.features.add(Strophe.NS.MUC);
            }
            if (api.settings.get('allow_muc_invitations')) {
                api.disco.own.features.add('jabber:x:conference'); // Invites
            }
        });
        api.listen.on('chatBoxesFetched', autoJoinRooms);

        api.listen.on('beforeResourceBinding', () => {
            _converse.connection.addHandler(
                stanza => {
                    const muc_jid = Strophe.getBareJidFromJid(stanza.getAttribute('from'));
                    if (!_converse.chatboxes.get(muc_jid)) {
                        api.waitUntil('chatBoxesFetched').then(async () => {
                            const muc = _converse.chatboxes.get(muc_jid);
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
        });

        api.listen.on('disconnected', disconnectChatRooms);

        api.listen.on('statusInitialized', () => {
            window.addEventListener(_converse.unloadevent, () => {
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
        });
    }
});
