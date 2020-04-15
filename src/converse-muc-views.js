/**
 * @module converse-muc-views
 * @copyright 2020, the Converse.js contributors
 * @description XEP-0045 Multi-User Chat Views
 * @license Mozilla Public License (MPLv2)
 */
import "converse-modal";
import "@converse/headless/utils/muc";
import { Model } from 'skeletor.js/src/model.js';
import { View } from 'skeletor.js/src/view.js';
import { debounce, head, isString, isUndefined } from "lodash";
import { BootstrapModal } from "./converse-modal.js";
import { render } from "lit-html";
import { __ } from '@converse/headless/i18n';
import RoomDetailsModal from 'modals/muc-details.js';
import converse from "@converse/headless/converse-core";
import log from "@converse/headless/log";
import st from "@converse/headless/utils/stanza";
import tpl_add_chatroom_modal from "templates/add_chatroom_modal.js";
import tpl_chatroom from "templates/chatroom.js";
import tpl_chatroom_bottom_panel from "templates/chatroom_bottom_panel.html";
import tpl_chatroom_destroyed from "templates/chatroom_destroyed.html";
import tpl_chatroom_disconnect from "templates/chatroom_disconnect.html";
import tpl_chatroom_head from "templates/chatroom_head.js";
import tpl_chatroom_nickname_form from "templates/chatroom_nickname_form.html";
import tpl_info from "templates/info.html";
import tpl_list_chatrooms_modal from "templates/list_chatrooms_modal.js";
import tpl_moderator_tools_modal from "templates/moderator_tools_modal.js";
import tpl_muc_config_form from "templates/muc_config_form.js";
import tpl_muc_invite_modal from "templates/muc_invite_modal.js";
import tpl_muc_password_form from "templates/muc_password_form.js";
import tpl_muc_sidebar from "templates/muc_sidebar.js";
import tpl_room_description from "templates/room_description.html";
import tpl_room_panel from "templates/room_panel.html";
import tpl_spinner from "templates/spinner.html";
import xss from "xss/dist/xss";

const { Strophe, sizzle, $iq, $pres } = converse.env;
const u = converse.env.utils;

const ROLES = ['moderator', 'participant', 'visitor'];
const AFFILIATIONS = ['owner', 'admin', 'member', 'outcast', 'none'];
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
        const { api } = _converse;

        api.promises.add(['roomsPanelRendered']);

        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        api.settings.update({
            'auto_list_rooms': false,
            'cache_muc_messages': true,
            'locked_muc_nickname': false,
            'modtools_disable_query': [],
            'modtools_disable_assign': false,
            'muc_disable_slash_commands': false,
            'muc_mention_autocomplete_filter': 'contains',
            'muc_mention_autocomplete_min_chars': 0,
            'muc_mention_autocomplete_show_avatar': true,
            'muc_roomid_policy': null,
            'muc_roomid_policy_hint': null,
            'roomconfig_whitelist': [],
            'show_retraction_warning': true,
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
                api.trigger('roomsPanelRendered');
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

        /* Insert groupchat info (based on returned #disco IQ stanza)
         * @function insertRoomInfo
         * @param { HTMLElement } el - The HTML DOM element that contains the info.
         * @param { XMLElement } stanza - The IQ stanza containing the groupchat info.
         */
        function insertRoomInfo (el, stanza) {
            // All MUC features found here: https://xmpp.org/registrar/disco-features.html
            el.querySelector('span.spinner').remove();
            el.querySelector('a.room-info').classList.add('selected');
            el.insertAdjacentHTML(
                'beforeEnd',
                tpl_room_description({
                    'jid': stanza.getAttribute('from'),
                    'desc': head(sizzle('field[var="muc#roominfo_description"] value', stanza))?.textContent,
                    'occ': head(sizzle('field[var="muc#roominfo_occupants"] value', stanza))?.textContent,
                    'hidden': sizzle('feature[var="muc_hidden"]', stanza).length,
                    'membersonly': sizzle('feature[var="muc_membersonly"]', stanza).length,
                    'moderated': sizzle('feature[var="muc_moderated"]', stanza).length,
                    'nonanonymous': sizzle('feature[var="muc_nonanonymous"]', stanza).length,
                    'open': sizzle('feature[var="muc_open"]', stanza).length,
                    'passwordprotected': sizzle('feature[var="muc_passwordprotected"]', stanza).length,
                    'persistent': sizzle('feature[var="muc_persistent"]', stanza).length,
                    'publicroom': sizzle('feature[var="muc_publicroom"]', stanza).length,
                    'semianonymous': sizzle('feature[var="muc_semianonymous"]', stanza).length,
                    'temporary': sizzle('feature[var="muc_temporary"]', stanza).length,
                    'unmoderated': sizzle('feature[var="muc_unmoderated"]', stanza).length,
                    'label_desc': __('Description:'),
                    'label_jid': __('Groupchat Address (JID):'),
                    'label_occ': __('Participants:'),
                    'label_features': __('Features:'),
                    'label_requires_auth': __('Requires authentication'),
                    'label_hidden': __('Hidden'),
                    'label_requires_invite': __('Requires an invitation'),
                    'label_moderated': __('Moderated'),
                    'label_non_anon': __('Non-anonymous'),
                    'label_open_room': __('Open'),
                    'label_permanent_room': __('Permanent'),
                    'label_public': __('Public'),
                    'label_semi_anon':  __('Semi-anonymous'),
                    'label_temp_room':  __('Temporary'),
                    'label_unmoderated': __('Unmoderated')
                }));
        }

        /**
         * Show/hide extra information about a groupchat in a listing.
         * @function toggleRoomInfo
         * @param { Event }
         */
        function toggleRoomInfo (ev) {
            const parent_el = u.ancestor(ev.target, '.room-item');
            const div_el = parent_el.querySelector('div.room-info');
            if (div_el) {
                u.slideIn(div_el).then(u.removeElement)
                parent_el.querySelector('a.room-info').classList.remove('selected');
            } else {
                parent_el.insertAdjacentHTML('beforeend', tpl_spinner());
                api.disco.info(ev.target.getAttribute('data-room-jid'), null)
                    .then(stanza => insertRoomInfo(parent_el, stanza))
                    .catch(e => log.error(e));
            }
        }


        _converse.ModeratorToolsModal = BootstrapModal.extend({
            id: "converse-modtools-modal",

            initialize (attrs) {
                this.chatroomview = attrs.chatroomview;
                BootstrapModal.prototype.initialize.apply(this, arguments);

                this.affiliations_filter = '';
                this.roles_filter = '';

                this.listenTo(this.model, 'change:role', () => {
                    this.users_with_role = this.chatroomview.model.getOccupantsWithRole(this.model.get('role'));
                    this.render();
                });
                this.listenTo(this.model, 'change:affiliation', async () => {
                    this.loading_users_with_affiliation = true;
                    this.users_with_affiliation = null;
                    this.render();
                    const chatroom = this.chatroomview.model;
                    const affiliation = this.model.get('affiliation');
                    if (this.shouldFetchAffiliationsList()) {
                        this.users_with_affiliation = await chatroom.getAffiliationList(affiliation);
                    } else {
                        this.users_with_affiliation = chatroom.getOccupantsWithAffiliation(affiliation);
                    }
                    this.loading_users_with_affiliation = false;
                    this.render();
                });
            },

            toHTML () {
                const occupant = this.chatroomview.model.occupants.findWhere({'jid': _converse.bare_jid});
                return tpl_moderator_tools_modal(Object.assign(this.model.toJSON(), {
                    'affiliations_filter': this.affiliations_filter,
                    'assignAffiliation': ev => this.assignAffiliation(ev),
                    'assignRole': ev => this.assignRole(ev),
                    'assignable_affiliations': this.getAssignableAffiliations(occupant),
                    'assignable_roles': this.getAssignableRoles(occupant),
                    'filterAffiliationResults': ev => this.filterAffiliationResults(ev),
                    'filterRoleResults': ev => this.filterRoleResults(ev),
                    'loading_users_with_affiliation': this.loading_users_with_affiliation,
                    'queryAffiliation': ev => this.queryAffiliation(ev),
                    'queryRole': ev => this.queryRole(ev),
                    'queryable_affiliations': AFFILIATIONS.filter(a => !_converse.modtools_disable_query.includes(a)),
                    'queryable_roles': ROLES.filter(a => !_converse.modtools_disable_query.includes(a)),
                    'roles_filter': this.roles_filter,
                    'switchTab': ev => this.switchTab(ev),
                    'toggleForm': ev => this.toggleForm(ev),
                    'users_with_affiliation': this.users_with_affiliation,
                    'users_with_role': this.users_with_role
                }));
            },

            getAssignableAffiliations (occupant) {
                const disabled = _converse.modtools_disable_assign;
                if (!Array.isArray(disabled)) {
                    return disabled ? [] : AFFILIATIONS;
                } else if (occupant.get('affiliation') === 'owner') {
                    return AFFILIATIONS.filter(a => !disabled.includes(a));
                } else if (occupant.get('affiliation') === 'admin') {
                    return AFFILIATIONS.filter(a => !['owner', ...disabled].includes(a));
                } else {
                    return [];
                }
            },

            getAssignableRoles (occupant) {
                const disabled = _converse.modtools_disable_assign;
                if (!Array.isArray(disabled)) {
                    return disabled ? [] : ROLES;
                } else if (occupant.get('role') === 'moderator') {
                    return ROLES.filter(r => !disabled.includes(r));
                } else {
                    return [];
                }
            },

            shouldFetchAffiliationsList () {
                const affiliation = this.model.get('affiliation');
                if (affiliation === 'none') {
                    return false;
                }
                const chatroom = this.chatroomview.model;
                const auto_fetched_affs = chatroom.occupants.getAutoFetchedAffiliationLists();
                if (auto_fetched_affs.includes(affiliation)) {
                    return false;
                } else {
                    return true;
                }
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

            filterRoleResults (ev) {
                this.roles_filter = ev.target.value;
                this.render();
            },

            filterAffiliationResults (ev) {
                this.affiliations_filter = ev.target.value;
                this.render();
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
                this.items = [];
                this.loading_items = false;

                BootstrapModal.prototype.initialize.apply(this, arguments);
                if (_converse.muc_domain && !this.model.get('muc_domain')) {
                    this.model.save('muc_domain', _converse.muc_domain);
                }
                this.listenTo(this.model, 'change:muc_domain', this.onDomainChange);
            },

            toHTML () {
                const muc_domain = this.model.get('muc_domain') || _converse.muc_domain;
                return tpl_list_chatrooms_modal(
                    Object.assign(this.model.toJSON(), {
                        'show_form': !_converse.locked_muc_domain,
                        'server_placeholder': muc_domain ? muc_domain : __('conference.example.org'),
                        'items': this.items,
                        'loading_items': this.loading_items,
                        'openRoom': ev => this.openRoom(ev),
                        'setDomainFromEvent': ev => this.setDomainFromEvent(ev),
                        'submitForm': ev => this.showRooms(ev),
                        'toggleRoomInfo': ev => this.toggleRoomInfo(ev)
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
                api.rooms.open(jid, {'name': name}, true);
            },

            toggleRoomInfo (ev) {
                ev.preventDefault();
                toggleRoomInfo(ev);
            },

            onDomainChange () {
                _converse.auto_list_rooms && this.updateRoomsList();
            },

            /**
             * Handle the IQ stanza returned from the server, containing
             * all its public groupchats.
             * @private
             * @method _converse.ChatRoomView#onRoomsFound
             * @param { HTMLElement } iq
             */
            onRoomsFound (iq) {
                const rooms = iq ? sizzle('query item', iq) : [];
                if (rooms.length) {
                    this.model.set({'feedback_text': __('Groupchats found')}, {'silent': true});
                    this.items = rooms.map(st.getAttributes);
                    this.loading_items = false;
                    this.render();
                } else {
                    this.model.set('feedback_text', __('No groupchats found'));
                }
                return true;
            },

            /**
             * Send an IQ stanza to the server asking for all groupchats
             * @private
             * @method _converse.ChatRoomView#updateRoomsList
             */
            updateRoomsList () {
                const iq = $iq({
                    'to': this.model.get('muc_domain'),
                    'from': _converse.connection.jid,
                    'type': "get"
                }).c("query", {xmlns: Strophe.NS.DISCO_ITEMS});
                api.sendIQ(iq)
                    .then(iq => this.onRoomsFound(iq))
                    .catch(() => this.onRoomsFound())
            },

            showRooms (ev) {
                ev.preventDefault();
                this.loading_items = true;
                this.render();

                const data = new FormData(ev.target);
                this.model.setDomain(data.get('server'));
                this.updateRoomsList();
            },

            setDomainFromEvent (ev) {
                this.model.setDomain(ev.target.value);
            },

            setNick (ev) {
                this.model.save({nick: ev.target.value});
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
                api.rooms.open(jid, Object.assign(data, {jid}), true);
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

                this.listenTo(this.model.messages, 'add', this.onMessageAdded);
                this.listenTo(this.model.messages, 'change:edited', this.onMessageEdited);
                this.listenTo(this.model.messages, 'rendered', this.scrollDown);
                this.model.messages.on('reset', () => {
                    this.msgs_container.innerHTML = '';
                    this.removeAll();
                });

                this.listenTo(this.model.session, 'change:connection_status', this.onConnectionStatusChanged);

                this.listenTo(this.model, 'change', debounce(() => this.renderHeading(), 250));
                this.listenTo(this.model, 'change:hidden_occupants', this.updateOccupantsToggle);
                this.listenTo(this.model, 'configurationNeeded', this.getAndRenderConfigurationForm);
                this.listenTo(this.model, 'destroy', this.hide);
                this.listenTo(this.model, 'show', this.show);

                this.listenTo(this.model.features, 'change:moderated', this.renderBottomPanel);
                this.listenTo(this.model.features, 'change:open', this.renderHeading);

                this.listenTo(this.model.occupants, 'add', this.onOccupantAdded);
                this.listenTo(this.model.occupants, 'remove', this.onOccupantRemoved);
                this.listenTo(this.model.occupants, 'change:show', this.showJoinOrLeaveNotification);
                this.listenTo(this.model.occupants, 'change:role', this.onOccupantRoleChanged);
                this.listenTo(this.model.occupants, 'change:affiliation', this.onOccupantAffiliationChanged);

                // Bind so that we can pass it to addEventListener and removeEventListener
                this.onMouseMove =  this.onMouseMove.bind(this);
                this.onMouseUp =  this.onMouseUp.bind(this);

                await this.render();

                // Needs to be registered after render has been called.
                this.listenTo(this.model.notifications, 'change', this.renderNotifications);

                this.createSidebarView();
                await this.updateAfterMessagesFetched();

                // Register later due to await
                const user_settings = await _converse.api.user.settings.getModel();
                this.listenTo(user_settings, 'change:mucs_with_hidden_subject', this.renderHeading);

                this.onConnectionStatusChanged();
                this.model.maybeShow();

                /**
                 * Triggered once a { @link _converse.ChatRoomView } has been opened
                 * @event _converse#chatRoomViewInitialized
                 * @type { _converse.ChatRoomView }
                 * @example _converse.api.listen.on('chatRoomViewInitialized', view => { ... });
                 */
                api.trigger('chatRoomViewInitialized', this);
            },

            async render () {
                this.el.setAttribute('id', this.model.get('box_id'));
                render(tpl_chatroom({
                    'muc_show_logs_before_join': _converse.muc_show_logs_before_join,
                    'show_send_button': _converse.show_send_button
                }), this.el);
                this.notifications = this.el.querySelector('.chat-content__notifications');
                this.content = this.el.querySelector('.chat-content');
                this.msgs_container = this.el.querySelector('.chat-content__messages');

                this.renderBottomPanel();
                if (!_converse.muc_show_logs_before_join &&
                        this.model.session.get('connection_status') !== converse.ROOMSTATUS.ENTERED) {
                    this.showSpinner();
                }
                // Render header as late as possible since it's async and we
                // want the rest of the DOM elements to be available ASAP.
                // Otherwise e.g. this.notifications is not yet defined when accessed elsewhere.
                await this.renderHeading();
                !this.model.get('hidden') && this.show();
            },

            renderNotifications () {
                const actors_per_state = this.model.notifications.toJSON();
                const states = api.settings.get('muc_show_join_leave') ?
                    [...converse.CHAT_STATES, ...converse.MUC_TRAFFIC_STATES] :
                    converse.CHAT_STATES;

                const message = states.reduce((result, state) => {
                    const existing_actors = actors_per_state[state];
                    if (!(existing_actors?.length)) {
                        return result;
                    }
                    const actors = existing_actors.map(a => this.model.getOccupant(a)?.getDisplayName() || a);
                    if (actors.length === 1) {
                        if (state === 'composing') {
                            return `${result} ${__('%1$s is typing', actors[0])}\n`;
                        } else if (state === 'paused') {
                            return `${result} ${__('%1$s has stopped typing', actors[0])}\n`;
                        } else if (state === _converse.GONE) {
                            return `${result} ${__('%1$s has gone away', actors[0])}\n`;
                        } else if (state === 'entered') {
                            return `${result} ${__('%1$s has entered the groupchat', actors[0])}\n`;
                        } else if (state === 'exited') {
                            return `${result} ${__('%1$s has left the groupchat', actors[0])}\n`;
                        }
                    } else if (actors.length > 1) {
                        let actors_str;
                        if (actors.length > 3) {
                            actors_str = `${Array.from(actors).slice(0, 2).join(', ')} and others`;
                        } else {
                            const last_actor = actors.pop();
                            actors_str = __('%1$s and %2$s', actors.join(', '), last_actor);
                        }

                        if (state === 'composing') {
                            return `${result} ${__('%1$s are typing', actors_str)}\n`;
                        } else if (state === 'paused') {
                            return `${result} ${__('%1$s have stopped typing', actors_str)}\n`;
                        } else if (state === _converse.GONE) {
                            return `${result} ${__('%1$s have gone away', actors_str)}\n`;
                        } else if (state === 'entered') {
                            return `${result} ${__('%1$s have entered the groupchat', actors_str)}\n`;
                        } else if (state === 'exited') {
                            return `${result} ${__('%1$s have left the groupchat', actors_str)}\n`;
                        }
                    }
                    return result;
                }, '');
                this.notifications.innerHTML = message;
                message.includes('\n') && this.scrollDown();
            },

            /**
             * Renders the MUC heading if any relevant attributes have changed.
             * @private
             * @method _converse.ChatRoomView#renderHeading
             * @param { _converse.ChatRoom } [item]
             */
            async renderHeading () {
                const tpl = await this.generateHeadingTemplate();
                render(tpl, this.el.querySelector('.chat-head-chatroom'));
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
                return this.model.getAllKnownNicknames().map(nick => ({'label': nick, 'value': `@${nick}`}));
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

                if (message.mayBeRetracted()) {
                    const messages = [__('Are you sure you want to retract this message?')];
                    if (_converse.show_retraction_warning) {
                        messages[1] = retraction_warning;
                    }
                    !!(await api.confirm(__('Confirm'), messages)) && this.retractOwnMessage(message);
                } else if (await message.mayBeModerated()) {
                    if (message.get('sender') === 'me') {
                        let messages = [__('Are you sure you want to retract this message?')];
                        if (_converse.show_retraction_warning) {
                            messages = [messages[0], retraction_warning, messages[1]]
                        }
                        !!(await api.confirm(__('Confirm'), messages)) && this.retractOtherMessage(message);
                    } else {
                        let messages = [
                            __('You are about to retract this message.'),
                            __('You may optionally include a message, explaining the reason for the retraction.')
                        ];
                        if (_converse.show_retraction_warning) {
                            messages = [messages[0], retraction_warning, messages[1]]
                        }
                        const reason = await api.prompt(
                            __('Message Retraction'),
                            messages,
                            __('Optional reason')
                        );
                        (reason !== false) && this.retractOtherMessage(message, reason);
                    }
                } else {
                    const err_msg = __(`Sorry, you're not allowed to retract this message`);
                    api.alert('error', __('Error'), err_msg);
                }
            },

            /**
             * Retract one of your messages in this groupchat.
             * @private
             * @method _converse.ChatRoomView#retractOwnMessage
             * @param { _converse.Message } message - The message which we're retracting.
             */
            retractOwnMessage(message) {
                this.model.retractOwnMessage(message)
                    .catch(e => {
                        const errmsg = __('Sorry, something went wrong while trying to retract your message.');
                        if (u.isErrorStanza(e)) {
                            this.showErrorMessage(errmsg);
                        } else {
                            this.showErrorMessage(errmsg);
                            this.showErrorMessage(e.message);
                        }
                        log.error(e);
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
                const result = await this.model.retractOtherMessage(message, reason);
                if (result === null) {
                    const err_msg = __(`A timeout occurred while trying to retract the message`);
                    api.alert('error', __('Error'), err_msg);
                    log(err_msg, Strophe.LogLevel.WARN);
                } else if (u.isErrorStanza(result)) {
                    const err_msg = __(`Sorry, you're not allowed to retract this message.`);
                    api.alert('error', __('Error'), err_msg);
                    log(err_msg, Strophe.LogLevel.WARN);
                    log(result, Strophe.LogLevel.WARN);
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
                    this.model.room_details_modal = new RoomDetailsModal({'model': this.model});
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
            },

            onOccupantRoleChanged (occupant) {
                if (occupant.get('jid') === _converse.bare_jid) {
                    this.renderBottomPanel();
                }
            },

            /**
             * Returns a list of objects which represent buttons for the groupchat header.
             * @emits _converse#getHeadingButtons
             * @private
             * @method _converse.ChatRoomView#getHeadingButtons
             */
            getHeadingButtons (subject_hidden) {
                const buttons = [];
                buttons.push({
                    'i18n_text': __('Details'),
                    'i18n_title': __('Show more information about this groupchat'),
                    'handler': ev => this.showRoomDetailsModal(ev),
                    'a_class': 'show-room-details-modal',
                    'icon_class': 'fa-info-circle',
                    'name': 'details'
                });

                if (this.model.getOwnAffiliation() === 'owner') {
                    buttons.push({
                        'i18n_text': __('Configure'),
                        'i18n_title': __('Configure this groupchat'),
                        'handler': ev => this.getAndRenderConfigurationForm(ev),
                        'a_class': 'configure-chatroom-button',
                        'icon_class': 'fa-wrench',
                        'name': 'configure'
                    });
                }

                if (this.model.invitesAllowed()) {
                    buttons.push({
                        'i18n_text': __('Invite'),
                        'i18n_title': __('Invite someone to join this groupchat'),
                        'handler': ev => this.showInviteModal(ev),
                        'a_class': 'open-invite-modal',
                        'icon_class': 'fa-user-plus',
                        'name': 'invite'
                    });
                }

                const subject = this.model.get('subject');
                if (subject && subject.text) {
                    buttons.push({
                        'i18n_text': subject_hidden ? __('Show topic') : __('Hide topic'),
                        'i18n_title': subject_hidden ?
                            __('Show the topic message in the heading') :
                            __('Hide the topic in the heading'),
                        'handler': ev => this.toggleTopic(ev),
                        'a_class': 'hide-topic',
                        'icon_class': 'fa-minus-square',
                        'name': 'toggle-topic'
                    });
                }


                const conn_status = this.model.session.get('connection_status');
                if (conn_status === converse.ROOMSTATUS.ENTERED) {
                    const allowed_commands = this.getAllowedCommands();
                    if (allowed_commands.includes('modtools')) {
                        buttons.push({
                            'i18n_text': __('Moderate'),
                            'i18n_title': __('Moderate this groupchat'),
                            'handler': () => this.showModeratorToolsModal(),
                            'a_class': 'moderate-chatroom-button',
                            'icon_class': 'fa-user-cog',
                            'name': 'moderate'
                        });
                    }
                    if (allowed_commands.includes('destroy')) {
                        buttons.push({
                            'i18n_text': __('Destroy'),
                            'i18n_title': __('Remove this groupchat'),
                            'handler': ev => this.destroy(ev),
                            'a_class': 'destroy-chatroom-button',
                            'icon_class': 'fa-trash',
                            'name': 'destroy'
                        });
                    }
                }

                if (!api.settings.get("singleton")) {
                    buttons.push({
                        'i18n_text': __('Leave'),
                        'i18n_title': __('Leave and close this groupchat'),
                        'handler': async ev => {
                            const messages = [__('Are you sure you want to leave this groupchat?')];
                            const result = await api.confirm(__('Confirm'), messages);
                            result && this.close(ev);
                        },
                        'a_class': 'close-chatbox-button',
                        'standalone': api.settings.get("view_mode") === 'overlayed',
                        'icon_class': 'fa-sign-out-alt',
                        'name': 'signout'
                    });
                }
                return _converse.api.hook('getHeadingButtons', this, buttons);
            },

            /**
             * Returns the groupchat heading TemplateResult to be rendered.
             * @private
             * @method _converse.ChatRoomView#generateHeadingTemplate
             */
            async generateHeadingTemplate () {
                const subject_hidden = await this.model.isSubjectHidden();
                const heading_btns = await this.getHeadingButtons(subject_hidden);
                const standalone_btns = heading_btns.filter(b => b.standalone);
                const dropdown_btns = heading_btns.filter(b => !b.standalone);
                return tpl_chatroom_head(
                    Object.assign(this.model.toJSON(), {
                        _converse,
                        subject_hidden,
                        'dropdown_btns': dropdown_btns.map(b => this.getHeadingDropdownItem(b)),
                        'standalone_btns': standalone_btns.map(b => this.getHeadingStandaloneButton(b)),
                        'title': this.model.getDisplayName(),
                }));
            },

            toggleTopic () {
                this.model.toggleSubjectHiddenState();
            },

            showInviteModal (ev) {
                ev.preventDefault();
                if (this.muc_invite_modal === undefined) {
                    this.muc_invite_modal = new _converse.MUCInviteModal({'model': new Model()});
                    // TODO: remove once we have API for sending direct invite
                    this.muc_invite_modal.chatroomview = this;
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
                occupant = occupant || this.model.occupants.findWhere({'jid': _converse.bare_jid});
                if (occupant) {
                    const role = occupant.get('role');
                    if (roles.includes(role)) {
                        return true;
                    }
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
                occupant = occupant || this.model.occupants.findWhere({'jid': _converse.bare_jid});
                if (occupant) {
                    const a = occupant.get('affiliation');
                    if (affiliations.includes(a)) {
                        return true;
                    }
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
                const occupant = this.model.getOccupant(nick_or_jid);
                if (!occupant) {
                    this.showErrorMessage(__(
                        "Couldn't find a participant with that nickname or XMPP address. "+
                        "They might have left the groupchat."
                    ));
                    return;
                }

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

                if (Array.isArray(_converse.muc_disable_slash_commands)) {
                    return allowed_commands.filter(c => !_converse.muc_disable_slash_commands.includes(c));
                } else {
                    return allowed_commands;
                }
            },

            async destroy () {
                const messages = [__('Are you sure you want to destroy this groupchat?')];
                let fields = [{
                    'name': 'challenge',
                    'label': __('Please enter the XMPP address of this groupchat to confirm'),
                    'challenge': this.model.get('jid'),
                    'placeholder': __('name@example.org'),
                    'required': true
                }, {
                    'name': 'reason',
                    'label': __('Optional reason for destroying this groupchat'),
                    'placeholder': __('Reason')
                }, {
                    'name': 'newjid',
                    'label': __('Optional XMPP address for a new groupchat that replaces this one'),
                    'placeholder': __('replacement@example.org')
                }];
                try {
                    fields = await api.confirm(__('Confirm'), messages, fields);
                    const reason = fields.filter(f => f.name === 'reason').pop()?.value;
                    const newjid = fields.filter(f => f.name === 'newjid').pop()?.value;
                    return this.model.sendDestroyIQ(reason, newjid).then(() => this.close())
                } catch (e) {
                    log.error(e);
                }
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
                const disabled_commands = Array.isArray(_converse.muc_disable_slash_commands) ?
                        _converse.muc_disable_slash_commands : [];
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
                        this.destroy().catch(e => this.onCommandError(e));
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
                            api.send($pres({
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
                        const room = await api.rooms.get(moved_jid, null, true);
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

            removeEmptyHistoryFeedback () {
                const el = this.msgs_container.firstElementChild;
                if (_converse.muc_show_logs_before_join && el && el.matches('.empty-history-feedback')) {
                    this.msgs_container.removeChild(this.msgs_container.firstElementChild);
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
                this.removeEmptyHistoryFeedback();
                this.msgs_container.insertAdjacentHTML(
                    'beforeend',
                    tpl_info({
                        'isodate': (new Date()).toISOString(),
                        'extra_classes': 'chat-event',
                        'message': message
                    })
                );
            },

            onOccupantAdded (occupant) {
                if (occupant.get('jid') === _converse.bare_jid) {
                    this.renderHeading();
                    this.renderBottomPanel();
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
                    const data = el?.dataset || {};
                    if (data.join === nick ||
                            data.leave === nick ||
                            data.leavejoin === nick ||
                            data.joinleave === nick) {
                        return el;
                    }
                    el = el.previousElementSibling;
                }
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
                    'instructions': stanza.querySelector('instructions')?.textContent,
                    'submitConfigForm': ev => this.submitConfigForm(ev),
                    'title': stanza.querySelector('title')?.textContent
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
                        'occupants': this.model.models
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
            api.waitUntil('discoInitialized').then(() => {
                api.listen.on('serviceDiscovered', featureAdded);
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
        api.listen.on('chatBoxViewsInitialized', () => {

            function openChatRoomFromURIClicked (ev) {
                ev.preventDefault();
                api.rooms.open(ev.target.href);
            }
            _converse.chatboxviews.delegate('click', 'a.open-chatroom', openChatRoomFromURIClicked);

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

        api.listen.on('clearSession', () => {
            const view = _converse.chatboxviews.get('controlbox');
            if (view && view.roomspanel) {
                view.roomspanel.model.destroy();
                view.roomspanel.remove();
                delete view.roomspanel;
            }
        });

        api.listen.on('controlBoxInitialized', (view) => {
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
                        const views = api.chatviews.get(jids);
                        return views.filter(v => v.model.get('type') === _converse.CHATROOMS_TYPE)
                    } else {
                        const view = api.chatviews.get(jids);
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

