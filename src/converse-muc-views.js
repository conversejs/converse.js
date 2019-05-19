// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)
//
// XEP-0045 Multi-User Chat Views

import "converse-modal";
import "backbone.overview/backbone.orderedlistview";
import "backbone.overview/backbone.overview";
import "backbone.vdomview";
import _FormData from "formdata-polyfill";
import converse from "@converse/headless/converse-core";
import muc_utils from "@converse/headless/utils/muc";
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
import tpl_occupant from "templates/occupant.html";
import tpl_room_description from "templates/room_description.html";
import tpl_room_item from "templates/room_item.html";
import tpl_room_panel from "templates/room_panel.html";
import tpl_rooms_results from "templates/rooms_results.html";
import tpl_spinner from "templates/spinner.html";
import xss from "xss/dist/xss";


const { Backbone, Promise, Strophe, dayjs, sizzle, _, $build, $iq, $msg, $pres } = converse.env;
const u = converse.env.utils;
const AFFILIATION_CHANGE_COMANDS = ['admin', 'ban', 'owner', 'member', 'revoke'];
const OWNER_COMMANDS = ['owner'];
const ADMIN_COMMANDS = ['admin', 'ban', 'deop', 'destroy', 'member', 'op', 'revoke'];
const MODERATOR_COMMANDS = ['kick', 'mute', 'voice'];
const VISITOR_COMMANDS = ['nick'];

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

            renderRoomsPanel () {
                const { _converse } = this.__super__;
                if (this.roomspanel && u.isVisible(this.roomspanel.el)) {
                    return;
                }
                this.roomspanel = new _converse.RoomsPanel({
                    'model': new (_converse.RoomsPanelModel.extend({
                        'id': `converse.roomspanel${_converse.bare_jid}`, // Required by web storage
                        'browserStorage': new Backbone.BrowserStorage[_converse.config.get('storage')](
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
            },

            renderControlBoxPane () {
                const { _converse } = this.__super__;
                this.__super__.renderControlBoxPane.apply(this, arguments);
                if (_converse.allow_muc) {
                    this.renderRoomsPanel();
                }
            },
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
            'locked_muc_domain': false,
            'locked_muc_nickname': false,
            'muc_disable_slash_commands': false,
            'muc_domain': undefined,
            'muc_show_join_leave': true,
            'muc_show_join_leave_status': true,
            'roomconfig_whitelist': [],
            'visible_toolbar_buttons': {
                'toggle_occupants': true
            }
        });

        if (_converse.locked_muc_domain && !_.isString(_converse.muc_domain)) {
            throw new Error("Config Error: it makes no sense to set locked_muc_domain "+
                            "to true when muc_domain is not set");
        }

        function ___ (str) {
            /* This is part of a hack to get gettext to scan strings to be
            * translated. Strings we cannot send to the function above because
            * they require variable interpolation and we don't yet have the
            * variables at scan time.
            *
            * See actionInfoMessages further below.
            */
            return str;
        }

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
                170: __('groupchat logging is now enabled'),
                171: __('groupchat logging is now disabled'),
                172: __('This groupchat is now no longer anonymous'),
                173: __('This groupchat is now semi-anonymous'),
                174: __('This groupchat is now fully-anonymous'),
                201: __('A new groupchat has been created')
            },

            disconnect_messages: {
                301: __('You have been banned from this groupchat'),
                307: __('You have been kicked from this groupchat'),
                321: __("You have been removed from this groupchat because of an affiliation change"),
                322: __("You have been removed from this groupchat because the groupchat has changed to members-only and you're not a member"),
                332: __("You have been removed from this groupchat because the service hosting it is being shut down")
            },

            action_info_messages: {
                /* XXX: Note the triple underscore function and not double
                * underscore.
                *
                * This is a hack. We can't pass the strings to __ because we
                * don't yet know what the variable to interpolate is.
                *
                * Triple underscore will just return the string again, but we
                * can then at least tell gettext to scan for it so that these
                * strings are picked up by the translation machinery.
                */
                301: ___("%1$s has been banned"),
                303: ___("%1$s's nickname has changed"),
                307: ___("%1$s has been kicked out"),
                321: ___("%1$s has been removed because of an affiliation change"),
                322: ___("%1$s has been removed for not being a member")
            },

            new_nickname_messages: {
                210: ___('Your nickname has been automatically set to %1$s'),
                303: ___('Your nickname has been changed to %1$s')
            }
        };


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

        function toggleRoomInfo (ev) {
            /* Show/hide extra information about a groupchat in a listing. */
            const parent_el = u.ancestor(ev.target, '.room-item'),
                  div_el = parent_el.querySelector('div.room-info');
            if (div_el) {
                u.slideIn(div_el).then(u.removeElement)
                parent_el.querySelector('a.room-info').classList.remove('selected');
            } else {
                parent_el.insertAdjacentHTML('beforeend', tpl_spinner());
                _converse.api.disco.info(ev.target.getAttribute('data-room-jid'), null)
                    .then(stanza => insertRoomInfo(parent_el, stanza))
                    .catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
            }
        }


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
                this.model.on('change:muc_domain', this.onDomainChange, this);
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

            onDomainChange (model) {
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
                    .catch(iq => this.informNoRoomsFound())
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
                this.model.on('change:muc_domain', this.render, this);
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
                this.model.on('change', this.render, this);
                this.model.occupants.on('add', this.render, this);
                this.model.occupants.on('change', this.render, this);
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
         *
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
                'click .toggle-smiley ul.emoji-picker li': 'insertEmoji',
                'click .toggle-smiley': 'toggleEmojiMenu',
                'click .upload-file': 'toggleFileUpload',
                'keydown .chat-textarea': 'keyPressed',
                'keyup .chat-textarea': 'keyUp',
                'input .chat-textarea': 'inputChanged',
                'dragover .chat-textarea': 'onDragOver',
                'drop .chat-textarea': 'onDrop',
            },

            initialize () {
                this.initDebounced();

                this.model.messages.on('add', this.onMessageAdded, this);
                this.model.messages.on('rendered', this.scrollDown, this);
                this.model.messages.on('reset', () => (this.content.innerHTML = ''));

                this.model.on('change:affiliation', this.renderHeading, this);
                this.model.on('change:connection_status', this.afterConnected, this);
                this.model.on('change:hidden_occupants', this.updateOccupantsToggle, this);
                this.model.on('change:jid', this.renderHeading, this);
                this.model.on('change:name', this.renderHeading, this);
                this.model.on('change:role', this.renderBottomPanel, this);
                this.model.on('change:subject', this.renderHeading, this);
                this.model.on('change:subject', this.setChatRoomSubject, this);
                this.model.on('configurationNeeded', this.getAndRenderConfigurationForm, this);
                this.model.on('destroy', this.hide, this);
                this.model.on('show', this.show, this);

                this.model.features.on('change:moderated', this.renderBottomPanel, this);

                this.model.occupants.on('add', this.onOccupantAdded, this);
                this.model.occupants.on('remove', this.onOccupantRemoved, this);
                this.model.occupants.on('change:show', this.showJoinOrLeaveNotification, this);
                this.model.occupants.on('change:role', this.informOfOccupantsRoleChange, this);
                this.model.occupants.on('change:affiliation', this.informOfOccupantsAffiliationChange, this);

                this.createEmojiPicker();
                this.render();
                this.updateAfterMessagesFetched();
                this.createOccupantsView();
                this.insertIntoDOM();
                this.registerHandlers();
                this.enterRoom();
            },

            async enterRoom () {
                if (this.model.get('connection_status') !==  converse.ROOMSTATUS.ENTERED) {
                    await this.model.getRoomFeatures();
                    if (!u.isPersistableModel(this.model)) {
                        // XXX: Happens during tests, nothing to do if this
                        // is a hanging chatbox (i.e. not in the collection anymore).
                        return;
                    }
                    this.populateAndJoin();
                }
                /**
                 * Triggered once a groupchat has been opened
                 * @event _converse#chatRoomOpened
                 * @type { _converse.ChatRoomView }
                 * @example _converse.api.listen.on('chatRoomOpened', view => { ... });
                 */
                _converse.api.trigger('chatRoomOpened', this);
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

            renderHeading () {
                /* Render the heading UI of the groupchat. */
                this.el.querySelector('.chat-head-chatroom').innerHTML = this.generateHeadingHTML();
            },

            renderBottomPanel () {
                const container = this.el.querySelector('.bottom-panel');
                if (this.model.features.get('moderated') && this.model.get('role') === 'visitor') {
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

            initMentionAutoComplete () {
                this.mention_auto_complete = new _converse.AutoComplete(this.el, {
                    'auto_first': true,
                    'auto_evaluate': false,
                    'min_chars': 1,
                    'match_current_word': true,
                    'list': () => this.model.occupants.map(o => ({'label': o.getDisplayName(), 'value': `@${o.getDisplayName()}`})),
                    'filter': _converse.FILTER_STARTSWITH,
                    'ac_triggers': ["Tab", "@"],
                    'include_triggers': []
                });
                this.mention_auto_complete.on('suggestion-box-selectcomplete', () => (this.auto_completing = false));
            },

            keyPressed (ev) {
                if (this.mention_auto_complete.keyPressed(ev)) {
                    return;
                }
                return _converse.ChatBoxView.prototype.keyPressed.apply(this, arguments);
            },

            keyUp (ev) {
                this.mention_auto_complete.evaluate(ev);
            },

            showRoomDetailsModal (ev) {
                ev.preventDefault();
                if (_.isUndefined(this.model.room_details_modal)) {
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

            informOfOccupantsAffiliationChange(occupant, changed) {
                const previous_affiliation = occupant._previousAttributes.affiliation,
                      current_affiliation = occupant.get('affiliation');

                if (previous_affiliation === 'admin') {
                    this.showChatEvent(__("%1$s is no longer an admin of this groupchat", occupant.get('nick')))
                } else if (previous_affiliation === 'owner') {
                    this.showChatEvent(__("%1$s is no longer an owner of this groupchat", occupant.get('nick')))
                } else if (previous_affiliation === 'outcast') {
                    this.showChatEvent(__("%1$s is no longer banned from this groupchat", occupant.get('nick')))
                }

                if (current_affiliation === 'none' && previous_affiliation === 'member') {
                    this.showChatEvent(__("%1$s is no longer a permanent member of this groupchat", occupant.get('nick')))
                } if (current_affiliation === 'member') {
                    this.showChatEvent(__("%1$s is now a permanent member of this groupchat", occupant.get('nick')))
                } else if (current_affiliation === 'outcast') {
                    this.showChatEvent(__("%1$s has been banned from this groupchat", occupant.get('nick')))
                } else if (current_affiliation === 'admin' || current_affiliation == 'owner') {
                    // For example: AppleJack is now an (admin|owner) of this groupchat
                    this.showChatEvent(__('%1$s is now an %2$s of this groupchat', occupant.get('nick'), current_affiliation))
                }
            },

            informOfOccupantsRoleChange (occupant, changed) {
                if (changed === "none") {
                    return;
                }
                const previous_role = occupant._previousAttributes.role;
                if (previous_role === 'moderator') {
                    this.showChatEvent(__("%1$s is no longer a moderator", occupant.get('nick')))
                }
                if (previous_role === 'visitor') {
                    this.showChatEvent(__("%1$s has been given a voice again", occupant.get('nick')))
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
                        '_converse': _converse,
                        'Strophe': Strophe,
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
                 * This is instead done in `afterConnected` below.
                 */
                if (u.isPersistableModel(this.model)) {
                    this.model.clearUnreadMsgCounter();
                    this.model.save();
                }
                this.scrollDown();
                this.renderEmojiPicker();
            },

            show () {
                if (u.isVisible(this.el)) {
                    this.focus();
                    return;
                }
                // Override from converse-chatview in order to not use
                // "fadeIn", which causes flashing.
                u.showElement(this.el);
                this.afterShown();
            },

            afterConnected () {
                if (this.model.get('connection_status') === converse.ROOMSTATUS.CONNECTING) {
                    this.showSpinner();
                } else if (this.model.get('connection_status') === converse.ROOMSTATUS.ENTERED) {
                    this.hideSpinner();
                    this.setChatState(_converse.ACTIVE);
                    this.scrollDown();
                    this.focus();
                }
            },

            getToolbarOptions () {
                return Object.assign(
                    _converse.ChatBoxView.prototype.getToolbarOptions.apply(this, arguments),
                    {
                      'label_hide_occupants': __('Hide the list of participants'),
                      'show_occupants_toggle': this.is_chatroom && _converse.visible_toolbar_buttons.toggle_occupants
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

            hideOccupants (ev, preserve_state) {
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

            handleChatStateNotification (message) {
                /* Override the method on the ChatBoxView base class to
                 * ignore <gone/> notifications in groupchats.
                 *
                 * As laid out in the business rules in XEP-0085
                 * https://xmpp.org/extensions/xep-0085.html#bizrules-groupchat
                 */
                if (message.get('fullname') === this.model.get('nick')) {
                    // Don't know about other servers, but OpenFire sends
                    // back to you your own chat state notifications.
                    // We ignore them here...
                    return;
                }
                if (message.get('chat_state') !== _converse.GONE) {
                    _converse.ChatBoxView.prototype.handleChatStateNotification.apply(this, arguments);
                }
            },

            destroy (groupchat, reason, onSuccess, onError) {
                const destroy = $build("destroy");
                const iq = $iq({to: groupchat, type: "set"}).c("query", {xmlns: Strophe.NS.MUC_OWNER}).cnode(destroy.node);
                if (reason && reason.length > 0) { iq.c("reason", reason); }
                return _converse.api.sendIQ(iq);
            },

            modifyRole (groupchat, nick, role, reason, onSuccess, onError) {
                const item = $build("item", {nick, role});
                const iq = $iq({to: groupchat, type: "set"}).c("query", {xmlns: Strophe.NS.MUC_ADMIN}).cnode(item.node);
                if (reason !== null) { iq.c("reason", reason); }
                return _converse.api.sendIQ(iq).then(onSuccess).catch(onError);
            },

            verifyRoles (roles, occupant, show_error=true) {
                if (!occupant) {
                    occupant = this.model.occupants.findWhere({'jid': _converse.bare_jid});
                }
                const role = occupant.get('role');
                if (Array.isArray(roles) && roles.includes(role) || roles === role) {
                    return true;
                }
                if (show_error) {
                    this.showErrorMessage(__('Forbidden: you do not have the necessary role in order to do that.'))
                }
                return false;
            },

            verifyAffiliations (affiliations, occupant, show_error=true) {
                if (!occupant) {
                    occupant = this.model.occupants.findWhere({'jid': _converse.bare_jid});
                }
                const a = occupant.get('affiliation');
                if (Array.isArray(affiliations) && affiliations.includes(a) || affiliations === a) {
                    return true;
                }
                if (show_error) {
                    this.showErrorMessage(__('Forbidden: you do not have the necessary affiliation in order to do that.'))
                }
                return false;
            },

            validateRoleChangeCommand (command, args) {
                /* Check that a command to change a groupchat user's role or
                 * affiliation has anough arguments.
                 */
                if (args.length < 1 || args.length > 2) {
                    this.showErrorMessage(
                        __('Error: the "%1$s" command takes two arguments, the user\'s nickname and optionally a reason.', command)
                    );
                    return false;
                }
                if (!(AFFILIATION_CHANGE_COMANDS.includes(command) && u.isValidJID(args[0])) &&
                        !this.model.occupants.findWhere({'nick': args[0]}) &&
                        !this.model.occupants.findWhere({'jid': args[0]})) {
                    this.showErrorMessage(__('Error: couldn\'t find a groupchat participant "%1$s"', args[0]));
                    return false;
                }
                return true;
            },

            onCommandError (err) {
                _converse.log(err, Strophe.LogLevel.FATAL);
                this.showErrorMessage(__("Sorry, an error happened while running the command. Check your browser's developer console for details."));
            },

            parseMessageForCommands (text) {
                if (_converse.muc_disable_slash_commands && !Array.isArray(_converse.muc_disable_slash_commands)) {
                    return _converse.ChatBoxView.prototype.parseMessageForCommands.apply(this, arguments);
                }
                const match = text.replace(/^\s*/, "").match(/^\/(.*?)(?: (.*))?$/) || [false, '', ''],
                      args = match[2] && match[2].splitOnce(' ').filter(s => s) || [],
                      command = match[1].toLowerCase();

                let disabled_commands = [];
                if (Array.isArray(_converse.muc_disable_slash_commands)) {
                    disabled_commands = _converse.muc_disable_slash_commands;
                    if (disabled_commands.includes(command)) {
                        return false;
                    }
                }

                switch (command) {
                    case 'admin': {
                        if (!this.verifyAffiliations(['owner']) || !this.validateRoleChangeCommand(command, args)) {
                            break;
                        }
                        this.model.setAffiliation('admin', [{
                            'jid': args[0],
                            'reason': args[1]
                        }]).then(
                            () => this.model.occupants.fetchMembers(),
                            (err) => this.onCommandError(err)
                        );
                        break;
                    }
                    case 'ban': {
                        if (!this.verifyAffiliations(['admin', 'owner']) || !this.validateRoleChangeCommand(command, args)) {
                            break;
                        }
                        this.model.setAffiliation('outcast', [{
                            'jid': args[0],
                            'reason': args[1]
                        }]).then(
                            () => this.model.occupants.fetchMembers(),
                            (err) => this.onCommandError(err)
                        );
                        break;
                    }
                    case 'deop': {
                        // FIXME: /deop only applies to setting a moderators
                        // role to "participant" (which only admin/owner can
                        // do). Moderators can however set non-moderator's role
                        // to participant (e.g. visitor => participant).
                        // Currently we don't distinguish between these two
                        // cases.
                        if (!this.verifyAffiliations(['admin', 'owner']) || !this.validateRoleChangeCommand(command, args)) {
                            break;
                        }
                        this.modifyRole(
                            this.model.get('jid'), args[0], 'participant', args[1],
                            undefined, this.onCommandError.bind(this));
                        break;
                    }
                    case 'destroy': {
                        if (!this.verifyAffiliations('owner')) {
                            break;
                        }
                        this.destroy(this.model.get('jid'), args[0])
                            .then(() => this.close())
                            .catch(e => this.onCommandError(e));
                        break;
                    }
                    case 'help': {
                        // FIXME: The availability of some of these commands
                        // depend on the MUCs configuration (e.g. whether it's
                        // moderated or not). We need to take that into
                        // consideration.
                        let allowed_commands = ['clear', 'help', 'me', 'nick', 'subject', 'topic', 'register'];
                        const occupant = this.model.occupants.findWhere({'jid': _converse.bare_jid});
                        if (this.verifyAffiliations('owner', occupant, false)) {
                            allowed_commands = allowed_commands.concat(OWNER_COMMANDS).concat(ADMIN_COMMANDS);
                        } else if (this.verifyAffiliations('admin', occupant, false)) {
                            allowed_commands = allowed_commands.concat(ADMIN_COMMANDS);
                        }
                        if (this.verifyRoles('moderator', occupant, false)) {
                            allowed_commands = allowed_commands.concat(MODERATOR_COMMANDS).concat(VISITOR_COMMANDS);
                        } else if (!this.verifyRoles(['visitor', 'participant', 'moderator'], occupant, false)) {
                            allowed_commands = allowed_commands.concat(VISITOR_COMMANDS);
                        }
                        this.showHelpMessages([`<strong>${__("You can run the following commands")}</strong>`]);
                        this.showHelpMessages([
                            `<strong>/admin</strong>: ${__("Change user's affiliation to admin")}`,
                            `<strong>/ban</strong>: ${__('Ban user from groupchat')}`,
                            `<strong>/clear</strong>: ${__('Clear the chat area')}`,
                            `<strong>/deop</strong>: ${__('Change user role to participant')}`,
                            `<strong>/destroy</strong>: ${__('Remove this groupchat')}`,
                            `<strong>/help</strong>: ${__('Show this menu')}`,
                            `<strong>/kick</strong>: ${__('Kick user from groupchat')}`,
                            `<strong>/me</strong>: ${__('Write in 3rd person')}`,
                            `<strong>/member</strong>: ${__('Grant membership to a user')}`,
                            `<strong>/mute</strong>: ${__("Remove user's ability to post messages")}`,
                            `<strong>/nick</strong>: ${__('Change your nickname')}`,
                            `<strong>/op</strong>: ${__('Grant moderator role to user')}`,
                            `<strong>/owner</strong>: ${__('Grant ownership of this groupchat')}`,
                            `<strong>/register</strong>: ${__("Register your nickname")}`,
                            `<strong>/revoke</strong>: ${__("Revoke user's membership")}`,
                            `<strong>/subject</strong>: ${__('Set groupchat subject')}`,
                            `<strong>/topic</strong>: ${__('Set groupchat subject (alias for /subject)')}`,
                            `<strong>/voice</strong>: ${__('Allow muted user to post messages')}`
                            ].filter(line => disabled_commands.every(c => (!line.startsWith(c+'<', 9))))
                             .filter(line => allowed_commands.some(c => line.startsWith(c+'<', 9)))
                        );
                        break;
                    } case 'kick': {
                        if (!this.verifyRoles(['moderator']) || !this.validateRoleChangeCommand(command, args)) {
                            break;
                        }
                        this.modifyRole(
                                this.model.get('jid'), args[0], 'none', args[1],
                                undefined, this.onCommandError.bind(this));
                        break;
                    }
                    case 'mute': {
                        if (!this.verifyRoles(['moderator']) || !this.validateRoleChangeCommand(command, args)) {
                            break;
                        }
                        this.modifyRole(
                                this.model.get('jid'), args[0], 'visitor', args[1],
                                undefined, this.onCommandError.bind(this));
                        break;
                    }
                    case 'member': {
                        if (!this.verifyAffiliations(['admin', 'owner']) || !this.validateRoleChangeCommand(command, args)) {
                            break;
                        }
                        const occupant = this.model.occupants.findWhere({'nick': args[0]}) ||
                                         this.model.occupants.findWhere({'jid': args[0]}),
                              attrs = {
                                'jid': occupant ? occupant.get('jid') : args[0],
                                'reason': args[1]
                              };
                        if (_converse.auto_register_muc_nickname && occupant) {
                            attrs['nick'] = occupant.get('nick');
                        }
                        this.model.setAffiliation('member', [attrs])
                            .then(() => this.model.occupants.fetchMembers())
                            .catch(err => this.onCommandError(err));
                        break;
                    }
                    case 'nick': {
                        if (!this.verifyRoles(['visitor', 'participant', 'moderator'])) {
                            break;
                        }
                        _converse.api.send($pres({
                            from: _converse.connection.jid,
                            to: this.model.getRoomJIDAndNick(match[2]),
                            id: _converse.connection.getUniqueId()
                        }).tree());
                        break;
                    }
                    case 'owner':
                        if (!this.verifyAffiliations(['owner']) || !this.validateRoleChangeCommand(command, args)) {
                            break;
                        }
                        this.model.setAffiliation('owner', [{
                            'jid': args[0],
                            'reason': args[1]
                        }]).then(
                            () => this.model.occupants.fetchMembers(),
                            (err) => this.onCommandError(err)
                        );
                        break;
                    case 'op': {
                        if (!this.verifyAffiliations(['admin', 'owner']) || !this.validateRoleChangeCommand(command, args)) {
                            break;
                        }
                        this.modifyRole(
                                this.model.get('jid'), args[0], 'moderator', args[1],
                                undefined, this.onCommandError.bind(this));
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
                        if (!this.verifyAffiliations(['admin', 'owner']) || !this.validateRoleChangeCommand(command, args)) {
                            break;
                        }
                        this.model.setAffiliation('none', [{
                            'jid': args[0],
                            'reason': args[1]
                        }]).then(
                            () => this.model.occupants.fetchMembers(),
                            (err) => this.onCommandError(err)
                        );
                        break;
                    }
                    case 'topic':
                    case 'subject':
                        // TODO: should be done via API call to _converse.api.rooms
                        _converse.api.send(
                            $msg({
                                to: this.model.get('jid'),
                                from: _converse.connection.jid,
                                type: "groupchat"
                            }).c("subject", {xmlns: "jabber:client"}).t(match[2] || "").tree()
                        );
                        break;
                    case 'voice': {
                        if (!this.verifyRoles(['moderator']) || !this.validateRoleChangeCommand(command, args)) {
                            break;
                        }
                        this.modifyRole(
                                this.model.get('jid'), args[0], 'participant', args[1],
                                undefined, this.onCommandError.bind(this));
                        break;
                    }
                    default:
                        return _converse.ChatBoxView.prototype.parseMessageForCommands.apply(this, arguments);
                }
                return true;
            },

            registerHandlers () {
                /* Register presence and message handlers for this chat
                 * groupchat
                 */
                // XXX: Ideally this can be refactored out so that we don't
                // need to do stanza processing inside the views in this
                // module. See the comment in "onPresence" for more info.
                this.model.addHandler('presence', 'ChatRoomView.onPresence', this.onPresence.bind(this));
                // XXX instead of having a method showStatusMessages, we could instead
                // create message models in converse-muc.js and then give them views in this module.
                this.model.addHandler('message', 'ChatRoomView.showStatusMessages', this.showStatusMessages.bind(this));
            },

            /**
             * Handles all MUC presence stanzas.
             * @private
             * @method _converse.ChatRoomView#onPresence
             * @param { XMLElement } pres - The stanza
             */
            onPresence (pres) {
                // XXX: Current thinking is that excessive stanza
                // processing inside a view is a "code smell".
                // Instead stanza processing should happen inside the
                // models/collections.
                if (pres.getAttribute('type') === 'error') {
                    this.showErrorMessageFromPresence(pres);
                } else {
                    // Instead of doing it this way, we could perhaps rather
                    // create StatusMessage objects inside the messages
                    // Collection and then simply render those. Then stanza
                    // processing is done on the model and rendering in the
                    // view(s).
                    this.showStatusMessages(pres);
                }
            },

            populateAndJoin () {
                this.model.occupants.fetchMembers();
                this.join();
            },

            /**
             * Join the groupchat.
             * @private
             * @method _converse.ChatRoomView#join
             * @param { String } nick - The user's nickname
             * @param { String } password - Optional password, if required by the groupchat
             */
            join (nick, password) {
                if (!nick && !this.model.get('nick')) {
                    this.checkForReservedNick();
                    return this;
                }
                this.showSpinner();
                this.model.join(nick, password);
                return this;
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

            getAndRenderConfigurationForm (ev) {
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
                        .catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                } else {
                    this.closeForm();
                }
            },

            checkForReservedNick () {
                /* User service-discovery to ask the XMPP server whether
                 * this user has a reserved nickname for this groupchat.
                 * If so, we'll use that, otherwise we render the nickname form.
                 */
                this.showSpinner();
                this.model.checkForReservedNick()
                    .then(this.onReservedNickFound.bind(this))
                    .catch(this.onReservedNickNotFound.bind(this));
            },

            onReservedNickFound (iq) {
                if (this.model.get('nick')) {
                    this.join();
                } else {
                    this.onReservedNickNotFound();
                }
            },

            onReservedNickNotFound (message) {
                const nick = _converse.getDefaultMUCNickname();
                if (nick) {
                    this.join(nick);
                } else {
                    this.renderNicknameForm(message);
                }
            },

            onNicknameClash (presence) {
                /* When the nickname is already taken, we either render a
                 * form for the user to choose a new nickname, or we
                 * try to make the nickname unique by adding an integer to
                 * it. So john will become john-2, and then john-3 and so on.
                 *
                 * Which option is take depends on the value of
                 * muc_nickname_from_jid.
                 */
                if (_converse.muc_nickname_from_jid) {
                    const nick = presence.getAttribute('from').split('/')[1];
                    if (nick === _converse.getDefaultMUCNickname()) {
                        this.join(nick + '-2');
                    } else {
                        const del= nick.lastIndexOf("-");
                        const num = nick.substring(del+1, nick.length);
                        this.join(nick.substring(0, del+1) + String(Number(num)+1));
                    }
                } else {
                    this.renderNicknameForm(
                        __("The nickname you chose is reserved or "+
                           "currently in use, please choose a different one.")
                    );
                }
            },

            hideChatRoomContents () {
                const container_el = this.el.querySelector('.chatroom-body');
                if (!_.isNull(container_el)) {
                    [].forEach.call(container_el.children, child => child.classList.add('hidden'));
                }
            },

            renderNicknameForm (message='') {
                /* Render a form which allows the user to choose theirnickname.
                 */
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

            renderPasswordForm (message='') {
                this.hideChatRoomContents();
                if (!this.password_form) {
                    this.password_form = new _converse.MUCPasswordForm({
                        'model': new Backbone.Model(),
                        'chatroomview': this,
                        'validation_message': message
                    });
                    const container_el = this.el.querySelector('.chatroom-body');
                    container_el.insertAdjacentElement('beforeend', this.password_form.el);
                } else {
                    this.model.set('validation_message', message);
                }
                u.showElement(this.password_form.el);
                this.model.save('connection_status', converse.ROOMSTATUS.PASSWORD_REQUIRED);
            },

            showDestroyedMessage (error) {
                u.hideElement(this.el.querySelector('.chat-area'));
                u.hideElement(this.el.querySelector('.occupants'));
                sizzle('.spinner', this.el).forEach(u.removeElement);

                const container = this.el.querySelector('.disconnect-container');
                const moved_jid = _.get(
                        sizzle('gone[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]', error).pop(),
                        'textContent'
                    ).replace(/^xmpp:/, '').replace(/\?join$/, '');
                const reason = _.get(
                        sizzle('text[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]', error).pop(),
                        'textContent'
                    );
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

            showDisconnectMessages (msgs) {
                if (_.isString(msgs)) {
                    msgs = [msgs];
                }
                u.hideElement(this.el.querySelector('.chat-area'));
                u.hideElement(this.el.querySelector('.occupants'));
                sizzle('.spinner', this.el).forEach(u.removeElement);
                const container = this.el.querySelector('.disconnect-container');
                container.innerHTML = tpl_chatroom_disconnect({
                    '_': _,
                    'disconnect_messages': msgs
                })
                u.showElement(container);
            },

            /**
             * @private
             * @method _converse.ChatRoomView#getMessageFromStatus
             * @param { XMLElement } stat: A <status> element
             * @param { Boolean } is_self: Whether the element refers to the current user
             * @param { XMLElement } stanza: The original stanza received
             */
            getMessageFromStatus (stat, stanza, is_self) {
                const code = stat.getAttribute('code');
                if (code === '110' || (code === '100' && !is_self)) { return; }
                if (code in _converse.muc.info_messages) {
                    return _converse.muc.info_messages[code];
                }
                let nick;
                if (!is_self) {
                    if (code in _converse.muc.action_info_messages) {
                        nick = Strophe.getResourceFromJid(stanza.getAttribute('from'));
                        return __(_converse.muc.action_info_messages[code], nick);
                    }
                } else if (code in _converse.muc.new_nickname_messages) {
                    if (is_self && code === "210") {
                        nick = Strophe.getResourceFromJid(stanza.getAttribute('from'));
                    } else if (is_self && code === "303") {
                        nick = stanza.querySelector('x item').getAttribute('nick');
                    }
                    return __(_converse.muc.new_nickname_messages[code], nick);
                }
                return;
            },

            getNotificationWithMessage (message) {
                let el = this.content.lastElementChild;
                while (!_.isNil(el)) {
                    const data = _.get(el, 'dataset', {});
                    if (!_.includes(_.get(el, 'classList', []), 'chat-info')) {
                        return;
                    }
                    if (el.textContent === message) {
                        return el;
                    }
                    el = el.previousElementSibling;
                }
            },

            parseXUserElement (x, stanza, is_self) {
                /* Parse the passed-in <x xmlns='http://jabber.org/protocol/muc#user'>
                 * element and construct a map containing relevant
                 * information.
                 */
                // 1. Get notification messages based on the <status> elements.
                const statuses = x.querySelectorAll('status');
                const mapper = _.partial(this.getMessageFromStatus, _, stanza, is_self);
                const notification = {};
                const messages = _.reject(
                    _.reject(_.map(statuses, mapper), _.isUndefined),
                    message => this.getNotificationWithMessage(message)
                );
                if (messages.length) {
                    notification.messages = messages;
                }
                // 2. Get disconnection messages based on the <status> elements
                const codes = _.invokeMap(statuses, Element.prototype.getAttribute, 'code');
                const disconnection_codes = _.intersection(codes, Object.keys(_converse.muc.disconnect_messages));
                const disconnected = is_self && disconnection_codes.length > 0;
                if (disconnected) {
                    notification.disconnected = true;
                    notification.disconnection_message = _converse.muc.disconnect_messages[disconnection_codes[0]];
                }
                // 3. Find the reason and actor from the <item> element
                const item = x.querySelector('item');
                // By using querySelector above, we assume here there is
                // one <item> per <x xmlns='http://jabber.org/protocol/muc#user'>
                // element. This appears to be a safe assumption, since
                // each <x/> element pertains to a single user.
                if (!_.isNull(item)) {
                    const reason = item.querySelector('reason');
                    if (reason) {
                        notification.reason = reason ? reason.textContent : undefined;
                    }
                    const actor = item.querySelector('actor');
                    if (actor) {
                        notification.actor = actor ? actor.getAttribute('nick') : undefined;
                    }
                }
                return notification;
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

            showNotificationsforUser (notification) {
                /* Given the notification object generated by
                 * parseXUserElement, display any relevant messages and
                 * information to the user.
                 */
                if (notification.disconnected) {
                    const messages = [];
                    messages.push(notification.disconnection_message);
                    if (notification.actor) {
                        messages.push(__('This action was done by %1$s.', notification.actor));
                    }
                    if (notification.reason) {
                        messages.push(__('The reason given is: "%1$s".', notification.reason));
                    }
                    this.showDisconnectMessages(messages);
                    this.model.save('connection_status', converse.ROOMSTATUS.DISCONNECTED);
                    return;
                }
                if (_.get(notification.messages, 'length')) {
                    notification.messages.forEach(message => this.insertNotification(message));
                    this.scrollDown();
                }
                if (notification.reason) {
                    this.showChatEvent(__('The reason given is: "%1$s".', notification.reason));
                }
            },

            onOccupantAdded (occupant) {
                if (occupant.get('show') === 'online') {
                    this.showJoinNotification(occupant);
                }
            },

            onOccupantRemoved (occupant) {
                if (occupant.get('show') === 'online') {
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

            getPreviousJoinOrLeaveNotification (el, nick) {
                /* Working backwards, get the first join/leave notification
                 * from the same user, on the same day and BEFORE any chat
                 * messages were received.
                 */
                while (!_.isNil(el)) {
                    const data = _.get(el, 'dataset', {});
                    if (!_.includes(_.get(el, 'classList', []), 'chat-info')) {
                        return;
                    }
                    if (!dayjs(el.getAttribute('data-isodate')).isSame(new Date(), "day")) {
                        el = el.previousElementSibling;
                        continue;
                    }
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
                    if (_.isNil(stat)) {
                        message = __('%1$s has left and re-entered the groupchat', nick);
                    } else {
                        message = __('%1$s has left and re-entered the groupchat. "%2$s"', nick, stat);
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
                    if (_.isNil(stat)) {
                        message = __('%1$s has entered the groupchat', nick);
                    } else {
                        message = __('%1$s has entered the groupchat. "%2$s"', nick, stat);
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
                    if (_.isNil(stat)) {
                        message = __('%1$s has entered and left the groupchat', nick);
                    } else {
                        message = __('%1$s has entered and left the groupchat. "%2$s"', nick, stat);
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
                    if (_.isNil(stat)) {
                        message = __('%1$s has left the groupchat', nick);
                    } else {
                        message = __('%1$s has left the groupchat. "%2$s"', nick, stat);
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

            /**
             * Check for status codes and communicate their purpose to the user.
             * See: https://xmpp.org/registrar/mucstatus.html
             * @private
             * @method _converse.ChatRoomView#showStatusMessages
             * @param { XMLElement } stanza - The message or presence stanza containing the status codes
             */
            showStatusMessages (stanza) {
                const elements = sizzle(`x[xmlns="${Strophe.NS.MUC_USER}"]`, stanza);
                const is_self = stanza.querySelectorAll("status[code='110']").length;
                const iteratee = _.partial(this.parseXUserElement.bind(this), _, stanza, is_self);
                const notifications = _.reject(_.map(elements, iteratee), _.isEmpty);
                notifications.forEach(n => this.showNotificationsforUser(n));
            },

            showErrorMessageFromPresence (presence) {
                // We didn't enter the groupchat, so we must remove it from the MUC add-on
                const error = presence.querySelector('error');
                if (error.getAttribute('type') === 'auth') {
                    if (!_.isNull(error.querySelector('not-authorized'))) {
                        this.renderPasswordForm(__("Password incorrect"));
                    } else if (!_.isNull(error.querySelector('registration-required'))) {
                        this.showDisconnectMessages(__('You are not on the member list of this groupchat.'));
                    } else if (!_.isNull(error.querySelector('forbidden'))) {
                        this.showDisconnectMessages(__('You have been banned from this groupchat.'));
                    }
                } else if (error.getAttribute('type') === 'modify') {
                    if (!_.isNull(error.querySelector('jid-malformed'))) {
                        this.showDisconnectMessages(__('No nickname was specified.'));
                    }
                } else if (error.getAttribute('type') === 'cancel') {
                    if (!_.isNull(error.querySelector('not-allowed'))) {
                        this.showDisconnectMessages(__('You are not allowed to create new groupchats.'));
                    } else if (!_.isNull(error.querySelector('not-acceptable'))) {
                        this.showDisconnectMessages(__("Your nickname doesn't conform to this groupchat's policies."));
                    } else if (sizzle('gone[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]', error).length) {
                        this.showDestroyedMessage(error);
                    } else if (!_.isNull(error.querySelector('conflict'))) {
                        this.onNicknameClash(presence);
                    } else if (!_.isNull(error.querySelector('item-not-found'))) {
                        this.showDisconnectMessages(__("This groupchat does not (yet) exist."));
                    } else if (!_.isNull(error.querySelector('service-unavailable'))) {
                        this.showDisconnectMessages(__("This groupchat has reached its maximum number of participants."));
                    } else if (!_.isNull(error.querySelector('remote-server-not-found'))) {
                        const messages = [__("Remote server not found")];
                        const reason = _.get(error.querySelector('text'), 'textContent');
                        if (reason) {
                            messages.push(__('The explanation given is: "%1$s".', reason));
                        }
                        this.showDisconnectMessages(messages);
                    }
                }
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
                } else {
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
                if (!_.isNull(spinner)) {
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
                if (_.isUndefined(this.add_room_modal)) {
                    this.add_room_modal = new _converse.AddChatRoomModal({'model': this.model});
                }
                this.add_room_modal.show(ev);
            },

            showListRoomsModal(ev) {
                if (_.isUndefined(this.list_rooms_modal)) {
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
                this.chatroomview.model.features.on('change:passwordprotected', this.render, this);
                this.chatroomview.model.features.on('change:config_stanza', this.render, this);
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
                this.model.on('change:validation_message', this.render, this);
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
                this.chatroomview.join(this.chatroomview.model.get('nick'), password);
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
                this.model.on('change:validation_message', this.render, this);
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
                    this.chatroomview.join(nick);
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
                this.model.on('change', this.render, this);
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


        _converse.ChatRoomOccupantsView = Backbone.OrderedListView.extend({
            tagName: 'div',
            className: 'occupants col-md-3 col-4',
            listItems: 'model',
            sortEvent: 'change:role',
            listSelector: '.occupant-list',

            ItemView: _converse.ChatRoomOccupantView,

            async initialize () {
                Backbone.OrderedListView.prototype.initialize.apply(this, arguments);

                this.chatroomview = this.model.chatroomview;
                this.chatroomview.model.features.on('change', this.renderRoomFeatures, this);
                this.chatroomview.model.features.on('change:open', this.renderInviteWidget, this);
                this.chatroomview.model.on('change:affiliation', this.renderInviteWidget, this);
                this.chatroomview.model.on('change:hidden_occupants', this.setVisibility, this);
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

            renderInviteWidget () {
                const widget = this.el.querySelector('.room-invite');
                if (this.shouldInviteWidgetBeShown()) {
                    if (_.isNull(widget)) {
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
                } else if (!_.isNull(widget)) {
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
                           suggestion.text.label, this.model.get('id'))
                    );
                }
                if (reason !== null) {
                    this.chatroomview.model.directInvite(suggestion.text.value, reason);
                }
                const form = this.el.querySelector('.room-invite form'),
                      input = form.querySelector('.invited-contact'),
                      error = form.querySelector('.error');
                if (!_.isNull(error)) {
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
                        this.chatroomview.model.get('affiliation') === "owner"
                    );
            },

            initInviteWidget () {
                const form = this.el.querySelector('.room-invite form');
                if (_.isNull(form)) {
                    return;
                }
                form.addEventListener('submit', this.inviteFormSubmitted.bind(this), false);
                const list = _converse.roster.map(i => ({'label': i.get('fullname') || i.get('jid'), 'value': i.get('jid')}));
                const el = this.el.querySelector('.suggestion-box').parentElement;

                if (this.invite_auto_complete) {
                    this.invite_auto_complete.destroy();
                }
                this.invite_auto_complete = new _converse.AutoComplete(el, {
                    'min_chars': 1,
                    'list': list
                });
                this.invite_auto_complete.on('suggestion-box-selectcomplete', ev => this.promptForInvite(ev));
                this.invite_auto_complete.ul.setAttribute(
                    'style',
                    `max-height: calc(${this.el.offsetHeight}px - 80px);`
                );
            }
        });


        function setMUCDomain (domain, controlboxview) {
            controlboxview.roomspanel.model.save('muc_domain', Strophe.getDomainFromJid(domain));
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
            }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
        }

        function fetchAndSetMUCDomain (controlboxview) {
            if (controlboxview.model.get('connected')) {
                if (!controlboxview.roomspanel.model.get('muc_domain')) {
                    if (_.isUndefined(_converse.muc_domain)) {
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

            const that = _converse.chatboxviews;
            _converse.chatboxes.on('add', item => {
                if (!that.get(item.get('id')) && item.get('type') === _converse.CHATROOMS_TYPE) {
                    return that.add(item.get('id'), new _converse.ChatRoomView({'model': item}));
                }
            });
        });

        _converse.api.listen.on('clearSession', () => {
            const view = _converse.chatboxviews.get('controlbox');
            if (view && view.roomspanel) {
                view.roomspanel.remove();
                delete view.roomspanel;
            }
        });

        _converse.api.listen.on('controlboxInitialized', (view) => {
            if (!_converse.allow_muc) {
                return;
            }
            fetchAndSetMUCDomain(view);
            view.model.on('change:connected', _.partial(fetchAndSetMUCDomain, view));
        });

        function reconnectToChatRooms () {
            /* Upon a reconnection event from converse, join again
             * all the open groupchats.
             */
            _converse.chatboxviews.each(view => {
                if (view.model.get('type') === _converse.CHATROOMS_TYPE) {
                    view.model.save('connection_status', converse.ROOMSTATUS.DISCONNECTED);
                    view.model.registerHandlers();
                    view.populateAndJoin();
                }
            });
        }
        _converse.api.listen.on('reconnected', reconnectToChatRooms);
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
                    if (_.isUndefined(jids)) {
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

