// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)
//
/**
 * @module converse-muc-views
 * @description
 * XEP-0045 Multi-User Chat Views
 */
import "converse-modal";
import "backbone.vdomview";
import "formdata-polyfill";
import "@converse/headless/utils/muc";
import BrowserStorage from "backbone.browserStorage";
import { OrderedListView } from "backbone.overview";
import converse from "@converse/headless/converse-core";
import tpl_add_chatroom_modal from "templates/add_chatroom_modal.html";
import tpl_chatarea from "templates/chatarea.html";
import tpl_chatroom from "templates/chatroom.html";
import tpl_chatroom_bottom_panel from "templates/chatroom_bottom_panel.html";
import tpl_chatroom_destroyed from "templates/chatroom_destroyed.html";
import tpl_chatroom_details_modal from "templates/chatroom_details_modal.html";
import tpl_chatroom_disconnect from "templates/chatroom_disconnect.html";
import tpl_chatroom_features from "templates/chatroom_features.html";
import tpl_chatroom_form from "templates/chatroom_form.html";
import tpl_chatroom_head from "templates/chatroom_head.html";
import tpl_chatroom_invite from "templates/chatroom_invite.html";
import tpl_chatroom_nickname_form from "templates/chatroom_nickname_form.html";
import tpl_chatroom_password_form from "templates/chatroom_password_form.html";
import tpl_chatroom_sidebar from "templates/chatroom_sidebar.html";
import tpl_info from "templates/info.html";
import tpl_list_chatrooms_modal from "templates/list_chatrooms_modal.html";
import tpl_moderator_tools_modal from "templates/moderator_tools_modal.html";
import tpl_occupant from "templates/occupant.html";
import tpl_room_description from "templates/room_description.html";
import tpl_room_item from "templates/room_item.html";
import tpl_room_panel from "templates/room_panel.html";
import tpl_rooms_results from "templates/rooms_results.html";
import tpl_spinner from "templates/spinner.html";
import xss from "xss/dist/xss";


const { Backbone, Strophe, sizzle, _, $iq, $pres } = converse.env;
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
        const { _converse } = this,
              { __ } = _converse;

        _converse.api.promises.add(['roomsPanelRendered']);

        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        _converse.api.settings.update({
            'auto_list_rooms': false,
            'cache_muc_messages': true,
            'locked_muc_nickname': false,
            'muc_disable_slash_commands': false,
            'muc_show_join_leave': true,
            'muc_show_join_leave_status': true,
            'muc_mention_autocomplete_min_chars': 0,
            'roomconfig_whitelist': [],
            'visible_toolbar_buttons': {
                'toggle_occupants': true
            }
        });


        const viewWithRoomsPanel = {
            renderRoomsPanel () {
                if (this.roomspanel && u.isInDOM(this.roomspanel.el)) {
                    return this.roomspanel;
                }
                this.roomspanel = new _converse.RoomsPanel({
                    'model': new (_converse.RoomsPanelModel.extend({
                        'id': `converse.roomspanel${_converse.bare_jid}`, // Required by web storage
                        'browserStorage': new BrowserStorage[_converse.config.get('storage')](
                            `converse.roomspanel${_converse.bare_jid}`)
                    }))()
                });
                this.roomspanel.model.fetch();
                this.el.querySelector('.controlbox-pane').insertAdjacentElement(
                    'beforeEnd', this.roomspanel.render().el);

                /**
                 * Triggered once the section of the _converse.ControlBoxView
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
                    'desc': _.get(_.head(sizzle('field[var="muc#roominfo_description"] value', stanza)), 'textContent'),
                    'occ': _.get(_.head(sizzle('field[var="muc#roominfo_occupants"] value', stanza)), 'textContent'),
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
                _converse.api.disco.info(ev.target.getAttribute('data-room-jid'), null)
                    .then(stanza => insertRoomInfo(parent_el, stanza))
                    .catch(e => _converse.log(e, Strophe.LogLevel.ERROR));
            }
        }


        _converse.ModeratorToolsModal = _converse.BootstrapModal.extend({

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
                _converse.BootstrapModal.prototype.initialize.apply(this, arguments);

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
                const allowed_roles = _.uniq(allowed_commands
                    .map(c => COMMAND_TO_ROLE[c])
                    .filter(c => c));

                allowed_affiliations.sort();
                allowed_roles.sort();

                return tpl_moderator_tools_modal(Object.assign(this.model.toJSON(), {
                    '__': __,
                    'affiliations': [...AFFILIATIONS, 'none'],
                    'allowed_affiliations': allowed_affiliations,
                    'allowed_roles': allowed_roles,
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
                        _converse.log(err, Strophe.LogLevel.ERROR);
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
                                _converse.log(e, Strophe.LogLevel.ERROR);
                            }
                        }
                    }
                );
            }
        });


        _converse.ListChatRoomsModal = _converse.BootstrapModal.extend({

            events: {
                'submit form': 'showRooms',
                'click a.room-info': 'toggleRoomInfo',
                'change input[name=nick]': 'setNick',
                'change input[name=server]': 'setDomainFromEvent',
                'click .open-room': 'openRoom'
            },

            initialize () {
                _converse.BootstrapModal.prototype.initialize.apply(this, arguments);
                if (_converse.muc_domain && !this.model.get('muc_domain')) {
                    this.model.save('muc_domain', _converse.muc_domain);
                }
                this.listenTo(this.model, 'change:muc_domain', this.onDomainChange);
            },

            toHTML () {
                const muc_domain = this.model.get('muc_domain') || _converse.muc_domain;
                return tpl_list_chatrooms_modal(Object.assign(this.model.toJSON(), {
                    'heading_list_chatrooms': __('Query for Groupchats'),
                    'label_server_address': __('Server address'),
                    'label_query': __('Show groupchats'),
                    'show_form': !_converse.locked_muc_domain,
                    'server_placeholder': muc_domain ? muc_domain : __('conference.example.org')
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
                _converse.api.rooms.open(jid, {'name': name});
            },

            toggleRoomInfo (ev) {
                ev.preventDefault();
                toggleRoomInfo(ev);
            },

            onDomainChange () {
                if (_converse.auto_list_rooms) {
                    this.updateRoomsList();
                }
            },

            roomStanzaItemToHTMLElement (groupchat) {
                const name = Strophe.unescapeNode(groupchat.getAttribute('name') || groupchat.getAttribute('jid'));
                const div = document.createElement('div');
                div.innerHTML = tpl_room_item({
                    'name': Strophe.xmlunescape(name),
                    'jid': groupchat.getAttribute('jid'),
                    'open_title': __('Click to open this groupchat'),
                    'info_title': __('Show more information on this groupchat')
                });
                return div.firstElementChild;
            },

            removeSpinner () {
                sizzle('.spinner', this.el).forEach(u.removeElement);
            },

            informNoRoomsFound () {
                const chatrooms_el = this.el.querySelector('.available-chatrooms');
                chatrooms_el.innerHTML = tpl_rooms_results({'feedback_text': __('No groupchats found')});
                const input_el = this.el.querySelector('input[name="server"]');
                input_el.classList.remove('hidden')
                this.removeSpinner();
            },

            onRoomsFound (iq) {
                /* Handle the IQ stanza returned from the server, containing
                 * all its public groupchats.
                 */
                const available_chatrooms = this.el.querySelector('.available-chatrooms');
                const rooms = sizzle('query item', iq);
                if (rooms.length) {
                    available_chatrooms.innerHTML = tpl_rooms_results({'feedback_text': __('Groupchats found:')});
                    const fragment = document.createDocumentFragment();
                    rooms.map(this.roomStanzaItemToHTMLElement)
                         .filter(r => r)
                         .forEach(child => fragment.appendChild(child));

                    available_chatrooms.appendChild(fragment);
                    this.removeSpinner();
                } else {
                    this.informNoRoomsFound();
                }
                return true;
            },

            updateRoomsList () {
                /* Send an IQ stanza to the server asking for all groupchats
                 */
                const iq = $iq({
                    'to': this.model.get('muc_domain'),
                    'from': _converse.connection.jid,
                    'type': "get"
                }).c("query", {xmlns: Strophe.NS.DISCO_ITEMS});
                _converse.api.sendIQ(iq)
                    .then(iq => this.onRoomsFound(iq))
                    .catch(() => this.informNoRoomsFound())
            },

            showRooms (ev) {
                ev.preventDefault();
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


        _converse.AddChatRoomModal = _converse.BootstrapModal.extend({

            events: {
                'submit form.add-chatroom': 'openChatRoom'
            },

            initialize () {
                _converse.BootstrapModal.prototype.initialize.apply(this, arguments);
                this.listenTo(this.model, 'change:muc_domain', this.render);
            },

            toHTML () {
                let placeholder = '';
                if (!_converse.locked_muc_domain) {
                    const muc_domain = this.model.get('muc_domain') || _converse.muc_domain;
                    placeholder = muc_domain ? `name@${muc_domain}` : __('name@conference.example.org');
                }
                return tpl_add_chatroom_modal(Object.assign(this.model.toJSON(), {
                    '__': _converse.__,
                    '_converse': _converse,
                    'label_room_address': _converse.muc_domain ? __('Groupchat name') :  __('Groupchat address'),
                    'chatroom_placeholder': placeholder
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
            }
        });


        _converse.RoomDetailsModal = _converse.BootstrapModal.extend({

            initialize () {
                _converse.BootstrapModal.prototype.initialize.apply(this, arguments);
                this.listenTo(this.model, 'change', this.render);
                this.listenTo(this.model.occupants, 'add', this.render);
                this.listenTo(this.model.occupants, 'change', this.render);
            },

            toHTML () {
                return tpl_chatroom_details_modal(Object.assign(
                    this.model.toJSON(), {
                        '_': _,
                        '__': __,
                        'display_name': __('Groupchat info for %1$s', this.model.getDisplayName()),
                        'features': this.model.features.toJSON(),
                        'num_occupants': this.model.occupants.length,
                        'topic': u.addHyperlinks(xss.filterXSS(_.get(this.model.get('subject'), 'text'), {'whiteList': {}}))
                    })
                );
            }
        });


        /**
         * The View of an open/ongoing groupchat conversation
         * @class
         * @namespace _converse.ChatRoomView
         * @memberOf _converse
         */
        _converse.ChatRoomView = _converse.ChatBoxView.extend({
            /* Backbone.NativeView which renders a groupchat, based upon the view
             * for normal one-on-one chat boxes.
             */
            length: 300,
            tagName: 'div',
            className: 'chatbox chatroom hidden',
            is_chatroom: true,
            events: {
                'change input.fileupload': 'onFileSelection',
                'click .chat-msg__action-edit': 'onMessageEditButtonClicked',
                'click .chatbox-navback': 'showControlBox',
                'click .close-chatbox-button': 'close',
                'click .configure-chatroom-button': 'getAndRenderConfigurationForm',
                'click .hide-occupants': 'hideOccupants',
                'click .new-msgs-indicator': 'viewUnreadMessages',
                'click .occupant-nick': 'onOccupantClicked',
                'click .send-button': 'onFormSubmitted',
                'click .show-room-details-modal': 'showRoomDetailsModal',
                'click .toggle-call': 'toggleCall',
                'click .toggle-occupants': 'toggleOccupants',
                'click .upload-file': 'toggleFileUpload',
                'keydown .chat-textarea': 'onKeyDown',
                'keyup .chat-textarea': 'onKeyUp',
                'paste .chat-textarea': 'onPaste',
                'input .chat-textarea': 'inputChanged',
                'dragover .chat-textarea': 'onDragOver',
                'drop .chat-textarea': 'onDrop',
            },

            initialize () {
                this.initDebounced();

                this.listenTo(this.model.messages, 'add', this.onMessageAdded);
                this.listenTo(this.model.messages, 'rendered', this.scrollDown);
                this.model.messages.on('reset', () => {
                    this.content.innerHTML = '';
                    this.removeAll();
                });

                this.listenTo(this.model, 'change', this.renderHeading);
                this.listenTo(this.model, 'change:connection_status', this.onConnectionStatusChanged);
                this.listenTo(this.model, 'change:hidden_occupants', this.updateOccupantsToggle);
                this.listenTo(this.model, 'change:subject', this.setChatRoomSubject);
                this.listenTo(this.model, 'configurationNeeded', this.getAndRenderConfigurationForm);
                this.listenTo(this.model, 'destroy', this.hide);
                this.listenTo(this.model, 'show', this.show);

                this.listenTo(this.model.features, 'change:moderated', this.renderBottomPanel);

                this.listenTo(this.model.occupants, 'add', this.onOccupantAdded);
                this.listenTo(this.model.occupants, 'remove', this.onOccupantRemoved);
                this.listenTo(this.model.occupants, 'change:show', this.showJoinOrLeaveNotification);
                this.listenTo(this.model.occupants, 'change:role', this.onOccupantRoleChanged);
                this.listenTo(this.model.occupants, 'change:affiliation', this.onOccupantAffiliationChanged);

                this.render();
                this.updateAfterMessagesFetched();
                this.createOccupantsView();
                this.onConnectionStatusChanged();
                /**
                 * Triggered once a groupchat has been opened
                 * @event _converse#chatRoomOpened
                 * @type { _converse.ChatRoomView }
                 * @example _converse.api.listen.on('chatRoomOpened', view => { ... });
                 */
                _converse.api.trigger('chatRoomOpened', this);
                _converse.api.trigger('chatBoxInitialized', this);
            },

            render () {
                this.el.setAttribute('id', this.model.get('box_id'));
                this.el.innerHTML = tpl_chatroom();
                this.renderHeading();
                this.renderChatArea();
                this.renderBottomPanel();
                if (this.model.get('connection_status') !== converse.ROOMSTATUS.ENTERED) {
                    this.showSpinner();
                }
                return this;
            },

            renderHeading (item=null) {
                /* Render the heading UI of the groupchat. */
                const changed = _.get(item, 'changed', {});
                const keys = ['affiliation', 'bookmarked', 'jid', 'name', 'description', 'subject'];
                if (item === null || _.intersection(Object.keys(changed), keys).length) {
                    this.el.querySelector('.chat-head-chatroom').innerHTML = this.generateHeadingHTML();
                }
            },

            renderBottomPanel () {
                const container = this.el.querySelector('.bottom-panel');
                if (this.model.features.get('moderated') && this.model.getOwnRole() === 'visitor') {
                    container.innerHTML = tpl_chatroom_bottom_panel({'__': __});
                } else {
                    if (!container.firstElementChild || !container.querySelector('.sendXMPPMessage')) {
                        this.renderMessageForm();
                        this.initMentionAutoComplete();
                    }
                }
            },

            renderChatArea () {
                /* Render the UI container in which groupchat messages will appear.
                 */
                if (this.el.querySelector('.chat-area') === null) {
                    const container_el = this.el.querySelector('.chatroom-body');
                    container_el.insertAdjacentHTML(
                        'beforeend',
                        tpl_chatarea({'show_send_button': _converse.show_send_button})
                    );
                    this.content = this.el.querySelector('.chat-content');
                }
                return this;
            },

            createOccupantsView () {
                this.model.occupants.chatroomview = this;
                const view = new _converse.ChatRoomOccupantsView({'model': this.model.occupants});
                const container_el = this.el.querySelector('.chatroom-body');
                container_el.insertAdjacentElement('beforeend', view.el);
            },

            getAutoCompleteList () {
                return this.model.occupants.filter('nick').map(o => ({'label': o.get('nick'), 'value': `@${o.get('nick')}`}));
            },

            initMentionAutoComplete () {
                this.mention_auto_complete = new _converse.AutoComplete(this.el, {
                    'auto_first': true,
                    'auto_evaluate': false,
                    'min_chars': _converse.muc_mention_autocomplete_min_chars,
                    'match_current_word': true,
                    'list': () => this.getAutoCompleteList(),
                    'filter': _converse.FILTER_STARTSWITH,
                    'ac_triggers': ["Tab", "@"],
                    'include_triggers': []
                });
                this.mention_auto_complete.on('suggestion-box-selectcomplete', () => (this.auto_completing = false));
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

            showModeratorToolsModal (affiliation) {
                if (!this.verifyRoles(['moderator'])) {
                    return;
                }
                if (_.isUndefined(this.model.modtools_modal)) {
                    const model = new Backbone.Model({'affiliation': affiliation});
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

            generateHeadingHTML () {
                /* Returns the heading HTML to be rendered.
                 */
                return tpl_chatroom_head(
                    Object.assign(this.model.toJSON(), {
                        'isOwner': this.model.getOwnAffiliation() === 'owner',
                        'title': this.model.getDisplayName(),
                        'Strophe': Strophe,
                        '_converse': _converse,
                        'info_close': __('Close and leave this groupchat'),
                        'info_configure': __('Configure this groupchat'),
                        'info_details': __('Show more details about this groupchat'),
                        'description': u.addHyperlinks(xss.filterXSS(_.get(this.model.get('subject'), 'text'), {'whiteList': {}})),
                }));
            },

            afterShown () {
                /* Override from converse-chatview, specifically to avoid
                 * the 'active' chat state from being sent out prematurely.
                 *
                 * This is instead done in `onConnectionStatusChanged` below.
                 */
                if (u.isPersistableModel(this.model)) {
                    this.model.clearUnreadMsgCounter();
                    this.model.save();
                }
                this.scrollDown();
            },

            onConnectionStatusChanged () {
                const conn_status = this.model.get('connection_status');
                if (conn_status === converse.ROOMSTATUS.NICKNAME_REQUIRED) {
                    this.renderNicknameForm();
                } else if (conn_status === converse.ROOMSTATUS.PASSWORD_REQUIRED) {
                    this.renderPasswordForm();
                } else if (conn_status === converse.ROOMSTATUS.CONNECTING) {
                    this.showSpinner();
                } else if (conn_status === converse.ROOMSTATUS.ENTERED) {
                    this.hideSpinner();
                    if (_converse.auto_focus) {
                        this.focus();
                    }
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
            close () {
                this.hide();
                if (Backbone.history.getFragment() === "converse/room?jid="+this.model.get('jid')) {
                    _converse.router.navigate('');
                }
                this.model.leave();
                _converse.ChatBoxView.prototype.close.apply(this, arguments);
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

            hideOccupants (ev) {
                /* Show or hide the right sidebar containing the chat
                 * occupants (and the invite widget).
                 */
                if (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                this.model.save({'hidden_occupants': true});
                this.scrollDown();
            },

            toggleOccupants (ev) {
                /* Show or hide the right sidebar containing the chat
                 * occupants (and the invite widget).
                 */
                if (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                this.model.save({'hidden_occupants': !this.model.get('hidden_occupants')});
                this.scrollDown();
            },

            onOccupantClicked (ev) {
                /* When an occupant is clicked, insert their nickname into
                 * the chat textarea input.
                 */
                this.insertIntoTextArea(ev.target.textContent);
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
                _converse.log(err, Strophe.LogLevel.FATAL);
                this.showErrorMessage(__("Sorry, an error happened while running the command. Check your browser's developer console for details."));
            },

            getAllowedCommands () {
                // FIXME: The availability of some of these commands
                // depend on the MUCs configuration (e.g. whether it's
                // moderated or not). We need to take that into
                // consideration.
                let allowed_commands = ['clear', 'help', 'me', 'nick', 'subject', 'topic', 'register'];
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
                        const allowed_commands = this.getAllowedCommands();
                        this.showHelpMessages([`<strong>${__("You can run the following commands")}</strong>`]);
                        this.showHelpMessages([
                            `<strong>/admin</strong>: ${__("Change user's affiliation to admin")}`,
                            `<strong>/ban</strong>: ${__('Ban user by changing their affiliation to outcast')}`,
                            `<strong>/clear</strong>: ${__('Clear the chat area')}`,
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
                                id: _converse.connection.getUniqueId()
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

            closeForm () {
                /* Remove the configuration form without submitting and
                 * return to the chat view.
                 */
                sizzle('.chatroom-form-container', this.el).forEach(e => u.addClass('hidden', e));
                this.renderAfterTransition();
            },

            getAndRenderConfigurationForm () {
                /* Start the process of configuring a groupchat, either by
                 * rendering a configuration form, or by auto-configuring
                 * based on the "roomconfig" data stored on the
                 * Backbone.Model.
                 *
                 * Stores the new configuration on the Backbone.Model once
                 * completed.
                 *
                 * Paremeters:
                 *  (Event) ev: DOM event that might be passed in if this
                 *      method is called due to a user action. In this
                 *      case, auto-configure won't happen, regardless of
                 *      the settings.
                 */

                if (!this.config_form || !u.isVisible(this.config_form.el)) {
                    this.showSpinner();
                    this.model.fetchRoomConfiguration()
                        .then(iq => this.renderConfigurationForm(iq))
                        .catch(e => _converse.log(e, Strophe.LogLevel.ERROR));
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

            renderNicknameForm () {
                /* Render a form which allows the user to choose theirnickname.
                 */
                const message = this.model.get('nickname_validation_message');
                this.model.save('nickname_validation_message', undefined);
                this.hideChatRoomContents();
                if (!this.nickname_form) {
                    this.nickname_form = new _converse.MUCNicknameForm({
                        'model': new Backbone.Model({'validation_message': message}),
                        'chatroomview': this,
                    });
                    const container_el = this.el.querySelector('.chatroom-body');
                    container_el.insertAdjacentElement('beforeend', this.nickname_form.el);
                } else {
                    this.nickname_form.model.set('validation_message', message);
                }
                u.showElement(this.nickname_form.el);
                u.safeSave(this.model, {'connection_status': converse.ROOMSTATUS.NICKNAME_REQUIRED});
            },

            renderPasswordForm () {
                this.hideChatRoomContents();
                const message = this.model.get('password_validation_message');
                this.model.save('password_validation_message', undefined);

                if (!this.password_form) {
                    this.password_form = new _converse.MUCPasswordForm({
                        'model': new Backbone.Model({
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
                this.model.save('connection_status', converse.ROOMSTATUS.PASSWORD_REQUIRED);
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
                    '_': _,
                    '__':__,
                    'jid': moved_jid,
                    'reason': reason ? `"${reason}"` : null
                });
                const switch_el = container.querySelector('a.switch-chat');
                if (switch_el) {
                    switch_el.addEventListener('click', ev => {
                        ev.preventDefault();
                        this.model.save('jid', moved_jid);
                        container.innerHTML = '';
                        this.showSpinner();
                        this.enterRoom();
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
                container.innerHTML = tpl_chatroom_disconnect({
                    '_': _,
                    'disconnect_messages': messages
                })
                u.showElement(container);
            },

            getNotificationWithMessage (message) {
                let el = this.content.lastElementChild;
                while (el) {
                    if (!_.includes(_.get(el, 'classList', []), 'chat-info')) {
                        return;
                    }
                    if (el.textContent === message) {
                        return el;
                    }
                    el = el.previousElementSibling;
                }
            },

            insertNotification (message) {
                this.content.insertAdjacentHTML(
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
                if (occupant.get('show') === 'online') {
                    this.showJoinNotification(occupant);
                }
            },

            onOccupantRemoved (occupant) {
                if (this.model.get('connection_status') ===  converse.ROOMSTATUS.ENTERED &&
                        occupant.get('show') === 'online') {
                    this.showLeaveNotification(occupant);
                }
            },

            showJoinOrLeaveNotification (occupant) {
                if (_.includes(occupant.get('states'), '303')) {
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
                    const data = _.get(el, 'dataset', {});
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
                        this.model.get('connection_status') !==  converse.ROOMSTATUS.ENTERED) {
                    return;
                }
                const nick = occupant.get('nick'),
                      stat = _converse.muc_show_join_leave_status ? occupant.get('status') : null,
                      prev_info_el = this.getPreviousJoinOrLeaveNotification(this.content.lastElementChild, nick),
                      data = _.get(prev_info_el, 'dataset', {});

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
                    this.content.insertAdjacentHTML('beforeend', tpl_info(data));
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
                        this.content.insertAdjacentHTML('beforeend', tpl_info(data));
                    } else {
                        this.content.insertAdjacentHTML('beforeend', tpl_info(data));
                        this.insertDayIndicator(this.content.lastElementChild);
                    }
                }
                this.scrollDown();
            },

            showLeaveNotification (occupant) {
                if (!_converse.muc_show_join_leave ||
                        _.includes(occupant.get('states'), '303') ||
                        _.includes(occupant.get('states'), '307')) {
                    return;
                }
                const nick = occupant.get('nick'),
                      stat = _converse.muc_show_join_leave_status ? occupant.get('status') : null,
                      prev_info_el = this.getPreviousJoinOrLeaveNotification(this.content.lastElementChild, nick),
                      dataset = _.get(prev_info_el, 'dataset', {});

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
                    this.content.insertAdjacentHTML('beforeend', tpl_info(data));
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
                        this.content.insertAdjacentHTML('beforeend', tpl_info(data));
                    } else {
                        this.content.insertAdjacentHTML('beforeend', tpl_info(data));
                        this.insertDayIndicator(this.content.lastElementChild);
                    }
                }
                this.scrollDown();
            },

            renderAfterTransition () {
                /* Rerender the groupchat after some kind of transition. For
                 * example after the spinner has been removed or after a
                 * form has been submitted and removed.
                 */
                if (this.model.get('connection_status') == converse.ROOMSTATUS.NICKNAME_REQUIRED) {
                    this.renderNicknameForm();
                } else if (this.model.get('connection_status') == converse.ROOMSTATUS.PASSWORD_REQUIRED) {
                    this.renderPasswordForm();
                } else if (this.model.get('connection_status') == converse.ROOMSTATUS.ENTERED) {
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

            hideSpinner () {
                /* Check if the spinner is being shown and if so, hide it.
                 * Also make sure then that the chat area and occupants
                 * list are both visible.
                 */
                const spinner = this.el.querySelector('.spinner');
                if (spinner !== null) {
                    u.removeElement(spinner);
                    this.renderAfterTransition();
                }
                return this;
            },

            setChatRoomSubject () {
                // For translators: the %1$s and %2$s parts will get
                // replaced by the user and topic text respectively
                // Example: Topic set by JC Brand to: Hello World!
                const subject = this.model.get('subject'),
                      message = subject.text ? __('Topic set by %1$s', subject.author) :
                                               __('Topic cleared by %1$s', subject.author),
                      date = (new Date()).toISOString();
                this.content.insertAdjacentHTML(
                    'beforeend',
                    tpl_info({
                        'isodate': date,
                        'extra_classes': 'chat-event',
                        'message': message
                    }));

                if (subject.text) {
                    this.content.insertAdjacentHTML(
                        'beforeend',
                        tpl_info({
                            'isodate': date,
                            'extra_classes': 'chat-topic',
                            'message': u.addHyperlinks(xss.filterXSS(_.get(this.model.get('subject'), 'text'), {'whiteList': {}})),
                            'render_message': true
                        }));
                }
                this.scrollDown();
            }
        });


        _converse.RoomsPanel = Backbone.NativeView.extend({
            /* Backbone.NativeView which renders MUC section of the control box.
             */
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


        _converse.MUCConfigForm = Backbone.VDOMView.extend({
            className: 'muc-config-form',
            events: {
                'submit form': 'submitConfigForm',
                'click .button-cancel': 'closeConfigForm'
            },

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
                    fields = fields.filter(f => _.includes(whitelist, f.getAttribute('var')));
                }
                const password_protected = this.model.features.get('passwordprotected');
                const options = {
                    'new_password': !password_protected,
                    'fixed_username': this.model.get('jid')
                };
                return tpl_chatroom_form({
                    '__': __,
                    'title': _.get(stanza.querySelector('title'), 'textContent'),
                    'instructions': _.get(stanza.querySelector('instructions'), 'textContent'),
                    'fields': fields.map(f => u.xForm2webForm(f, stanza, options))
                });
            },

            submitConfigForm (ev) {
                ev.preventDefault();
                this.model.saveConfiguration(ev.target).then(() => this.model.refreshRoomFeatures());
                this.chatroomview.closeForm();
            },

            closeConfigForm (ev) {
                ev.preventDefault();
                this.chatroomview.closeForm();
            }
        });


        _converse.MUCPasswordForm = Backbone.VDOMView.extend({
            className: 'muc-password-form',
            events: {
                'submit form': 'submitPassword',
            },

            initialize (attrs) {
                this.chatroomview = attrs.chatroomview;
                this.listenTo(this.model, 'change:validation_message', this.render);
                this.render();
            },

            toHTML () {
                const err_msg = this.model.get('validation_message');
                return tpl_chatroom_password_form({
                    'jid': this.model.get('jid'),
                    'heading': __('This groupchat requires a password'),
                    'label_password': __('Password: '),
                    'label_submit': __('Submit'),
                    'error_class': err_msg ? 'error' : '',
                    'validation_message': err_msg
                });
            },

            submitPassword (ev) {
                ev.preventDefault();
                const password = this.el.querySelector('input[type=password]').value;
                this.chatroomview.model.join(this.chatroomview.model.get('nick'), password);
                this.model.set('validation_message', null);
            }
        });


        _converse.MUCNicknameForm = Backbone.VDOMView.extend({
            className: 'muc-nickname-form',
            events: {
                'submit form': 'submitNickname',
            },

            initialize (attrs) {
                this.chatroomview = attrs.chatroomview;
                this.listenTo(this.model, 'change:validation_message', this.render);
                this.render();
            },

            toHTML () {
                const err_msg = this.model.get('validation_message');
                return tpl_chatroom_nickname_form({
                    'heading': __('Please choose your nickname'),
                    'label_nickname': __('Nickname'),
                    'label_join': __('Enter groupchat'),
                    'error_class': err_msg ? 'error' : '',
                    'validation_message': err_msg,
                    'nickname': this.model.get('nickname')
                });
            },

            submitNickname (ev) {
                /* Get the nickname value from the form and then join the
                 * groupchat with it.
                 */
                ev.preventDefault();
                const nick_el = ev.target.nick;
                const nick = nick_el.value.trim();
                if (nick) {
                    this.chatroomview.model.join(nick);
                    this.model.set({
                        'validation_message': null,
                        'nickname': nick
                    });
                } else {
                    return this.model.set({
                        'validation_message': __('You need to provide a nickname')
                    });
                }
            }
        });

        _converse.ChatRoomOccupantView = Backbone.VDOMView.extend({
            tagName: 'li',
            initialize () {
                this.listenTo(this.model, 'change', this.render);
            },

            toHTML () {
                const show = this.model.get('show');
                return tpl_occupant(
                    Object.assign(
                        { '_': _,
                          'jid': '',
                          'show': show,
                          'hint_show': _converse.PRETTY_CHAT_STATUS[show],
                          'hint_occupant': __('Click to mention %1$s in your message.', this.model.get('nick')),
                          'desc_moderator': __('This user is a moderator.'),
                          'desc_participant': __('This user can send messages in this groupchat.'),
                          'desc_visitor': __('This user can NOT send messages in this groupchat.'),
                          'label_moderator': __('Moderator'),
                          'label_visitor': __('Visitor'),
                          'label_owner': __('Owner'),
                          'label_member': __('Member'),
                          'label_admin': __('Admin')
                        }, this.model.toJSON())
                );
            },

            destroy () {
                this.el.parentElement.removeChild(this.el);
            }
        });


        _converse.ChatRoomOccupantsView = OrderedListView.extend({
            tagName: 'div',
            className: 'occupants col-md-3 col-4',
            listItems: 'model',
            sortEvent: 'change:role',
            listSelector: '.occupant-list',

            ItemView: _converse.ChatRoomOccupantView,

            async initialize () {
                OrderedListView.prototype.initialize.apply(this, arguments);

                this.listenTo(this.model, 'add', this.maybeRenderInviteWidget);
                this.listenTo(this.model, 'change:affiliation', this.maybeRenderInviteWidget);

                this.chatroomview = this.model.chatroomview;
                this.listenTo(this.chatroomview.model.features, 'change', this.renderRoomFeatures);
                this.listenTo(this.chatroomview.model.features, 'change:open', this.renderInviteWidget);
                this.listenTo(this.chatroomview.model, 'change:hidden_occupants', this.setVisibility);
                this.render();
                await this.model.fetched;
                this.sortAndPositionAllItems();
            },

            render () {
                this.el.innerHTML = tpl_chatroom_sidebar(
                    Object.assign(this.chatroomview.model.toJSON(), {
                        'allow_muc_invitations': _converse.allow_muc_invitations,
                        'label_occupants': __('Participants')
                    })
                );
                if (_converse.allow_muc_invitations) {
                    _converse.api.waitUntil('rosterContactsFetched').then(() => this.renderInviteWidget());
                }
                this.setVisibility();
                return this.renderRoomFeatures();
            },

            setVisibility () {
                if (this.chatroomview.model.get('hidden_occupants')) {
                    u.hideElement(this.el);
                } else {
                    u.showElement(this.el);
                    this.setOccupantsHeight();
                }
            },

            maybeRenderInviteWidget (occupant) {
                if (occupant.get('jid') === _converse.bare_jid) {
                    this.renderInviteWidget();
                }
            },

            renderInviteWidget () {
                const widget = this.el.querySelector('.room-invite');
                if (this.shouldInviteWidgetBeShown()) {
                    if (widget === null) {
                        const heading = this.el.querySelector('.occupants-heading');
                        heading.insertAdjacentHTML(
                            'afterend',
                            tpl_chatroom_invite({
                                'error_message': null,
                                'label_invitation': __('Invite'),
                            })
                        );
                        this.initInviteWidget();
                    }
                } else if (widget !== null) {
                    widget.remove();
                }
                return this;
            },

            renderRoomFeatures () {
                const features = this.chatroomview.model.features,
                      picks = _.pick(features.attributes, converse.ROOM_FEATURES),
                      iteratee = (a, v) => a || v;

                if (_.reduce(Object.values(picks), iteratee)) {
                    const el = this.el.querySelector('.chatroom-features');
                    el.innerHTML = tpl_chatroom_features(Object.assign(features.toJSON(), {__}));
                    this.setOccupantsHeight();
                }
                return this;
            },

            setOccupantsHeight () {
                const el = this.el.querySelector('.chatroom-features');
                this.el.querySelector('.occupant-list').style.cssText =
                    `height: calc(100% - ${el.offsetHeight}px - 5em);`;
            },


            promptForInvite (suggestion) {
                let reason = '';
                if (!_converse.auto_join_on_invite) {
                    reason = prompt(
                        __('You are about to invite %1$s to the groupchat "%2$s". '+
                           'You may optionally include a message, explaining the reason for the invitation.',
                           suggestion.text.label, this.chatroomview.model.getDisplayName())
                    );
                }
                if (reason !== null) {
                    this.chatroomview.model.directInvite(suggestion.text.value, reason);
                }
                const form = this.el.querySelector('.room-invite form'),
                      input = form.querySelector('.invited-contact'),
                      error = form.querySelector('.error');
                if (error !== null) {
                    error.parentNode.removeChild(error);
                }
                input.value = '';
            },

            inviteFormSubmitted (evt) {
                evt.preventDefault();
                const el = evt.target.querySelector('input.invited-contact'),
                      jid = el.value;
                if (!jid || _.compact(jid.split('@')).length < 2) {
                    evt.target.outerHTML = tpl_chatroom_invite({
                        'error_message': __('Please enter a valid XMPP address'),
                        'label_invitation': __('Invite'),
                    });
                    this.initInviteWidget();
                    return;
                }
                this.promptForInvite({
                    'target': el,
                    'text': {
                        'label': jid,
                        'value': jid
                    }});
            },

            shouldInviteWidgetBeShown () {
                return _converse.allow_muc_invitations &&
                    (this.chatroomview.model.features.get('open') ||
                        this.chatroomview.model.getOwnAffiliation() === "owner"
                    );
            },

            initInviteWidget () {
                const form = this.el.querySelector('.room-invite form');
                if (form === null) {
                    return;
                }
                form.addEventListener('submit', this.inviteFormSubmitted.bind(this), false);
                const list = _converse.roster.map(i => ({'label': i.getDisplayName(), 'value': i.get('jid')}));
                const el = this.el.querySelector('.suggestion-box').parentElement;

                if (this.invite_auto_complete) {
                    this.invite_auto_complete.destroy();
                }
                this.invite_auto_complete = new _converse.AutoComplete(el, {
                    'min_chars': 1,
                    'list': list
                });
                this.invite_auto_complete.on('suggestion-box-selectcomplete', ev => this.promptForInvite(ev));
                this.invite_auto_complete.on('suggestion-box-open', () => {
                    this.invite_auto_complete.ul.setAttribute('style', `max-height: calc(${this.el.offsetHeight}px - 80px);`);
                });
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
            }).catch(e => _converse.log(e, Strophe.LogLevel.ERROR));
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

            function openChatRoomFromURIClicked (ev) {
                ev.preventDefault();
                _converse.api.rooms.open(ev.target.href);
            }
            _converse.chatboxviews.delegate('click', 'a.open-chatroom', openChatRoomFromURIClicked);

            function addView (model) {
                const views = _converse.chatboxviews;
                if (!views.get(model.get('id')) &&
                        model.get('type') === _converse.CHATROOMS_TYPE &&
                        model.isValid()
                ) {
                    return views.add(model.get('id'), new _converse.ChatRoomView({'model': model}));
                }
            }
            _converse.chatboxes.on('add', addView);
        });

        _converse.api.listen.on('clearSession', () => {
            const view = _converse.chatboxviews.get('controlbox');
            if (view && view.roomspanel) {
                view.roomspanel.model.destroy();
                view.roomspanel.model.browserStorage._clear();
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
            'roomviews': {
                /**
                 * Retrieves a groupchat (aka chatroom) view. The chat should already be open.
                 *
                 * @method _converse.api.roomviews.get
                 * @param {String|string[]} name - e.g. 'coven@conference.shakespeare.lit' or
                 *  ['coven@conference.shakespeare.lit', 'cave@conference.shakespeare.lit']
                 * @returns {Backbone.View} Backbone.View representing the groupchat
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
                 */
                'close' (jids) {
                    let views;
                    if (jids === undefined) {
                        views = _converse.chatboxviews;
                    } else if (_.isString(jids)) {
                        views = [_converse.chatboxviews.get(jids)].filter(v => v);
                    } else if (Array.isArray(jids)) {
                        views = jids.map(jid => _converse.chatboxviews.get(jid));
                    }
                    views.forEach(view => {
                        if (view.is_chatroom && view.model) {
                            view.close();
                        }
                    });
                }
            }
        });
    }
});

