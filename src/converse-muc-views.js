/**
 * @module converse-muc-views
 * @copyright 2020, the Converse.js contributors
 * @description XEP-0045 Multi-User Chat Views
 * @license Mozilla Public License (MPLv2)
 */
import "converse-modal";
import "@converse/headless/utils/muc";
import { debounce, get, isString, isUndefined } from "lodash";
import { BootstrapModal } from "./converse-modal.js";
import { Model } from 'skeletor.js/src/model.js';
import { View } from 'skeletor.js/src/view.js';
import { render } from "lit-html";
import { setNotification } from "components/chat_notification.js";
import { __ } from '@converse/headless/i18n';
import converse from "@converse/headless/converse-core";
import log from "@converse/headless/log";
import tpl_add_chatroom_modal from "templates/add_chatroom_modal.js";
import tpl_chatroom from "templates/chatroom.js";
import tpl_chatroom_bottom_panel from "templates/chatroom_bottom_panel.html";
import tpl_chatroom_destroyed from "templates/chatroom_destroyed.html";
import tpl_chatroom_details_modal from "templates/chatroom_details_modal.js";
import tpl_chatroom_disconnect from "templates/chatroom_disconnect.html";
import tpl_muc_config_form from "templates/muc_config_form.js";
import tpl_chatroom_head from "templates/chatroom_head.js";
import tpl_muc_invite_modal from "templates/muc_invite_modal.js";
import tpl_chatroom_nickname_form from "templates/chatroom_nickname_form.html";
import tpl_muc_password_form from "templates/muc_password_form.js";
import tpl_muc_sidebar from "templates/muc_sidebar.js";
import tpl_list_chatrooms_modal from "templates/list_chatrooms_modal.js";
import tpl_moderator_tools_modal from "templates/moderator_tools_modal.js";
import tpl_room_panel from "templates/room_panel.html";
import tpl_spinner from "templates/spinner.html";
import xss from "xss/dist/xss";

const { Strophe, sizzle, $iq, $pres } = converse.env;
const u = converse.env.utils;

const ROLES = ['moderator', 'participant', 'visitor'];
const AFFILIATIONS = ['admin', 'member', 'outcast', 'owner'];
const OWNER_COMMANDS = ['owner'];
const ADMIN_COMMANDS = ['admin', 'ban', 'deop', 'destroy', 'member', 'op', 'revoke'];
const MODERATOR_COMMANDS = ['kick', 'mute', 'voice', 'modtools'];
const VISITOR_COMMANDS = ['nick'];

const COMMAND_TO_ROLE = {
    'deop': 'participant',
    'kick': 'none',
    'mute': 'visitor',
    'op': 'moderator',
    'voice': 'participant'
}
const COMMAND_TO_AFFILIATION = {
    'admin': 'admin',
    'ban': 'outcast',
    'member': 'member',
    'owner': 'owner',
    'revoke': 'none'
}

converse.plugins.add('converse-muc-views', {
    /* Dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin. They are "optional" because they might not be
     * available, in which case any overrides applicable to them will be
     * ignored.
     *
     * NB: These plugins need to have already been loaded via require.js.
     *
     * It's possible to make these dependencies "non-optional".
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found.
     */
    dependencies: ["converse-autocomplete", "converse-modal", "converse-controlbox", "converse-chatview"],

    overrides: {
        ControlBoxView: {
            renderControlBoxPane () {
                const { _converse } = this.__super__;
                this.__super__.renderControlBoxPane.apply(this, arguments);
                if (_converse.allow_muc) {
                    this.renderRoomsPanel();
                }
            }
        }
    },

    initialize () {
        const { _converse } = this;

        _converse.api.promises.add(['roomsPanelRendered']);

        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        _converse.api.settings.update({
            'auto_list_rooms': false,
            'cache_muc_messages': true,
            'locked_muc_nickname': false,
            'show_retraction_warning': true,
            'muc_disable_slash_commands': false,
            'muc_show_join_leave': true,
            'muc_show_join_leave_status': true,
            'muc_mention_autocomplete_min_chars': 0,
            'muc_mention_autocomplete_filter': 'contains',
            'muc_mention_autocomplete_show_avatar': true,
            'roomconfig_whitelist': [],
            'muc_roomid_policy': null,
            'muc_roomid_policy_hint': null,
            'visible_toolbar_buttons': {
                'toggle_occupants': true
            }
        });


        const viewWithRoomsPanel = {
            renderRoomsPanel () {
                if (this.roomspanel && u.isInDOM(this.roomspanel.el)) {
                    return this.roomspanel;
                }
                const id = `converse.roomspanel${_converse.bare_jid}`;

                this.roomspanel = new _converse.RoomsPanel({
                    'model': new (_converse.RoomsPanelModel.extend({
                        id,
                        'browserStorage': _converse.createStore(id)
                    }))()
                });
                this.roomspanel.model.fetch();
                this.el.querySelector('.controlbox-pane').insertAdjacentElement(
                    'beforeEnd', this.roomspanel.render().el);

                /**
                 * Triggered once the section of the { @link _converse.ControlBoxView }
                 * which shows gropuchats has been rendered.
                 * @event _converse#roomsPanelRendered
                 * @example _converse.api.listen.on('roomsPanelRendered', () => { ... });
                 */
                _converse.api.trigger('roomsPanelRendered');
                return this.roomspanel;
            },

            getRoomsPanel () {
                if (this.roomspanel && u.isInDOM(this.roomspanel.el)) {
                    return this.roomspanel;
                } else {
                    return this.renderRoomsPanel();
                }
            }
        }

        if (_converse.ControlBoxView) {
            Object.assign(_converse.ControlBoxView.prototype, viewWithRoomsPanel);
        }


        _converse.ModeratorToolsModal = BootstrapModal.extend({
            id: "converse-modtools-modal",
            events: {
                'submit .affiliation-form': 'assignAffiliation',
                'submit .role-form': 'assignRole',
                'submit .query-affiliation': 'queryAffiliation',
                'submit .query-role': 'queryRole',
                'click  .nav-item .nav-link': 'switchTab',
                'click .toggle-form': 'toggleForm',
            },

            initialize (attrs) {
                this.chatroomview = attrs.chatroomview;
                BootstrapModal.prototype.initialize.apply(this, arguments);

                this.listenTo(this.model, 'change:role', () => {
                    this.users_with_role = this.getUsersWithRole();
                    this.render();
                });
                this.listenTo(this.model, 'change:affiliation', async () => {
                    this.loading_users_with_affiliation = true;
                    this.users_with_affiliation = null;
                    this.render();
                    const affiliation = this.model.get('affiliation');
                    if (!_converse.muc_fetch_members || affiliation === 'outcast') {
                        this.users_with_affiliation = await this.chatroomview.model.getAffiliationList(affiliation);
                    } else {
                        this.users_with_affiliation = this.getUsersWithAffiliation();
                    }
                    this.loading_users_with_affiliation = false;
                    this.render();
                });
            },

            toHTML () {
                const allowed_commands = this.chatroomview.getAllowedCommands();
                const allowed_affiliations = allowed_commands.map(c => COMMAND_TO_AFFILIATION[c]).filter(c => c);
                const allowed_roles = allowed_commands
                    .filter((value, i, list) => list.indexOf(value) == i)
                    .map(c => COMMAND_TO_ROLE[c])
                    .filter(c => c);

                allowed_affiliations.sort();
                allowed_roles.sort();

                return tpl_moderator_tools_modal(Object.assign(this.model.toJSON(), {
                    allowed_affiliations,
                    allowed_roles,
                    'affiliations': [...AFFILIATIONS, 'none'],
                    'loading_users_with_affiliation': this.loading_users_with_affiliation,
                    'roles': ROLES,
                    'users_with_affiliation': this.users_with_affiliation,
                    'users_with_role': this.users_with_role
                }));
            },

            toggleForm (ev) {
                ev.stopPropagation();
                ev.preventDefault();
                const form_class = ev.target.getAttribute('data-form');
                const form = u.ancestor(ev.target, '.list-group-item').querySelector(`.${form_class}`);
                if (u.hasClass('hidden', form)) {
                    u.removeClass('hidden', form);
                } else {
                    u.addClass('hidden', form);
                }
            },

            getUsersWithAffiliation () {
                return this.chatroomview.model.occupants
                    .where({'affiliation': this.model.get('affiliation')})
                    .map(item => {
                        return {
                            'jid': item.get('jid'),
                            'nick': item.get('nick'),
                            'affiliation': item.get('affiliation')
                        }
                    });
            },

            getUsersWithRole () {
                return this.chatroomview.model.occupants
                    .where({'role': this.model.get('role')})
                    .map(item => {
                        return {
                            'jid': item.get('jid'),
                            'nick': item.get('nick'),
                            'role': item.get('role')
                        }
                    });
            },

            queryRole (ev) {
                ev.stopPropagation();
                ev.preventDefault();
                const data = new FormData(ev.target);
                const role = data.get('role');
                this.model.set({'role': null}, {'silent': true});
                this.model.set({'role': role});
            },

            queryAffiliation (ev) {
                ev.stopPropagation();
                ev.preventDefault();
                const data = new FormData(ev.target);
                const affiliation = data.get('affiliation');
                this.model.set({'affiliation': null}, {'silent': true});
                this.model.set({'affiliation': affiliation});
            },

            assignAffiliation (ev) {
                ev.stopPropagation();
                ev.preventDefault();
                const data = new FormData(ev.target);
                const affiliation = data.get('affiliation');
                const attrs = {
                    'jid': data.get('jid'),
                    'reason': data.get('reason')
                }
                const current_affiliation = this.model.get('affiliation');
                this.chatroomview.model.setAffiliation(affiliation, [attrs])
                    .then(async () => {
                        this.alert(__('Affiliation changed'), 'primary');
                        await this.chatroomview.model.occupants.fetchMembers()
                        this.model.set({'affiliation': null}, {'silent': true});
                        this.model.set({'affiliation': current_affiliation});
                    })
                    .catch(err => {
                        this.alert(__('Sorry, something went wrong while trying to set the affiliation'), 'danger');
                        log.error(err);
                    });
            },

            assignRole (ev) {
                ev.stopPropagation();
                ev.preventDefault();
                const data = new FormData(ev.target);
                const occupant = this.chatroomview.model.getOccupant(data.get('jid') || data.get('nick'));
                const role = data.get('role');
                const reason = data.get('reason');
                const current_role = this.model.get('role');
                this.chatroomview.model.setRole(occupant, role, reason,
                    () => {
                        this.alert(__('Role changed'), 'primary');
                        this.model.set({'role': null}, {'silent': true});
                        this.model.set({'role': current_role});
                    },
                    (e) => {
                        if (sizzle(`not-allowed[xmlns="${Strophe.NS.STANZAS}"]`, e).length) {
                            this.alert(__('You\'re not allowed to make that change'), 'danger');
                        } else {
                            this.alert(__('Sorry, something went wrong while trying to set the role'), 'danger');
                            if (u.isErrorObject(e)) {
                                log.error(e);
                            }
                        }
                    }
                );
            }
        });


        _converse.ListChatRoomsModal = BootstrapModal.extend({
            id: "list-chatrooms-modal",

            initialize () {
                this.rooms = {};
                this.querying = false;
                this.updateRoomsList();
                BootstrapModal.prototype.initialize.apply(this, arguments);
                if (_converse.muc_domain && !this.model.get('muc_domain')) {
                    this.model.save('muc_domain', _converse.muc_domain);
                }
                this.listenTo(this.model, 'change:muc_domain', this.onDomainChange);
            },

            toHTML () {
                const muc_domain = this.model.get('muc_domain') || _converse.muc_domain;
                return tpl_list_chatrooms_modal(Object.assign(this.model.toJSON(), {
                    'openRoom': ev => this.openRoom(ev),
                    'querying': this.querying,
                    'rooms': this.rooms,
                    'server_placeholder': muc_domain ? muc_domain : __('conference.example.org'),
                    'setDomainFromEvent': ev => this.setDomainFromEvent(ev),
                    'toggleRoomInfo': ev => this.toggleRoomInfo(ev),
                    'showRooms': ev => this.showRooms(ev),
                    'show_form': !_converse.locked_muc_domain
                }));
            },

            afterRender () {
                if (_converse.locked_muc_domain) {
                    this.updateRoomsList();
                } else {
                    this.el.addEventListener('shown.bs.modal',
                        () => this.el.querySelector('input[name="server"]').focus(),
                        false
                    );
                }
            },

            openRoom (ev) {
                ev.preventDefault();
                const jid = ev.target.getAttribute('data-room-jid');
                const name = ev.target.getAttribute('data-room-name');
                this.modal.hide();
                _converse.api.rooms.open(jid, {'name': name}, true);
            },

            onDomainChange () {
                if (_converse.auto_list_rooms) {
                    this.updateRoomsList();
                }
            },

            toggleRoomInfo (jid) {
                if ('toggled' in this.rooms[jid]) {
                    this.rooms[jid]['toggled'] = !this.rooms[jid]['toggled']
                    this.render();
                } else {
                    this.rooms[jid]['toggled'] = true;
                    this.render();

                    _converse.api.disco.info(jid, null)
                        .then(stanza => this.onRoomInfo(stanza))
                        .catch(e => log.error(e));
                }
            },

            onRoomInfo (stanza) {
                const jid = stanza.getAttribute('from');
                this.rooms[jid]['info'] = stanza;
                this.rooms[jid]['toggled'] = true;
                this.render();
            },

            onIQResult (iq) {
                if (iq instanceof Error) {
                    log.error(iq);
                    this.rooms = {};
                } else {
                    this.rooms = sizzle('query item', iq)
                        .reduce((o, item) => {
                            o[item.getAttribute('jid')] = {item};
                            return o;
                        }, {});
                }
                this.querying = false;
                this.render();
            },

            /**
             * Sends an IQ stanza to the server asking for all groupchats and
             * then displays them in the modal.
             * @method ListChatRoomsModal#updateRoomsList
             * @private
             */
            updateRoomsList () {
                this.rooms = {};
                this.querying = true;
                this.render();

                const iq = $iq({
                    'to': this.model.get('muc_domain').trim(),
                    'from': _converse.connection.jid,
                    'type': "get"
                }).c("query", {xmlns: Strophe.NS.DISCO_ITEMS});
                _converse.api.sendIQ(iq)
                    .then(iq => this.onIQResult(iq))
                    .catch(e => this.onIQResult(e))
            },

            showRooms (ev) {
                ev.preventDefault();
                const data = new FormData(ev.target);
                this.model.setDomain(data.get('server'));
                this.updateRoomsList();
            },

            setDomainFromEvent (ev) {
                this.model.setDomain(ev.target.value);
            }
        });


        _converse.AddChatRoomModal = BootstrapModal.extend({
            id: 'add-chatroom-modal',

            events: {
                'submit form.add-chatroom': 'openChatRoom',
                'keyup .roomjid-input': 'checkRoomidPolicy',
                'change .roomjid-input': 'checkRoomidPolicy'
            },

            initialize () {
                BootstrapModal.prototype.initialize.apply(this, arguments);
                this.listenTo(this.model, 'change:muc_domain', this.render);
                this.muc_roomid_policy_error_msg = null;
            },

            toHTML () {
                let placeholder = '';
                if (!_converse.locked_muc_domain) {
                    const muc_domain = this.model.get('muc_domain') || _converse.muc_domain;
                    placeholder = muc_domain ? `name@${muc_domain}` : __('name@conference.example.org');
                }
                return tpl_add_chatroom_modal(Object.assign(this.model.toJSON(), {
                    '_converse': _converse,
                    'label_room_address': _converse.muc_domain ? __('Groupchat name') :  __('Groupchat address'),
                    'chatroom_placeholder': placeholder,
                    'muc_roomid_policy_error_msg': this.muc_roomid_policy_error_msg,
                    'muc_roomid_policy_hint': xss.filterXSS(_converse.muc_roomid_policy_hint, {'whiteList': {b: [], br: [], em: []}})
                }));
            },

            afterRender () {
                this.el.addEventListener('shown.bs.modal', () => {
                    this.el.querySelector('input[name="chatroom"]').focus();
                }, false);
            },

            parseRoomDataFromEvent (form) {
                const data = new FormData(form);
                const jid = data.get('chatroom');
                let nick;
                if (_converse.locked_muc_nickname) {
                    nick = _converse.getDefaultMUCNickname();
                    if (!nick) {
                        throw new Error("Using locked_muc_nickname but no nickname found!");
                    }
                } else {
                    nick = data.get('nickname').trim();
                }
                return {
                    'jid': jid,
                    'nick': nick
                }
            },

            openChatRoom (ev) {
                ev.preventDefault();
                const data = this.parseRoomDataFromEvent(ev.target);
                if (data.nick === "") {
                    // Make sure defaults apply if no nick is provided.
                    data.nick = undefined;
                }
                let jid;
                if (_converse.locked_muc_domain || (_converse.muc_domain && !u.isValidJID(data.jid))) {
                    jid = `${Strophe.escapeNode(data.jid)}@${_converse.muc_domain}`;
                } else {
                    jid = data.jid
                    this.model.setDomain(jid);
                }
                _converse.api.rooms.open(jid, Object.assign(data, {jid}));
                this.modal.hide();
                ev.target.reset();
            },

            checkRoomidPolicy () {
                if (_converse.muc_roomid_policy && _converse.muc_domain) {
                    let jid = this.el.querySelector('.roomjid-input').value;
                    if (converse.locked_muc_domain || !u.isValidJID(jid)) {
                        jid = `${Strophe.escapeNode(jid)}@${_converse.muc_domain}`;
                    }
                    const roomid = Strophe.getNodeFromJid(jid);
                    const roomdomain = Strophe.getDomainFromJid(jid);
                    if (_converse.muc_domain !== roomdomain ||
                        _converse.muc_roomid_policy.test(roomid)) {
                        this.muc_roomid_policy_error_msg = null;
                    } else {
                        this.muc_roomid_policy_error_msg = __('Groupchat id is invalid.');
                    }
                    this.render();
                }
            }
        });


        _converse.RoomDetailsModal = BootstrapModal.extend({
            id: "room-details-modal",

            initialize () {
                BootstrapModal.prototype.initialize.apply(this, arguments);
                this.listenTo(this.model, 'change', this.render);
                this.listenTo(this.model.features, 'change', this.render);
                this.listenTo(this.model.occupants, 'add', this.render);
                this.listenTo(this.model.occupants, 'change', this.render);
            },

            toHTML () {
                return tpl_chatroom_details_modal(Object.assign(
                    this.model.toJSON(), {
                        'config': this.model.config.toJSON(),
                        'display_name': __('Groupchat info for %1$s', this.model.getDisplayName()),
                        'features': this.model.features.toJSON(),
                        'num_occupants': this.model.occupants.length,
                    })
                );
            }
        });


        /**
         * NativeView which renders a groupchat, based upon
         * { @link _converse.ChatBoxView } for normal one-on-one chat boxes.
         * @class
         * @namespace _converse.ChatRoomView
         * @memberOf _converse
         */
        _converse.ChatRoomView = _converse.ChatBoxView.extend({
            length: 300,
            tagName: 'div',
            className: 'chatbox chatroom hidden',
            is_chatroom: true,
            events: {
                'change input.fileupload': 'onFileSelection',
                'click .chat-msg__action-edit': 'onMessageEditButtonClicked',
                'click .chat-msg__action-retract': 'onMessageRetractButtonClicked',
                'click .chatbox-navback': 'showControlBox',
                'click .hide-occupants': 'hideOccupants',
                'click .new-msgs-indicator': 'viewUnreadMessages',
                // Arrow functions don't work here because you can't bind a different `this` param to them.
                'click .occupant-nick': function (ev) {this.insertIntoTextArea(ev.target.textContent) },
                'click .send-button': 'onFormSubmitted',
                'click .toggle-call': 'toggleCall',
                'click .toggle-occupants': 'toggleOccupants',
                'click .upload-file': 'toggleFileUpload',
                'dragover .chat-textarea': 'onDragOver',
                'drop .chat-textarea': 'onDrop',
                'input .chat-textarea': 'inputChanged',
                'keydown .chat-textarea': 'onKeyDown',
                'keyup .chat-textarea': 'onKeyUp',
                'mousedown .dragresize-occupants-left': 'onStartResizeOccupants',
                'paste .chat-textarea': 'onPaste',
                'submit .muc-nickname-form': 'submitNickname'
            },

            async initialize () {
                this.initDebounced();
                this.debouncedMsgsRender = debounce(changed => this.renderChatContent(changed), 25);

                this.listenTo(this.model.messages, 'add', this.onMessageAdded);
                this.listenTo(this.model.messages, 'change', this.debouncedMsgsRender);
                this.listenTo(this.model.messages, 'destroy', this.debouncedMsgsRender);
                this.listenTo(this.model.messages, 'rendered', this.scrollDown);
                this.listenTo(this.model.messages, 'vcard:change', this.debouncedMsgsRender);
                this.listenTo(this.model.messages, 'rendered', this.scrollDown);
                this.listenTo(this.model.messages, 'reset', () => {
                    this.content.innerHTML = '';
                    this.removeAll();
                    this.debouncedMsgsRender();
                });

                this.listenTo(this.model.session, 'change:connection_status', this.onConnectionStatusChanged);

                this.listenTo(this.model, 'change', this.renderHeading);
                this.listenTo(this.model, 'change:hidden_occupants', this.updateOccupantsToggle);
                this.listenTo(this.model, 'change:subject', this.setChatRoomSubject);
                this.listenTo(this.model, 'configurationNeeded', this.getAndRenderConfigurationForm);
                this.listenTo(this.model, 'destroy', this.hide);
                this.listenTo(this.model, 'show', this.show);

                this.listenTo(this.model.features, 'change:moderated', this.renderBottomPanel);

                this.listenTo(this.model.occupants, 'add', this.onOccupantAdded);
                this.listenTo(this.model.occupants, 'change:affiliation', this.onOccupantAffiliationChanged);
                this.listenTo(this.model.occupants, 'change:role', this.onOccupantRoleChanged);
                this.listenTo(this.model.occupants, 'change:show', this.showJoinOrLeaveNotification);
                this.listenTo(this.model.occupants, 'remove', this.onOccupantRemoved);

                // Bind so that we can pass it to addEventListener and removeEventListener
                this.onMouseMove =  this.onMouseMove.bind(this);
                this.onMouseUp =  this.onMouseUp.bind(this);

                this.render();
                this.createSidebarView();
                await this.updateAfterMessagesFetched();
                this.onConnectionStatusChanged();
                this.model.maybeShow();
                /**
                 * Triggered once a { @link _converse.ChatRoomView } has been opened
                 * @event _converse#chatRoomViewInitialized
                 * @type { _converse.ChatRoomView }
                 * @example _converse.api.listen.on('chatRoomViewInitialized', view => { ... });
                 */
                _converse.api.trigger('chatRoomViewInitialized', this);
            },

            render () {
                this.el.setAttribute('id', this.model.get('box_id'));
                const result = tpl_chatroom({
                    'muc_show_logs_before_join': _converse.muc_show_logs_before_join,
                    'show_send_button': _converse.show_send_button
                });
                render(result, this.el);
                this.content = this.el.querySelector('.chat-content');
                this.renderHeading();
                this.renderChatContent();
                this.renderBottomPanel();
                if (!_converse.muc_show_logs_before_join) {
                    this.model.session.get('connection_status') !== converse.ROOMSTATUS.ENTERED && this.showSpinner();
                }
                if (!this.model.get('hidden')) {
                    this.show();
                }
                return this;
            },

            /**
             * Renders the MUC heading if any relevant attributes have changed.
             * @private
             * @method _converse.ChatRoomView#renderHeading
             * @param { _converse.ChatRoom } [item]
             */
            renderHeading () {
                render(this.generateHeadingTemplate(), this.el.querySelector('.chat-head-chatroom'));
            },


            renderBottomPanel () {
                const container = this.el.querySelector('.bottom-panel');
                const entered = this.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED;
                const can_edit = entered && !(this.model.features.get('moderated') && this.model.getOwnRole() === 'visitor');
                container.innerHTML = tpl_chatroom_bottom_panel({__, can_edit, entered});
                if (entered && can_edit) {
                    this.renderMessageForm();
                    this.initMentionAutoComplete();
                }
            },

            createSidebarView () {
                this.model.occupants.chatroomview = this;
                this.sidebar_view = new _converse.MUCSidebar({'model': this.model.occupants});
                const container_el = this.el.querySelector('.chatroom-body');
                const occupants_width = this.model.get('occupants_width');
                if (this.sidebar_view && occupants_width !== undefined) {
                    this.sidebar_view.el.style.flex = "0 0 " + occupants_width + "px";
                }
                container_el.insertAdjacentElement('beforeend', this.sidebar_view.el);
            },

            onStartResizeOccupants (ev) {
                this.resizing = true;
                this.el.addEventListener('mousemove', this.onMouseMove);
                this.el.addEventListener('mouseup', this.onMouseUp);

                const style = window.getComputedStyle(this.sidebar_view.el);
                this.width = parseInt(style.width.replace(/px$/, ''), 10);
                this.prev_pageX = ev.pageX;
            },

            onMouseMove (ev) {
                if (this.resizing) {
                    ev.preventDefault();
                    const delta = this.prev_pageX - ev.pageX;
                    this.resizeSidebarView(delta, ev.pageX);
                    this.prev_pageX = ev.pageX;
                }
            },

            onMouseUp (ev) {
                if (this.resizing) {
                    ev.preventDefault();
                    this.resizing = false;
                    this.el.removeEventListener('mousemove', this.onMouseMove);
                    this.el.removeEventListener('mouseup', this.onMouseUp);
                    const element_position = this.sidebar_view.el.getBoundingClientRect();
                    const occupants_width = this.calculateSidebarWidth(element_position, 0);
                    const attrs = {occupants_width};
                    _converse.connection.connected ? this.model.save(attrs) : this.model.set(attrs);
                }
            },

            resizeSidebarView (delta, current_mouse_position) {
                const element_position = this.sidebar_view.el.getBoundingClientRect();
                if (this.is_minimum) {
                    this.is_minimum = element_position.left < current_mouse_position;
                } else if (this.is_maximum) {
                    this.is_maximum = element_position.left > current_mouse_position;
                } else {
                    const occupants_width = this.calculateSidebarWidth(element_position, delta);
                    this.sidebar_view.el.style.flex = "0 0 " + occupants_width + "px";
                }
            },

            calculateSidebarWidth(element_position, delta) {
                let occupants_width = element_position.width + delta;
                const room_width = this.el.clientWidth;
                // keeping display in boundaries
                if (occupants_width < (room_width * 0.20)) {
                    // set pixel to 20% width
                    occupants_width = (room_width * 0.20);
                    this.is_minimum = true;
                } else if (occupants_width > (room_width * 0.75)) {
                    // set pixel to 75% width
                    occupants_width = (room_width * 0.75);
                    this.is_maximum = true;
                } else if ((room_width - occupants_width) < 250) {
                    // resize occupants if chat-area becomes smaller than 250px (min-width property set in css)
                    occupants_width = room_width - 250;
                    this.is_maximum = true;
                } else {
                    this.is_maximum = false;
                    this.is_minimum = false;
                }
                return occupants_width;
            },

            getAutoCompleteList () {
                return this.model.occupants.filter('nick').map(o => ({'label': o.get('nick'), 'value': `@${o.get('nick')}`}));
            },

            getAutoCompleteListItem(text, input) {
                input = input.trim();
                const element = document.createElement("li");
                element.setAttribute("aria-selected", "false");

                if (_converse.muc_mention_autocomplete_show_avatar) {
                    const img = document.createElement("img");
                    let dataUri = "data:" + _converse.DEFAULT_IMAGE_TYPE + ";base64," + _converse.DEFAULT_IMAGE;

                    if (_converse.vcards) {
                        const vcard = _converse.vcards.findWhere({'nickname': text});
                        if (vcard) dataUri = "data:" + vcard.get('image_type') + ";base64," + vcard.get('image');
                    }

                    img.setAttribute("src", dataUri);
                    img.setAttribute("width", "22");
                    img.setAttribute("class", "avatar avatar-autocomplete");
                    element.appendChild(img);
                }

                const regex = new RegExp("(" + input + ")", "ig");
                const parts = input ? text.split(regex) : [text];

                parts.forEach(txt => {
                    if (input && txt.match(regex)) {
                      const match = document.createElement("mark");
                      match.textContent = txt;
                      element.appendChild(match);
                    } else {
                      element.appendChild(document.createTextNode(txt));
                    }
                });

                return element;
            },

            initMentionAutoComplete () {
                this.mention_auto_complete = new _converse.AutoComplete(this.el, {
                    'auto_first': true,
                    'auto_evaluate': false,
                    'min_chars': _converse.muc_mention_autocomplete_min_chars,
                    'match_current_word': true,
                    'list': () => this.getAutoCompleteList(),
                    'filter': _converse.muc_mention_autocomplete_filter == 'contains' ? _converse.FILTER_CONTAINS : _converse.FILTER_STARTSWITH,
                    'ac_triggers': ["Tab", "@"],
                    'include_triggers': [],
                    'item': this.getAutoCompleteListItem
                });
                this.mention_auto_complete.on('suggestion-box-selectcomplete', () => (this.auto_completing = false));
            },

            /**
             * Get the nickname value from the form and then join the groupchat with it.
             * @private
             * @method _converse.ChatRoomView#submitNickname
             * @param { Event }
             */
            submitNickname (ev) {
                ev.preventDefault();
                const nick = ev.target.nick.value.trim();
                nick && this.model.join(nick);
            },

            onKeyDown (ev) {
                if (this.mention_auto_complete.onKeyDown(ev)) {
                    return;
                }
                return _converse.ChatBoxView.prototype.onKeyDown.call(this, ev);
            },

            onKeyUp (ev) {
                this.mention_auto_complete.evaluate(ev);
                return _converse.ChatBoxView.prototype.onKeyUp.call(this, ev);
            },

            async onMessageRetractButtonClicked (ev) {
                ev.preventDefault();
                const msg_el = u.ancestor(ev.target, '.message');
                const msgid = msg_el.getAttribute('data-msgid');
                const time = msg_el.getAttribute('data-isodate');
                const message = this.model.messages.findWhere({msgid, time});
                const retraction_warning =
                    __("Be aware that other XMPP/Jabber clients (and servers) may "+
                        "not yet support retractions and that this message may not "+
                        "be removed everywhere.");

                if (message.get('sender') === 'me') {
                    const messages = [__('Are you sure you want to retract this message?')];
                    if (_converse.show_retraction_warning) {
                        messages[1] = retraction_warning;
                    }
                    const result = await _converse.api.confirm(__('Confirm'), messages);
                    if (result) {
                        this.retractOwnMessage(message);
                    }
                } else {
                    let messages = [
                        __('You are about to retract this message.'),
                        __('You may optionally include a message, explaining the reason for the retraction.')
                    ];
                    if (_converse.show_retraction_warning) {
                        messages = [messages[0], retraction_warning, messages[1]]
                    }
                    const reason = await _converse.api.prompt(
                        __('Message Retraction'),
                        messages,
                        __('Optional reason')
                    );
                    if (reason !== false) {
                        this.retractOtherMessage(message, reason);
                    }
                }
            },

            /**
             * Retract one of your messages in this groupchat.
             * @private
             * @method _converse.ChatRoomView#retractOwnMessage
             * @param { _converse.Message } message - The message which we're retracting.
             */
            retractOwnMessage(message) {
                this.model.sendRetractionMessage(message)
                    .catch(e => {
                        message.save({
                            'retracted': undefined,
                            'retracted_id': undefined
                        });
                        const errmsg = __('Sorry, something went wrong while trying to retract your message.');
                        if (u.isErrorStanza(e)) {
                            this.showErrorMessage(errmsg);
                        } else {
                            this.showErrorMessage(errmsg);
                            this.showErrorMessage(e.message);
                        }
                        log.error(e);
                    });
                message.save({
                    'retracted': (new Date()).toISOString(),
                    'retracted_id': message.get('origin_id')
                });
            },

            /**
             * Retract someone else's message in this groupchat.
             * @private
             * @method _converse.ChatRoomView#retractOtherMessage
             * @param { _converse.Message } message - The message which we're retracting.
             * @param { string } [reason] - The reason for retracting the message.
             */
            async retractOtherMessage (message, reason) {
                const result = await this.model.sendRetractionIQ(message, reason);
                if (result === null) {
                    const err_msg = __(`A timeout occurred while trying to retract the message`);
                    _converse.api.alert('error', __('Error'), err_msg);
                    _converse.log(err_msg, Strophe.LogLevel.WARN);
                } else if (u.isErrorStanza(result)) {
                    const err_msg = __(`Sorry, you're not allowed to retract this message.`);
                    _converse.api.alert('error', __('Error'), err_msg);
                    _converse.log(err_msg, Strophe.LogLevel.WARN);
                    _converse.log(result, Strophe.LogLevel.WARN);
                } else {
                    message.save({
                        'moderated': 'retracted',
                        'moderated_by': _converse.bare_jid,
                        'moderated_id': message.get('msgid'),
                        'moderation_reason': reason
                    });
                }
            },

            showModeratorToolsModal (affiliation) {
                if (!this.verifyRoles(['moderator'])) {
                    return;
                }
                if (isUndefined(this.model.modtools_modal)) {
                    const model = new Model({'affiliation': affiliation});
                    this.modtools_modal = new _converse.ModeratorToolsModal({'model': model, 'chatroomview': this});
                } else {
                    this.modtools_modal.set('affiliation', affiliation);
                }
                this.modtools_modal.show();
            },

            showRoomDetailsModal (ev) {
                ev.preventDefault();
                if (this.model.room_details_modal === undefined) {
                    this.model.room_details_modal = new _converse.RoomDetailsModal({'model': this.model});
                }
                this.model.room_details_modal.show(ev);
            },

            showChatStateNotification (message) {
                if (message.get('sender') === 'me') {
                    return;
                }
                return _converse.ChatBoxView.prototype.showChatStateNotification.apply(this, arguments);
            },

            onOccupantAffiliationChanged (occupant) {
                if (occupant.get('jid') === _converse.bare_jid) {
                    this.renderHeading();
                }
                this.informOfOccupantsAffiliationChange(occupant);
                this.debouncedMsgsRender();
            },

            informOfOccupantsAffiliationChange (occupant) {
                const previous_affiliation = occupant._previousAttributes.affiliation;
                const current_affiliation = occupant.get('affiliation');

                if (previous_affiliation === 'admin') {
                    this.showChatEvent(__("%1$s is no longer an admin of this groupchat", occupant.get('nick')))
                } else if (previous_affiliation === 'owner') {
                    this.showChatEvent(__("%1$s is no longer an owner of this groupchat", occupant.get('nick')))
                } else if (previous_affiliation === 'outcast') {
                    this.showChatEvent(__("%1$s is no longer banned from this groupchat", occupant.get('nick')))
                }

                if (current_affiliation === 'none' && previous_affiliation === 'member') {
                    this.showChatEvent(__("%1$s is no longer a member of this groupchat", occupant.get('nick')))
                } if (current_affiliation === 'member') {
                    this.showChatEvent(__("%1$s is now a member of this groupchat", occupant.get('nick')))
                } else if (current_affiliation === 'outcast') {
                    this.showChatEvent(__("%1$s has been banned from this groupchat", occupant.get('nick')))
                } else if (current_affiliation === 'admin' || current_affiliation == 'owner') {
                    // For example: AppleJack is now an (admin|owner) of this groupchat
                    this.showChatEvent(__('%1$s is now an %2$s of this groupchat', occupant.get('nick'), current_affiliation))
                }
            },

            onOccupantRoleChanged (occupant, changed) {
                if (occupant.get('jid') === _converse.bare_jid) {
                    this.renderBottomPanel();
                }
                this.informOfOccupantsRoleChange(occupant, changed);
                this.debouncedMsgsRender();
            },

            informOfOccupantsRoleChange (occupant, changed) {
                if (changed === "none" || occupant.changed.affiliation) {
                    // We don't inform of role changes if they accompany affiliation changes.
                    return;
                }
                const previous_role = occupant._previousAttributes.role;
                if (previous_role === 'moderator') {
                    this.showChatEvent(__("%1$s is no longer a moderator", occupant.get('nick')))
                }
                if (previous_role === 'visitor') {
                    this.showChatEvent(__("%1$s has been given a voice", occupant.get('nick')))
                }
                if (occupant.get('role') === 'visitor') {
                    this.showChatEvent(__("%1$s has been muted", occupant.get('nick')))
                }
                if (occupant.get('role') === 'moderator') {
                    if (!['owner', 'admin'].includes(occupant.get('affiliation'))) {
                        // We only show this message if the user isn't already
                        // an admin or owner, otherwise this isn't new
                        // information.
                        this.showChatEvent(__("%1$s is now a moderator", occupant.get('nick')))
                    }
                }
            },

            getHeadingButtons () {
                const buttons = [{
                    'i18n_title': __('Details'),
                    'handler': ev => this.showRoomDetailsModal(ev),
                    'icon_class': 'fa-info-circle',
                    'name': 'details'
                }, {
                    'i18n_title': __('Invite Someone'),
                    'handler': ev => this.showInviteModal(ev),
                    'icon_class': 'fa-user-plus',
                    'name': 'invite'
                }];

                if (this.model.getOwnAffiliation() === 'owner') {
                    buttons.push({
                        'i18n_title': __('Configure'),
                        'handler': ev => this.getAndRenderConfigurationForm(ev),
                        'icon_class': 'fa-wrench',
                        'name': 'configure'
                    });
                }

                if (this.model.get('subject')) {
                    buttons.push({
                        'i18n_title': this.model.get('hide_subject') ? __('Show topic') : __('Hide topic'),
                        'handler': ev => this.toggleTopic(ev),
                        'icon_class': 'fa-minus-square',
                        'name': 'toggle-topic'
                    });
                }

                if (!_converse.singleton) {
                    buttons.push({
                        'i18n_title': __('Leave'),
                        'handler': async ev => {
                            const messages = [__('Are you sure you want to leave this groupchat?')];
                            const result = await _converse.api.confirm(__('Confirm'), messages);
                            result && this.close(ev);
                        },
                        'icon_class': 'fa-sign-out-alt',
                        'name': 'signout'
                    });
                }
                return buttons;
            },

            /**
             * Returns the groupchat heading HTML to be rendered.
             * @private
             * @method _converse.ChatRoomView#generateHeadingTemplate
             */
            generateHeadingTemplate () {
                return tpl_chatroom_head(
                    Object.assign(this.model.toJSON(), {
                        _converse,
                        'buttons': this.getHeadingButtons(),
                        'title': this.model.getDisplayName(),
                }));
            },

            toggleTopic () {
                this.model.save('hide_subject', !this.model.get('hide_subject'));
            },


            showInviteModal (ev) {
                ev.preventDefault();
                if (this.muc_invite_modal === undefined) {
                    this.muc_invite_modal = new _converse.MUCInviteModal({'model': new Model()});
                    // TODO: remove once we have API for sending direct invite
                    this.muc_invite_modal.chatroomview = this.chatroomview;
                }
                this.muc_invite_modal.show(ev);
            },


            /**
             * Callback method that gets called after the chat has become visible.
             * @private
             * @method _converse.ChatRoomView#afterShown
             */
            afterShown () {
                // Override from converse-chatview, specifically to avoid
                // the 'active' chat state from being sent out prematurely.
                // This is instead done in `onConnectionStatusChanged` below.
                if (u.isPersistableModel(this.model)) {
                    this.model.clearUnreadMsgCounter();
                }
                this.scrollDown();
            },

            onConnectionStatusChanged () {
                const conn_status = this.model.session.get('connection_status');
                if (conn_status === converse.ROOMSTATUS.NICKNAME_REQUIRED) {
                    this.renderNicknameForm();
                } else if (conn_status === converse.ROOMSTATUS.PASSWORD_REQUIRED) {
                    this.renderPasswordForm();
                } else if (conn_status === converse.ROOMSTATUS.CONNECTING) {
                    this.showSpinner();
                } else if (conn_status === converse.ROOMSTATUS.ENTERED) {
                    this.renderBottomPanel();
                    this.hideSpinner();
                    this.maybeFocus();
                } else if (conn_status === converse.ROOMSTATUS.DISCONNECTED) {
                    this.showDisconnectMessage();
                } else if (conn_status === converse.ROOMSTATUS.DESTROYED) {
                    this.showDestroyedMessage();
                }
            },

            getToolbarOptions () {
                return Object.assign(
                    _converse.ChatBoxView.prototype.getToolbarOptions.apply(this, arguments),
                    {
                      'label_hide_occupants': __('Hide the list of participants'),
                      'show_occupants_toggle': _converse.visible_toolbar_buttons.toggle_occupants
                    }
                );
            },

            /**
             * Closes this chat box, which implies leaving the groupchat as well.
             * @private
             * @method _converse.ChatRoomView#close
             */
            async close () {
                this.hide();
                if (_converse.router.history.getFragment() === "converse/room?jid="+this.model.get('jid')) {
                    _converse.router.navigate('');
                }
                await this.model.leave();
                return _converse.ChatBoxView.prototype.close.apply(this, arguments);
            },

            updateOccupantsToggle () {
                const icon_el = this.el.querySelector('.toggle-occupants');
                const chat_area = this.el.querySelector('.chat-area');
                if (this.model.get('hidden_occupants')) {
                    u.removeClass('fa-angle-double-right', icon_el);
                    u.addClass('fa-angle-double-left', icon_el);
                    u.addClass('full', chat_area);
                } else {
                    u.addClass('fa-angle-double-right', icon_el);
                    u.removeClass('fa-angle-double-left', icon_el);
                    u.removeClass('full', chat_area);
                }
            },

            /**
             * Hide the right sidebar containing the chat occupants.
             * @private
             * @method _converse.ChatRoomView#hideOccupants
             */
            hideOccupants (ev) {
                if (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                this.model.save({'hidden_occupants': true});
                this.scrollDown();
            },

            /**
             * Show or hide the right sidebar containing the chat occupants.
             * @private
             * @method _converse.ChatRoomView#toggleOccupants
             */
            toggleOccupants (ev) {
                if (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                this.model.save({'hidden_occupants': !this.model.get('hidden_occupants')});
                this.scrollDown();
            },

            verifyRoles (roles, occupant, show_error=true) {
                if (!Array.isArray(roles)) {
                    throw new TypeError('roles must be an Array');
                }
                if (!roles.length) {
                    return true;
                }
                if (!occupant) {
                    occupant = this.model.occupants.findWhere({'jid': _converse.bare_jid});
                }
                const role = occupant.get('role');
                if (roles.includes(role)) {
                    return true;
                }
                if (show_error) {
                    this.showErrorMessage(__('Forbidden: you do not have the necessary role in order to do that.'))
                }
                return false;
            },

            verifyAffiliations (affiliations, occupant, show_error=true) {
                if (!Array.isArray(affiliations)) {
                    throw new TypeError('affiliations must be an Array');
                }
                if (!affiliations.length) {
                    return true;
                }
                if (!occupant) {
                    occupant = this.model.occupants.findWhere({'jid': _converse.bare_jid});
                }
                const a = occupant.get('affiliation');
                if (affiliations.includes(a)) {
                    return true;
                }
                if (show_error) {
                    this.showErrorMessage(__('Forbidden: you do not have the necessary affiliation in order to do that.'))
                }
                return false;
            },

            validateRoleOrAffiliationChangeArgs (command, args) {
                if (!args) {
                    this.showErrorMessage(
                        __('Error: the "%1$s" command takes two arguments, the user\'s nickname and optionally a reason.', command)
                    );
                    return false;
                }
                return true;
            },

            getNickOrJIDFromCommandArgs (args) {
                if (!args.startsWith('@')) {
                    args = '@'+ args;
                }
                const [text, references] = this.model.parseTextForReferences(args); // eslint-disable-line no-unused-vars
                if (!references.length) {
                    this.showErrorMessage(__("Error: couldn't find a groupchat participant based on your arguments"));
                    return;
                }
                if (references.length > 1) {
                    this.showErrorMessage(__("Error: found multiple groupchat participant based on your arguments"));
                    return;
                }
                const nick_or_jid = references.pop().value;
                const reason = args.split(nick_or_jid, 2)[1];
                if (reason && !reason.startsWith(' ')) {
                    this.showErrorMessage(__("Error: couldn't find a groupchat participant based on your arguments"));
                    return;
                }
                return nick_or_jid;
            },

            setAffiliation (command, args, required_affiliations) {
                const affiliation = COMMAND_TO_AFFILIATION[command];
                if (!affiliation) {
                    throw Error(`ChatRoomView#setAffiliation called with invalid command: ${command}`);
                }
                if (!this.verifyAffiliations(required_affiliations)) {
                    return false;
                }
                if (!this.validateRoleOrAffiliationChangeArgs(command, args)) {
                    return false;
                }
                const nick_or_jid = this.getNickOrJIDFromCommandArgs(args);
                if (!nick_or_jid) {
                    return false;
                }
                const reason = args.split(nick_or_jid, 2)[1].trim();
                // We're guaranteed to have an occupant due to getNickOrJIDFromCommandArgs
                const occupant = this.model.getOccupant(nick_or_jid);
                const attrs = {
                    'jid': occupant.get('jid'),
                    'reason': reason
                }
                if (_converse.auto_register_muc_nickname && occupant) {
                    attrs['nick'] = occupant.get('nick');
                }
                this.model.setAffiliation(affiliation, [attrs])
                    .then(() => this.model.occupants.fetchMembers())
                    .catch(err => this.onCommandError(err));
            },

            getReason (args) {
                return args.includes(',') ? args.slice(args.indexOf(',')+1).trim() : null;
            },

            setRole (command, args, required_affiliations=[], required_roles=[]) {
                /* Check that a command to change a groupchat user's role or
                 * affiliation has anough arguments.
                 */
                const role = COMMAND_TO_ROLE[command];
                if (!role) {
                    throw Error(`ChatRoomView#setRole called with invalid command: ${command}`);
                }
                if (!this.verifyAffiliations(required_affiliations) || !this.verifyRoles(required_roles)) {
                    return false;
                }
                if (!this.validateRoleOrAffiliationChangeArgs(command, args)) {
                    return false;
                }
                const nick_or_jid = this.getNickOrJIDFromCommandArgs(args);
                if (!nick_or_jid) {
                    return false;
                }
                const reason = args.split(nick_or_jid, 2)[1].trim();
                // We're guaranteed to have an occupant due to getNickOrJIDFromCommandArgs
                const occupant = this.model.getOccupant(nick_or_jid);
                this.model.setRole(occupant, role, reason, undefined, this.onCommandError.bind(this));
                return true;
            },

            onCommandError (err) {
                log.fatal(err);
                this.showErrorMessage(
                    __("Sorry, an error happened while running the command.") + " " +
                    __("Check your browser's developer console for details.")
                );
            },

            getAllowedCommands () {
                let allowed_commands = ['clear', 'help', 'me', 'nick', 'register'];
                if (this.model.config.get('changesubject') || ['owner', 'admin'].includes(this.model.getOwnAffiliation())) {
                    allowed_commands = [...allowed_commands, ...['subject', 'topic']];
                }
                const occupant = this.model.occupants.findWhere({'jid': _converse.bare_jid});
                if (this.verifyAffiliations(['owner'], occupant, false)) {
                    allowed_commands = allowed_commands.concat(OWNER_COMMANDS).concat(ADMIN_COMMANDS);
                } else if (this.verifyAffiliations(['admin'], occupant, false)) {
                    allowed_commands = allowed_commands.concat(ADMIN_COMMANDS);
                }
                if (this.verifyRoles(['moderator'], occupant, false)) {
                    allowed_commands = allowed_commands.concat(MODERATOR_COMMANDS).concat(VISITOR_COMMANDS);
                } else if (!this.verifyRoles(['visitor', 'participant', 'moderator'], occupant, false)) {
                    allowed_commands = allowed_commands.concat(VISITOR_COMMANDS);
                }
                allowed_commands.sort();
                return allowed_commands;
            },

            parseMessageForCommands (text) {
                if (_converse.muc_disable_slash_commands && !Array.isArray(_converse.muc_disable_slash_commands)) {
                    return _converse.ChatBoxView.prototype.parseMessageForCommands.apply(this, arguments);
                }
                text = text.replace(/^\s*/, "");
                const command = (text.match(/^\/([a-zA-Z]*) ?/) || ['']).pop().toLowerCase();
                if (!command) {
                    return false;
                }
                const args = text.slice(('/'+command).length+1).trim();

                let disabled_commands = [];
                if (Array.isArray(_converse.muc_disable_slash_commands)) {
                    disabled_commands = _converse.muc_disable_slash_commands;
                    if (disabled_commands.includes(command)) {
                        return false;
                    }
                }
                const allowed_commands = this.getAllowedCommands();
                if (!allowed_commands.includes(command)) {
                    return false;
                }

                switch (command) {
                    case 'admin': {
                        this.setAffiliation(command, args, ['owner']);
                        break;
                    }
                    case 'ban': {
                        this.setAffiliation(command, args, ['admin', 'owner']);
                        break;
                    }
                    case 'modtools': {
                        this.showModeratorToolsModal(args);
                        break;
                    }
                    case 'deop': {
                        // FIXME: /deop only applies to setting a moderators
                        // role to "participant" (which only admin/owner can
                        // do). Moderators can however set non-moderator's role
                        // to participant (e.g. visitor => participant).
                        // Currently we don't distinguish between these two
                        // cases.
                        this.setRole(command, args, ['admin', 'owner']);
                        break;
                    }
                    case 'destroy': {
                        if (!this.verifyAffiliations(['owner'])) {
                            break;
                        }
                        this.model.sendDestroyIQ(args)
                            .then(() => this.close())
                            .catch(e => this.onCommandError(e));
                        break;
                    }
                    case 'help': {
                        this.showHelpMessages([`<strong>${__("You can run the following commands")}</strong>`]);
                        this.showHelpMessages([
                            `<strong>/admin</strong>: ${__("Change user's affiliation to admin")}`,
                            `<strong>/ban</strong>: ${__('Ban user by changing their affiliation to outcast')}`,
                            `<strong>/clear</strong>: ${__('Clear the chat area')}`,
                            `<strong>/close</strong>: ${__('Close this groupchat')}`,
                            `<strong>/deop</strong>: ${__('Change user role to participant')}`,
                            `<strong>/destroy</strong>: ${__('Remove this groupchat')}`,
                            `<strong>/help</strong>: ${__('Show this menu')}`,
                            `<strong>/kick</strong>: ${__('Kick user from groupchat')}`,
                            `<strong>/me</strong>: ${__('Write in 3rd person')}`,
                            `<strong>/member</strong>: ${__('Grant membership to a user')}`,
                            `<strong>/modtools</strong>: ${__('Opens up the moderator tools GUI')}`,
                            `<strong>/mute</strong>: ${__("Remove user's ability to post messages")}`,
                            `<strong>/nick</strong>: ${__('Change your nickname')}`,
                            `<strong>/op</strong>: ${__('Grant moderator role to user')}`,
                            `<strong>/owner</strong>: ${__('Grant ownership of this groupchat')}`,
                            `<strong>/register</strong>: ${__("Register your nickname")}`,
                            `<strong>/revoke</strong>: ${__("Revoke the user's current affiliation")}`,
                            `<strong>/subject</strong>: ${__('Set groupchat subject')}`,
                            `<strong>/topic</strong>: ${__('Set groupchat subject (alias for /subject)')}`,
                            `<strong>/voice</strong>: ${__('Allow muted user to post messages')}`
                            ].filter(line => disabled_commands.every(c => (!line.startsWith(c+'<', 9))))
                             .filter(line => allowed_commands.some(c => line.startsWith(c+'<', 9)))
                        );
                        break;
                    } case 'kick': {
                        this.setRole(command, args, [], ['moderator']);
                        break;
                    }
                    case 'mute': {
                        this.setRole(command, args, [], ['moderator']);
                        break;
                    }
                    case 'member': {
                        this.setAffiliation(command, args, ['admin', 'owner']);
                        break;
                    }
                    case 'nick': {
                        if (!this.verifyRoles(['visitor', 'participant', 'moderator'])) {
                            break;
                        } else if (args.length === 0) {
                            // e.g. Your nickname is "coolguy69"
                            this.showErrorMessage(__('Your nickname is "%1$s"', this.model.get('nick')))
                        } else {
                            const jid = Strophe.getBareJidFromJid(this.model.get('jid'));
                            _converse.api.send($pres({
                                from: _converse.connection.jid,
                                to: `${jid}/${args}`,
                                id: u.getUniqueId()
                            }).tree());
                        }
                        break;
                    }
                    case 'owner':
                        this.setAffiliation(command, args, ['owner']);
                        break;
                    case 'op': {
                        this.setRole(command, args, ['admin', 'owner']);
                        break;
                    }
                    case 'register': {
                        if (args.length > 1) {
                            this.showErrorMessage(__('Error: invalid number of arguments'))
                        } else {
                            this.model.registerNickname().then(err_msg => {
                                if (err_msg) this.showErrorMessage(err_msg)
                            });
                        }
                        break;
                    }
                    case 'revoke': {
                        this.setAffiliation(command, args, ['admin', 'owner']);
                        break;
                    }
                    case 'topic':
                    case 'subject':
                        this.model.setSubject(args);
                        break;
                    case 'voice': {
                        this.setRole(command, args, [], ['moderator']);
                        break;
                    }
                    default:
                        return _converse.ChatBoxView.prototype.parseMessageForCommands.apply(this, arguments);
                }
                return true;
            },

            /**
             * Renders a form given an IQ stanza containing the current
             * groupchat configuration.
             * Returns a promise which resolves once the user has
             * either submitted the form, or canceled it.
             * @private
             * @method _converse.ChatRoomView#renderConfigurationForm
             * @param { XMLElement } stanza: The IQ stanza containing the groupchat config.
             */
            renderConfigurationForm (stanza) {
                this.hideChatRoomContents();
                this.model.save('config_stanza', stanza.outerHTML);
                if (!this.config_form) {
                    const { _converse } = this.__super__;
                    this.config_form = new _converse.MUCConfigForm({
                        'model': this.model,
                        'chatroomview': this
                    });
                    const container_el = this.el.querySelector('.chatroom-body');
                    container_el.insertAdjacentElement('beforeend', this.config_form.el);
                }
                u.showElement(this.config_form.el);
            },

            /**
             * Renders a form which allows the user to choose theirnickname.
             * @private
             * @method _converse.ChatRoomView#renderNicknameForm
             */
            renderNicknameForm () {
                const heading = _converse.muc_show_logs_before_join ?
                    __('Choose a nickname to enter') :
                    __('Please choose your nickname');

                const html = tpl_chatroom_nickname_form(Object.assign({
                    heading,
                    'label_nickname': __('Nickname'),
                    'label_join': __('Enter groupchat'),
                }, this.model.toJSON()));

                if (_converse.muc_show_logs_before_join) {
                    const container = this.el.querySelector('.muc-bottom-panel');
                    container.innerHTML = html;
                    u.addClass('muc-bottom-panel--nickname', container);
                } else {
                    this.hideChatRoomContents();
                    const container = this.el.querySelector('.chatroom-body');
                    container.insertAdjacentHTML('beforeend', html);
                }
                u.safeSave(this.model.session, {'connection_status': converse.ROOMSTATUS.NICKNAME_REQUIRED});
            },

            /**
             * Remove the configuration form without submitting and return to the chat view.
             * @private
             * @method _converse.ChatRoomView#closeForm
             */
            closeForm () {
                sizzle('.chatroom-form-container', this.el).forEach(e => u.addClass('hidden', e));
                this.renderAfterTransition();
            },

            /**
             * Start the process of configuring a groupchat, either by
             * rendering a configuration form, or by auto-configuring
             * based on the "roomconfig" data stored on the
             * {@link _converse.ChatRoom}.
             * Stores the new configuration on the {@link _converse.ChatRoom}
             * once completed.
             * @private
             * @method _converse.ChatRoomView#getAndRenderConfigurationForm
             * @param { Event } ev - DOM event that might be passed in if this
             *   method is called due to a user action. In this
             *   case, auto-configure won't happen, regardless of
             *   the settings.
             */
            getAndRenderConfigurationForm () {
                if (!this.config_form || !u.isVisible(this.config_form.el)) {
                    this.showSpinner();
                    this.model.fetchRoomConfiguration()
                        .then(iq => this.renderConfigurationForm(iq))
                        .catch(e => log.error(e));
                } else {
                    this.closeForm();
                }
            },

            hideChatRoomContents () {
                const container_el = this.el.querySelector('.chatroom-body');
                if (container_el !== null) {
                    [].forEach.call(container_el.children, child => child.classList.add('hidden'));
                }
            },

            renderPasswordForm () {
                this.hideChatRoomContents();
                const message = this.model.get('password_validation_message');
                this.model.save('password_validation_message', undefined);

                if (!this.password_form) {
                    this.password_form = new _converse.MUCPasswordForm({
                        'model': new Model({
                            'validation_message': message
                        }),
                        'chatroomview': this,
                    });
                    const container_el = this.el.querySelector('.chatroom-body');
                    container_el.insertAdjacentElement('beforeend', this.password_form.el);
                } else {
                    this.password_form.model.set('validation_message', message);
                }
                u.showElement(this.password_form.el);
                this.model.session.save('connection_status', converse.ROOMSTATUS.PASSWORD_REQUIRED);
            },

            showDestroyedMessage () {
                u.hideElement(this.el.querySelector('.chat-area'));
                u.hideElement(this.el.querySelector('.occupants'));
                sizzle('.spinner', this.el).forEach(u.removeElement);

                const reason = this.model.get('destroyed_reason');
                const moved_jid = this.model.get('moved_jid');
                this.model.save({
                    'destroyed_reason': undefined,
                    'moved_jid': undefined
                });
                const container = this.el.querySelector('.disconnect-container');
                container.innerHTML = tpl_chatroom_destroyed({
                    '__':__,
                    'jid': moved_jid,
                    'reason': reason ? `"${reason}"` : null
                });
                const switch_el = container.querySelector('a.switch-chat');
                if (switch_el) {
                    switch_el.addEventListener('click', async ev => {
                        ev.preventDefault();
                        const room = await _converse.api.rooms.get(moved_jid, null, true);
                        room.maybeShow(true);
                        this.model.destroy();
                    });
                }
                u.showElement(container);
            },

            showDisconnectMessage () {
                const message = this.model.get('disconnection_message');
                if (!message) {
                    return;
                }
                u.hideElement(this.el.querySelector('.chat-area'));
                u.hideElement(this.el.querySelector('.occupants'));
                sizzle('.spinner', this.el).forEach(u.removeElement);

                const messages = [message];
                const actor = this.model.get('disconnection_actor');
                if (actor) {
                    messages.push(__('This action was done by %1$s.', actor));
                }
                const reason = this.model.get('disconnection_reason');
                if (reason) {
                    messages.push(__('The reason given is: "%1$s".', reason));
                }
                this.model.save({
                    'disconnection_message': undefined,
                    'disconnection_reason': undefined,
                    'disconnection_actor': undefined
                });
                const container = this.el.querySelector('.disconnect-container');
                container.innerHTML = tpl_chatroom_disconnect({messages})
                u.showElement(container);
            },

            getNotificationWithMessage (message) {
                let el = this.content.lastElementChild;
                while (el) {
                    if (!u.hasClass(el, 'chat-info')) {
                        return;
                    }
                    if (el.textContent === message) {
                        return el;
                    }
                    el = el.previousElementSibling;
                }
            },

            removeEmptyHistoryFeedback () {
                if (_converse.muc_show_logs_before_join &&
                        this.content.firstElementChild.matches('.empty-history-feedback')) {
                    this.content.removeChild(this.content.firstElementChild);
                }
            },

            insertDayIndicator () {
                this.removeEmptyHistoryFeedback();
                return _converse.ChatBoxView.prototype.insertDayIndicator.apply(this, arguments);
            },

            insertMessage (view) {
                this.removeEmptyHistoryFeedback();
                return _converse.ChatBoxView.prototype.insertMessage.call(this, view);
            },

            insertNotification (message) {
                setNotification(message);
                // this.removeEmptyHistoryFeedback();
                // this.insertInfoMessage('beforeEnd', {
                //     'isodate': (new Date()).toISOString(),
                //     'extra_classes': 'chat-event',
                //     'message': message
                // });
            },

            onOccupantAdded (occupant) {
                if (occupant.get('jid') === _converse.bare_jid) {
                    this.renderHeading();
                    this.renderBottomPanel();
                }
                if (occupant.get('show') === 'online') {
                    this.showJoinNotification(occupant);
                }
            },

            onOccupantRemoved (occupant) {
                if (this.model.session.get('connection_status') ===  converse.ROOMSTATUS.ENTERED &&
                        occupant.get('show') === 'online') {
                    this.showLeaveNotification(occupant);
                }
            },

            showJoinOrLeaveNotification (occupant) {
                if (occupant.get('states').includes('303')) {
                    return;
                }
                if (occupant.get('show') === 'offline') {
                    this.showLeaveNotification(occupant);
                } else if (occupant.get('show') === 'online') {
                    this.showJoinNotification(occupant);
                }
            },

            /**
             * Working backwards, get today's most recent join/leave notification
             * from the same user (if any exists) after the most recent chat message.
             * @private
             * @method _converse.ChatRoomView#getPreviousJoinOrLeaveNotification
             * @param {HTMLElement} el
             * @param {string} nick
             */
            getPreviousJoinOrLeaveNotification (el, nick) {
                const today = (new Date()).toISOString().split('T')[0];
                while (el !== null) {
                    if (!el.classList.contains('chat-info')) {
                        return;
                    }
                    // Check whether el is still from today.
                    // We don't use `Dayjs.same` here, since it's about 4 times slower.
                    const date = el.getAttribute('data-isodate');
                    if (date && date.split('T')[0] !== today) {
                        return;
                    }
                    const data = get(el, 'dataset', {});
                    if (data.join === nick ||
                            data.leave === nick ||
                            data.leavejoin === nick ||
                            data.joinleave === nick) {
                        return el;
                    }
                    el = el.previousElementSibling;
                }
            },

            showJoinNotification (occupant) {
                if (!_converse.muc_show_join_leave ||
                        this.model.session.get('connection_status') !==  converse.ROOMSTATUS.ENTERED) {
                    return;
                }
                const nick = occupant.get('nick'),
                      stat = _converse.muc_show_join_leave_status ? occupant.get('status') : null,
                      prev_info_el = this.getPreviousJoinOrLeaveNotification(this.content.lastElementChild, nick),
                      data = get(prev_info_el, 'dataset', {});

                if (data.leave === nick) {
                    let message;
                    if (stat) {
                        message = __('%1$s has left and re-entered the groupchat. "%2$s"', nick, stat);
                    } else {
                        message = __('%1$s has left and re-entered the groupchat', nick);
                    }
                    const data = {
                        'data_name': 'leavejoin',
                        'data_value': nick,
                        'isodate': (new Date()).toISOString(),
                        'extra_classes': 'chat-event',
                        'message': message
                    };
                    this.content.removeChild(prev_info_el);
                    this.insertNotification('beforeEnd', data);
                    const el = this.content.lastElementChild;
                    setTimeout(() => u.addClass('fade-out', el), 5000);
                    setTimeout(() => el.parentElement && el.parentElement.removeChild(el), 5500);
                } else {
                    let message;
                    if (stat) {
                        message = __('%1$s has entered the groupchat. "%2$s"', nick, stat);
                    } else {
                        message = __('%1$s has entered the groupchat', nick);
                    }
                    const data = {
                        'data_name': 'join',
                        'data_value': nick,
                        'isodate': (new Date()).toISOString(),
                        'extra_classes': 'chat-event',
                        'message': message
                    };
                    if (prev_info_el) {
                        this.content.removeChild(prev_info_el);
                        this.insertInfoMessage('beforeEnd', data);
                    } else {
                        this.insertInfoMessage('beforeEnd', data);
                        // this.insertDayIndicator(this.content.lastElementChild);
                    }
                }
                this.scrollDown();
            },

            showLeaveNotification (occupant) {
                if (!_converse.muc_show_join_leave ||
                        occupant.get('states').includes('303') ||
                        occupant.get('states').includes('307')) {
                    return;
                }
                const nick = occupant.get('nick');
                const stat = _converse.muc_show_join_leave_status ? occupant.get('status') : null;
                const prev_info_el = this.getPreviousJoinOrLeaveNotification(this.content.lastElementChild, nick);
                const dataset = get(prev_info_el, 'dataset', {});

                if (dataset.join === nick) {
                    let message;
                    if (stat) {
                        message = __('%1$s has entered and left the groupchat. "%2$s"', nick, stat);
                    } else {
                        message = __('%1$s has entered and left the groupchat', nick);
                    }
                    const data = {
                        'data_name': 'joinleave',
                        'data_value': nick,
                        'isodate': (new Date()).toISOString(),
                        'extra_classes': 'chat-event',
                        'message': message
                    };
                    this.content.removeChild(prev_info_el);
                    this.insertInfoMessage('beforeEnd', data);
                    const el = this.content.lastElementChild;
                    setTimeout(() => u.addClass('fade-out', el), 5000);
                    setTimeout(() => el.parentElement && el.parentElement.removeChild(el), 5500);
                } else {
                    let message;
                    if (stat) {
                        message = __('%1$s has left the groupchat. "%2$s"', nick, stat);
                    } else {
                        message = __('%1$s has left the groupchat', nick);
                    }
                    const data = {
                        'message': message,
                        'isodate': (new Date()).toISOString(),
                        'extra_classes': 'chat-event',
                        'data_name': 'leave',
                        'data_value': nick
                    }
                    if (prev_info_el) {
                        this.content.removeChild(prev_info_el);
                        this.insertInfoMessage('beforeEnd', data);
                    } else {
                        this.insertInfoMessage('beforeEnd', data);
                        // TODO: create day indicator
                        // this.insertDayIndicator(this.content.lastElementChild);
                    }
                }
                this.scrollDown();
            },

            /**
             * Rerender the groupchat after some kind of transition. For
             * example after the spinner has been removed or after a
             * form has been submitted and removed.
             * @private
             * @method _converse.ChatRoomView#renderAfterTransition
             */
            renderAfterTransition () {
                const conn_status = this.model.session.get('connection_status')
                if (conn_status == converse.ROOMSTATUS.NICKNAME_REQUIRED) {
                    this.renderNicknameForm();
                } else if (conn_status == converse.ROOMSTATUS.PASSWORD_REQUIRED) {
                    this.renderPasswordForm();
                } else if (conn_status == converse.ROOMSTATUS.ENTERED) {
                    this.hideChatRoomContents();
                    u.showElement(this.el.querySelector('.chat-area'));
                    u.showElement(this.el.querySelector('.occupants'));
                    this.scrollDown();
                }
            },

            showSpinner () {
                sizzle('.spinner', this.el).forEach(u.removeElement);
                this.hideChatRoomContents();
                const container_el = this.el.querySelector('.chatroom-body');
                container_el.insertAdjacentHTML('afterbegin', tpl_spinner());
            },

            /**
             * Check if the spinner is being shown and if so, hide it.
             * Also make sure then that the chat area and occupants
             * list are both visible.
             * @private
             * @method _converse.ChatRoomView#hideSpinner
             */
            hideSpinner () {
                const spinner = this.el.querySelector('.spinner');
                if (spinner !== null) {
                    u.removeElement(spinner);
                    this.renderAfterTransition();
                }
                return this;
            },

            setChatRoomSubject () {
                const subject = this.model.get('subject');
                if (!subject.text && !subject.author) {
                    return; // Probably a new MUC
                }
                const author = subject.author;
                // For translators: the %1$s part will get
                // replaced by the user's name.
                // Example: Topic set by JC Brand
                const message = subject.text ? __('Topic set by %1$s', author) : __('Topic cleared by %1$s', author);
                const date = (new Date()).toISOString();
                this.insertInfoMessage(
                    'beforeEnd', {
                        'isodate': date,
                        'extra_classes': 'chat-event',
                        'message': message
                    }
                );
                this.scrollDown();
            }
        });


        /**
         * View which renders MUC section of the control box.
         * @class
         * @namespace _converse.RoomsPanel
         * @memberOf _converse
         */
        _converse.RoomsPanel = View.extend({
            tagName: 'div',
            className: 'controlbox-section',
            id: 'chatrooms',
            events: {
                'click a.controlbox-heading__btn.show-add-muc-modal': 'showAddRoomModal',
                'click a.controlbox-heading__btn.show-list-muc-modal': 'showListRoomsModal'
            },

            render () {
                this.el.innerHTML = tpl_room_panel({
                    'heading_chatrooms': __('Groupchats'),
                    'title_new_room': __('Add a new groupchat'),
                    'title_list_rooms': __('Query for groupchats')
                });
                return this;
            },

            showAddRoomModal (ev) {
                if (this.add_room_modal === undefined) {
                    this.add_room_modal = new _converse.AddChatRoomModal({'model': this.model});
                }
                this.add_room_modal.show(ev);
            },

            showListRoomsModal(ev) {
                if (this.list_rooms_modal === undefined) {
                    this.list_rooms_modal = new _converse.ListChatRoomsModal({'model': this.model});
                }
                this.list_rooms_modal.show(ev);
            }
        });


        _converse.MUCConfigForm = View.extend({
            className: 'chatroom-form-container muc-config-form',

            initialize (attrs) {
                this.chatroomview = attrs.chatroomview;
                this.listenTo(this.chatroomview.model.features, 'change:passwordprotected', this.render);
                this.listenTo(this.chatroomview.model.features, 'change:config_stanza', this.render);
                this.render();
            },

            toHTML () {
                const stanza = u.toStanza(this.model.get('config_stanza'));
                const whitelist = _converse.roomconfig_whitelist;
                let fields = sizzle('field', stanza);
                if (whitelist.length) {
                    fields = fields.filter(f => whitelist.includes(f.getAttribute('var')));
                }
                const password_protected = this.model.features.get('passwordprotected');
                const options = {
                    'new_password': !password_protected,
                    'fixed_username': this.model.get('jid')
                };
                return tpl_muc_config_form({
                    'closeConfigForm': ev => this.closeConfigForm(ev),
                    'fields': fields.map(f => u.xForm2webForm(f, stanza, options)),
                    'instructions': get(stanza.querySelector('instructions'), 'textContent'),
                    'submitConfigForm': ev => this.submitConfigForm(ev),
                    'title': get(stanza.querySelector('title'), 'textContent')
                });
            },

            async submitConfigForm (ev) {
                ev.preventDefault();
                const inputs = sizzle(':input:not([type=button]):not([type=submit])', ev.target);
                const configArray = inputs.map(u.webForm2xForm);
                try {
                    await this.model.sendConfiguration(configArray);
                } catch (e) {
                    log.error(e);
                    this.showErrorMessage(
                        __("Sorry, an error occurred while trying to submit the config form.") + " " +
                        __("Check your browser's developer console for details.")
                    );
                }
                await this.model.refreshDiscoInfo();
                this.chatroomview.closeForm();
            },

            closeConfigForm (ev) {
                ev.preventDefault();
                this.chatroomview.closeForm();
            }
        });


        _converse.MUCPasswordForm = View.extend({
            className: 'chatroom-form-container muc-password-form',

            initialize (attrs) {
                this.chatroomview = attrs.chatroomview;
                this.listenTo(this.model, 'change:validation_message', this.render);
                this.render();
            },

            toHTML () {
                return tpl_muc_password_form({
                    'jid': this.model.get('jid'),
                    'submitPassword': ev => this.submitPassword(ev),
                    'validation_message':  this.model.get('validation_message')
                });
            },

            submitPassword (ev) {
                ev.preventDefault();
                const password = this.el.querySelector('input[type=password]').value;
                this.chatroomview.model.join(this.chatroomview.model.get('nick'), password);
                this.model.set('validation_message', null);
            }
        });


        _converse.MUCInviteModal = BootstrapModal.extend({
            id: "muc-invite-modal",

            initialize () {
                BootstrapModal.prototype.initialize.apply(this, arguments);
                this.listenTo(this.model, 'change', this.render);
                this.initInviteWidget();
            },

            toHTML () {
                return tpl_muc_invite_modal(Object.assign(
                    this.model.toJSON(), {
                        'submitInviteForm': ev => this.submitInviteForm(ev)
                    })
                );
            },

            initInviteWidget () {
                if (this.invite_auto_complete) {
                    this.invite_auto_complete.destroy();
                }
                const list = _converse.roster.map(i => ({'label': i.getDisplayName(), 'value': i.get('jid')}));
                const el = this.el.querySelector('.suggestion-box').parentElement;
                this.invite_auto_complete = new _converse.AutoComplete(el, {
                    'min_chars': 1,
                    'list': list
                });
            },

            submitInviteForm (ev) {
                ev.preventDefault();
                // TODO: Add support for sending an invite to multiple JIDs
                const data = new FormData(ev.target);
                const jid = data.get('invitee_jids');
                const reason = data.get('reason');
                if (u.isValidJID(jid)) {
                    // TODO: Create and use API here
                    this.chatroomview.model.directInvite(jid, reason);
                    this.modal.hide();
                } else {
                    this.model.set({'invalid_invite_jid': true});
                }
            }
        });


        _converse.MUCSidebar = View.extend({
            tagName: 'div',
            className: 'occupants col-md-3 col-4',

            async initialize () {
                this.chatroomview = this.model.chatroomview;
                this.listenTo(this.model, 'add', this.render);
                this.listenTo(this.model, 'remove', this.render);
                this.listenTo(this.model, 'change', this.render);
                this.listenTo(this.chatroomview.model.features, 'change', this.render);
                this.listenTo(this.chatroomview.model, 'change:hidden_occupants', this.setVisibility);
                this.render();
                await this.model.fetched;
            },

            toHTML () {
                return tpl_muc_sidebar(
                    Object.assign(this.chatroomview.model.toJSON(), {
                        _converse,
                        'features': this.chatroomview.model.features,
                        'occupants': this.model.models,
                        'invitesAllowed': () => this.invitesAllowed()
                    })
                );
            },

            afterRender () {
                this.setVisibility();
            },

            setVisibility () {
                if (this.chatroomview.model.get('hidden_occupants')) {
                    u.hideElement(this.el);
                } else {
                    u.showElement(this.el);
                    this.setOccupantsHeight();
                }
            },

            setOccupantsHeight () {
                // TODO: remove the features section in sidebar and then this as well
                const el = this.el.querySelector('.chatroom-features');
                if (el) {
                    this.el.querySelector('.occupant-list').style.cssText =
                        `height: calc(100% - ${el.offsetHeight}px - 5em);`;
                }
            },

            invitesAllowed () {
                return _converse.allow_muc_invitations &&
                    (this.chatroomview.model.features.get('open') ||
                        this.chatroomview.model.getOwnAffiliation() === "owner"
                    );
            }
        });


        function setMUCDomain (domain, controlboxview) {
            controlboxview.getRoomsPanel().model.save('muc_domain', Strophe.getDomainFromJid(domain));
        }

        function setMUCDomainFromDisco (controlboxview) {
            /* Check whether service discovery for the user's domain
             * returned MUC information and use that to automatically
             * set the MUC domain in the "Add groupchat" modal.
             */
            function featureAdded (feature) {
                if (!feature) { return; }
                if (feature.get('var') === Strophe.NS.MUC) {
                    feature.entity.getIdentity('conference', 'text').then(identity => {
                        if (identity) {
                            setMUCDomain(feature.get('from'), controlboxview);
                        }
                    });
                }
            }
            _converse.api.waitUntil('discoInitialized').then(() => {
                _converse.api.listen.on('serviceDiscovered', featureAdded);
                // Features could have been added before the controlbox was
                // initialized. We're only interested in MUC
                _converse.disco_entities.each(entity => featureAdded(entity.features.findWhere({'var': Strophe.NS.MUC })));
            }).catch(e => log.error(e));
        }

        function fetchAndSetMUCDomain (controlboxview) {
            if (controlboxview.model.get('connected')) {
                if (!controlboxview.getRoomsPanel().model.get('muc_domain')) {
                    if (_converse.muc_domain === undefined) {
                        setMUCDomainFromDisco(controlboxview);
                    } else {
                        setMUCDomain(_converse.muc_domain, controlboxview);
                    }
                }
            }
        }


        /************************ BEGIN Event Handlers ************************/
        _converse.api.listen.on('chatBoxViewsInitialized', () => {
            async function addView (model) {
                const views = _converse.chatboxviews;
                if (!views.get(model.get('id')) &&
                        model.get('type') === _converse.CHATROOMS_TYPE &&
                        model.isValid()
                ) {
                    await model.initialized;
                    return views.add(model.get('id'), new _converse.ChatRoomView({model}));
                }
            }
            _converse.chatboxes.on('add', addView);
        });

        _converse.api.listen.on('clearSession', () => {
            const view = _converse.chatboxviews.get('controlbox');
            if (view && view.roomspanel) {
                view.roomspanel.model.destroy();
                view.roomspanel.remove();
                delete view.roomspanel;
            }
        });

        _converse.api.listen.on('controlBoxInitialized', (view) => {
            if (!_converse.allow_muc) {
                return;
            }
            fetchAndSetMUCDomain(view);
            view.model.on('change:connected', () => fetchAndSetMUCDomain(view));
        });
        /************************ END Event Handlers ************************/


        /************************ BEGIN API ************************/
        Object.assign(_converse.api, {
            /**
             * The "roomviews" namespace groups methods relevant to chatroom
             * (aka groupchats) views.
             *
             * @namespace _converse.api.roomviews
             * @memberOf _converse.api
             */
            roomviews: {
                /**
                 * Retrieves a groupchat (aka chatroom) view. The chat should already be open.
                 *
                 * @method _converse.api.roomviews.get
                 * @param {String|string[]} name - e.g. 'coven@conference.shakespeare.lit' or
                 *  ['coven@conference.shakespeare.lit', 'cave@conference.shakespeare.lit']
                 * @returns {View} View representing the groupchat
                 *
                 * @example
                 * // To return a single view, provide the JID of the groupchat
                 * const view = _converse.api.roomviews.get('coven@conference.shakespeare.lit');
                 *
                 * @example
                 * // To return an array of views, provide an array of JIDs:
                 * const views = _converse.api.roomviews.get(['coven@conference.shakespeare.lit', 'cave@conference.shakespeare.lit']);
                 *
                 * @example
                 * // To return views of all open groupchats, call the method without any parameters::
                 * const views = _converse.api.roomviews.get();
                 *
                 */
                get (jids) {
                    if (Array.isArray(jids)) {
                        const views = _converse.api.chatviews.get(jids);
                        return views.filter(v => v.model.get('type') === _converse.CHATROOMS_TYPE)
                    } else {
                        const view = _converse.api.chatviews.get(jids);
                        if (view.model.get('type') === _converse.CHATROOMS_TYPE) {
                            return view;
                        } else {
                            return null;
                        }
                    }
                },
                /**
                 * Lets you close open chatrooms.
                 *
                 * You can call this method without any arguments to close
                 * all open chatrooms, or you can specify a single JID or
                 * an array of JIDs.
                 *
                 * @method _converse.api.roomviews.close
                 * @param {(String[]|String)} jids The JID or array of JIDs of the chatroom(s)
                 * @returns { Promise } - Promise which resolves once the views have been closed.
                 */
                close (jids) {
                    let views;
                    if (jids === undefined) {
                        views = _converse.chatboxviews;
                    } else if (isString(jids)) {
                        views = [_converse.chatboxviews.get(jids)].filter(v => v);
                    } else if (Array.isArray(jids)) {
                        views = jids.map(jid => _converse.chatboxviews.get(jid));
                    }
                    return Promise.all(views.map(v => (v.is_chatroom && v.model && v.close())))
                }
            }
        });
    }
});

