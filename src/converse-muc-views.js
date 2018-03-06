// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2018, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//

/* This is a Converse.js plugin which add support for multi-user chat rooms, as
 * specified in XEP-0045 Multi-user chat.
 */
(function (root, factory) {
    define([
        "converse-core",
        "bootstrap",
        "emojione",
        "tpl!add_chatroom_modal",
        "tpl!chatarea",
        "tpl!chatroom",
        "tpl!chatroom_disconnect",
        "tpl!chatroom_features",
        "tpl!chatroom_form",
        "tpl!chatroom_head",
        "tpl!chatroom_invite",
        "tpl!chatroom_nickname_form",
        "tpl!chatroom_password_form",
        "tpl!chatroom_sidebar",
        "tpl!chatroom_toolbar",
        "tpl!info",
        "tpl!list_chatrooms_modal",
        "tpl!occupant",
        "tpl!room_description",
        "tpl!room_item",
        "tpl!room_panel",
        "tpl!rooms_results",
        "tpl!spinner",
        "awesomplete",
        "converse-modal"
    ], factory);
}(this, function (
    converse,
    bootstrap,
    emojione,
    tpl_add_chatroom_modal,
    tpl_chatarea,
    tpl_chatroom,
    tpl_chatroom_disconnect,
    tpl_chatroom_features,
    tpl_chatroom_form,
    tpl_chatroom_head,
    tpl_chatroom_invite,
    tpl_chatroom_nickname_form,
    tpl_chatroom_password_form,
    tpl_chatroom_sidebar,
    tpl_chatroom_toolbar,
    tpl_info,
    tpl_list_chatrooms_modal,
    tpl_occupant,
    tpl_room_description,
    tpl_room_item,
    tpl_room_panel,
    tpl_rooms_results,
    tpl_spinner,
    Awesomplete
) {
    "use strict";

    const { Backbone, Promise, Strophe, b64_sha1, moment, sizzle, _, $build, $iq, $msg, $pres } = converse.env;
    const u = converse.env.utils;

    const ROOM_FEATURES_MAP = {
        'passwordprotected': 'unsecured',
        'unsecured': 'passwordprotected',
        'hidden': 'publicroom',
        'publicroom': 'hidden',
        'membersonly': 'open',
        'open': 'membersonly',
        'persistent': 'temporary',
        'temporary': 'persistent',
        'nonanonymous': 'semianonymous',
        'semianonymous': 'nonanonymous',
        'moderated': 'unmoderated',
        'unmoderated': 'moderated'
    };

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
        dependencies: ["converse-modal", "converse-controlbox", "converse-chatview"],

        overrides: {

            ControlBoxView: {

                renderRoomsPanel () {
                    const { _converse } = this.__super__;
                    this.roomspanel = new _converse.RoomsPanel({
                        'model': new (_converse.RoomsPanelModel.extend({
                            id: b64_sha1(`converse.roomspanel${_converse.bare_jid}`), // Required by sessionStorage
                            browserStorage: new Backbone.BrowserStorage[_converse.storage](
                                b64_sha1(`converse.roomspanel${_converse.bare_jid}`))
                        }))()
                    });
                    this.roomspanel.model.fetch();
                    this.el.querySelector('.controlbox-pane').insertAdjacentElement(
                        'beforeEnd', this.roomspanel.render().el);

                    if (!this.roomspanel.model.get('nick')) {
                        this.roomspanel.model.save({
                            nick: Strophe.getNodeFromJid(_converse.bare_jid)
                        });
                    }
                    _converse.emit('roomsPanelRendered');
                },

                renderControlBoxPane () {
                    const { _converse } = this.__super__;
                    this.__super__.renderControlBoxPane.apply(this, arguments);
                    if (_converse.allow_muc) {
                        this.renderRoomsPanel();
                    }
                },
            },

            ChatBoxViews: {
                onChatBoxAdded (item) {
                    const { _converse } = this.__super__;
                    let view = this.get(item.get('id'));
                    if (!view && item.get('type') === converse.CHATROOMS_TYPE) {
                        view = new _converse.ChatRoomView({'model': item});
                        return this.add(item.get('id'), view);
                    } else {
                        return this.__super__.onChatBoxAdded.apply(this, arguments);
                    }
                }
            }
        },

        initialize () {
            const { _converse } = this,
                  { __ } = _converse;

            _converse.api.promises.add(['roomsPanelRendered']);


            function insertRoomInfo (el, stanza) {
                /* Insert room info (based on returned #disco IQ stanza)
                 *
                 * Parameters:
                 *  (HTMLElement) el: The HTML DOM element that should
                 *      contain the info.
                 *  (XMLElement) stanza: The IQ stanza containing the room
                 *      info.
                 */
                // All MUC features found here: http://xmpp.org/registrar/disco-features.html
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
                        'label_jid': __('Room Address (JID):'),
                        'label_occ': __('Occupants:'),
                        'label_features': __('Features:'),
                        'label_requires_auth': __('Requires authentication'),
                        'label_hidden': __('Hidden'),
                        'label_requires_invite': __('Requires an invitation'),
                        'label_moderated': __('Moderated'),
                        'label_non_anon': __('Non-anonymous'),
                        'label_open_room': __('Open room'),
                        'label_permanent_room': __('Permanent room'),
                        'label_public': __('Public'),
                        'label_semi_anon':  __('Semi-anonymous'),
                        'label_temp_room':  __('Temporary room'),
                        'label_unmoderated': __('Unmoderated')
                    }));
            }

            function toggleRoomInfo (ev) {
                /* Show/hide extra information about a room in a listing. */
                const parent_el = u.ancestor(ev.target, '.room-item'),
                        div_el = parent_el.querySelector('div.room-info');
                if (div_el) {
                    u.slideIn(div_el).then(u.removeElement)
                    parent_el.querySelector('a.room-info').classList.remove('selected');
                } else {
                    parent_el.insertAdjacentHTML('beforeend', tpl_spinner());
                    _converse.connection.disco.info(
                        ev.target.getAttribute('data-room-jid'),
                        null,
                        _.partial(insertRoomInfo, parent_el)
                    );
                }
            }

            
            _converse.ListChatRoomsModal = _converse.BootstrapModal.extend({

                events: {
                    'submit form': 'showRooms',
                    'click a.room-info': 'toggleRoomInfo',
                    'change input[name=nick]': 'setNick',
                    'change input[name=server]': 'setDomain',
                    'click .open-room': 'openRoom'
                },

                initialize () {
                    _converse.BootstrapModal.prototype.initialize.apply(this, arguments);
                    this.model.on('change:muc_domain', this.onDomainChange, this);
                },

                toHTML () {
                    return tpl_list_chatrooms_modal(_.extend(this.model.toJSON(), {
                        'heading_list_chatrooms': __('Query for Chatrooms'),
                        'label_server_address': __('Server address'),
                        'label_query': __('Show rooms'),
                        'server_placeholder': __('conference.example.org')
                    }));
                },

                openRoom (ev) {
                    ev.preventDefault();
                    const jid = ev.target.getAttribute('data-room-jid');
                    this.modal.hide();
                    _converse.api.rooms.open(jid);
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

                roomStanzaItemToHTMLElement (room) {
                    const name = Strophe.unescapeNode(
                        room.getAttribute('name') ||
                            room.getAttribute('jid')
                    );
                    const div = document.createElement('div');
                    div.innerHTML = tpl_room_item({
                        'name': name,
                        'jid': room.getAttribute('jid'),
                        'open_title': __('Click to open this room'),
                        'info_title': __('Show more information on this room')
                    });
                    return div.firstChild;
                },

                removeSpinner () {
                    _.each(this.el.querySelectorAll('span.spinner'),
                        (el) => el.parentNode.removeChild(el)
                    );
                },

                informNoRoomsFound () {
                    const chatrooms_el = this.el.querySelector('.available-chatrooms');
                    chatrooms_el.innerHTML = tpl_rooms_results({
                        'feedback_text': __('No rooms found')
                    });
                    const input_el = this.el.querySelector('input#show-rooms');
                    input_el.classList.remove('hidden')
                    this.removeSpinner();
                },

                onRoomsFound (iq) {
                    /* Handle the IQ stanza returned from the server, containing
                     * all its public rooms.
                     */
                    const available_chatrooms = this.el.querySelector('.available-chatrooms');
                    this.rooms = iq.querySelectorAll('query item');
                    if (this.rooms.length) {
                        // For translators: %1$s is a variable and will be
                        // replaced with the XMPP server name
                        available_chatrooms.innerHTML = tpl_rooms_results({
                            'feedback_text': __('Rooms found')
                        });
                        const fragment = document.createDocumentFragment();
                        const children = _.reject(_.map(this.rooms, this.roomStanzaItemToHTMLElement), _.isNil)
                        _.each(children, (child) => fragment.appendChild(child));
                        available_chatrooms.appendChild(fragment);
                        this.removeSpinner();
                    } else {
                        this.informNoRoomsFound();
                    }
                    return true;
                },

                updateRoomsList () {
                    /* Send an IQ stanza to the server asking for all rooms
                     */
                    _converse.connection.sendIQ(
                        $iq({
                            to: this.model.get('muc_domain'),
                            from: _converse.connection.jid,
                            type: "get"
                        }).c("query", {xmlns: Strophe.NS.DISCO_ITEMS}),
                        this.onRoomsFound.bind(this),
                        this.informNoRoomsFound.bind(this),
                        5000
                    );
                },

                showRooms (ev) {
                    ev.preventDefault();
                    const data = new FormData(ev.target);
                    this.model.save('muc_domain', data.get('server'));
                    this.updateRoomsList();
                },

                setDomain (ev) {
                    this.model.save({muc_domain: ev.target.value});
                },

                setNick (ev) {
                    this.model.save({nick: ev.target.value});
                }
            });


            _converse.AddChatRoomModal = _converse.BootstrapModal.extend({

                events: {
                    'submit form.add-chatroom': 'openChatRoom'
                },

                toHTML () {
                    return tpl_add_chatroom_modal(_.extend(this.model.toJSON(), {
                        'heading_new_chatroom': __('Enter a new Chatroom'),
                        'label_room_address': __('Room address'),
                        'label_nickname': __('Optional nickname'),
                        'chatroom_placeholder': __('name@conference.example.org'),
                        'label_join': __('Join'),
                    }));
                },

                parseRoomDataFromEvent (form) {
                    const data = new FormData(form);
                    const jid = data.get('chatroom');
                    const server = Strophe.getDomainFromJid(jid);
                    this.model.save('muc_domain', server);
                    return {
                        'jid': jid,
                        'nick': data.get('nickname')
                    }
                },

                openChatRoom (ev) {
                    ev.preventDefault();
                    const data = this.parseRoomDataFromEvent(ev.target);
                    _converse.api.rooms.open(data.jid, data);
                    this.modal.hide();
                    ev.target.reset();
                }
            });


            _converse.ChatRoomView = _converse.ChatBoxView.extend({
                /* Backbone.NativeView which renders a chat room, based upon the view
                 * for normal one-on-one chat boxes.
                 */
                length: 300,
                tagName: 'div',
                className: 'chatbox chatroom hidden',
                is_chatroom: true,
                events: {
                    'click .close-chatbox-button': 'close',
                    'click .configure-chatroom-button': 'getAndRenderConfigurationForm',
                    'click .toggle-smiley': 'toggleEmojiMenu',
                    'click .toggle-smiley ul.emoji-picker li': 'insertEmoji',
                    'click .toggle-clear': 'clearChatRoomMessages',
                    'click .toggle-call': 'toggleCall',
                    'click .toggle-occupants': 'toggleOccupants',
                    'click .new-msgs-indicator': 'viewUnreadMessages',
                    'click .occupant': 'onOccupantClicked',
                    'keypress .chat-textarea': 'keyPressed',
                    'click .send-button': 'onFormSubmitted'
                },

                initialize () {
                    this.scrollDown = _.debounce(this._scrollDown, 250);
                    this.markScrolled = _.debounce(this._markScrolled, 100);

                    this.model.messages.on('add', this.onMessageAdded, this);
                    this.model.on('show', this.show, this);
                    this.model.on('destroy', this.hide, this);
                    this.model.on('change:connection_status', this.afterConnected, this);
                    this.model.on('change:affiliation', this.renderHeading, this);
                    this.model.on('change:chat_state', this.sendChatState, this);
                    this.model.on('change:description', this.renderHeading, this);
                    this.model.on('change:name', this.renderHeading, this);

                    this.createEmojiPicker();
                    this.createOccupantsView();
                    this.render().insertIntoDOM();
                    this.registerHandlers();

                    if (this.model.get('connection_status') !==  converse.ROOMSTATUS.ENTERED) {
                        const handler = () => {
                            this.join();
                            this.fetchMessages();
                            _converse.emit('chatRoomOpened', this);
                        }
                        this.getRoomFeatures().then(handler, handler);
                    } else {
                        this.fetchMessages();
                        _converse.emit('chatRoomOpened', this);
                    }
                },

                render () {
                    this.setClasses();
                    this.el.setAttribute('id', this.model.get('box_id'));
                    this.el.innerHTML = tpl_chatroom();
                    this.renderHeading();
                    this.renderChatArea();
                    if (this.model.get('connection_status') !== converse.ROOMSTATUS.ENTERED) {
                        this.showSpinner();
                    }
                    return this;
                },

                setClasses () {
                    if (_converse.view_mode === 'fullscreen') {
                        this.el.classList.add('col-xl-10');
                        this.el.classList.add('col-md-9');
                    } else {
                        this.el.classList.add('col');
                        this.el.classList.add('col-lg-4');
                        this.el.classList.add('col-md-6');
                        this.el.classList.add('col-sm-8');
                        this.el.classList.add('col-sx-12');
                        this.el.classList.add('w-100');
                    }
                },

                renderHeading () {
                    /* Render the heading UI of the chat room. */
                    this.el.querySelector('.chat-head-chatroom').innerHTML = this.generateHeadingHTML();
                },

                renderChatArea () {
                    /* Render the UI container in which chat room messages will appear.
                     */
                    if (_.isNull(this.el.querySelector('.chat-area'))) {
                        const container_el = this.el.querySelector('.chatroom-body');
                        container_el.innerHTML = tpl_chatarea({
                            'label_message': __('Message'),
                            'label_send': __('Send'),
                            'show_send_button': _converse.show_send_button,
                            'show_toolbar': _converse.show_toolbar,
                            'unread_msgs': __('You have unread messages')
                        });
                        container_el.insertAdjacentElement('beforeend', this.occupantsview.el);
                        this.renderToolbar(tpl_chatroom_toolbar);
                        this.content = this.el.querySelector('.chat-content');
                        this.toggleOccupants(null, true);
                    }
                    return this;
                },

                createOccupantsView () {
                    /* Create the ChatRoomOccupantsView Backbone.NativeView
                     */
                    const model = new _converse.ChatRoomOccupants();
                    model.chatroomview = this;
                    this.occupantsview = new _converse.ChatRoomOccupantsView({'model': model});
                    this.occupantsview.model.on('change:role', this.informOfOccupantsRoleChange, this);
                    return this;
                },

                informOfOccupantsRoleChange (occupant, changed) {
                    const previous_role = occupant._previousAttributes.role;
                    if (previous_role === 'moderator') {
                        this.showStatusNotification(
                            __("%1$s is no longer a moderator.", occupant.get('nick')),
                            false, true)
                    }
                    if (previous_role === 'visitor') {
                        this.showStatusNotification(
                            __("%1$s has been given a voice again.", occupant.get('nick')),
                            false, true)
                    }

                    if (occupant.get('role') === 'visitor') {
                        this.showStatusNotification(
                            __("%1$s has been muted.", occupant.get('nick')),
                            false, true)
                    }
                    if (occupant.get('role') === 'moderator') {
                        this.showStatusNotification(
                            __("%1$s is now a moderator.", occupant.get('nick')),
                            false, true)
                    }
                },

                generateHeadingHTML () {
                    /* Returns the heading HTML to be rendered.
                     */
                    return tpl_chatroom_head(
                        _.extend(this.model.toJSON(), {
                            Strophe: Strophe,
                            info_close: __('Close and leave this room'),
                            info_configure: __('Configure this room'),
                            description: this.model.get('description') || ''
                    }));
                },

                afterShown (focus) {
                    /* Override from converse-chatview, specifically to avoid
                     * the 'active' chat state from being sent out prematurely.
                     *
                     * This is instead done in `afterConnected` below.
                     */
                    if (u.isPersistableModel(this.model)) {
                        this.model.clearUnreadMsgCounter();
                        this.model.save();
                    }
                    this.occupantsview.setOccupantsHeight();
                    this.scrollDown();
                    this.renderEmojiPicker();
                    if (focus) { this.focus(); }
                },

                show (focus) {
                    if (u.isVisible(this.el)) {
                        if (focus) { this.focus(); }
                        return;
                    }
                    // Override from converse-chatview in order to not use
                    // "fadeIn", which causes flashing.
                    u.showElement(this.el);
                    this.afterShown(focus);
                },

                afterConnected () {
                    if (this.model.get('connection_status') === converse.ROOMSTATUS.ENTERED) {
                        this.setChatState(_converse.ACTIVE);
                        this.scrollDown();
                        this.focus();
                    }
                },

                getExtraMessageClasses (attrs) {
                    let extra_classes = _converse.ChatBoxView.prototype
                            .getExtraMessageClasses.apply(this, arguments);

                    if (this.is_chatroom && attrs.sender === 'them' &&
                            this.model.isUserMentioned(attrs.message)) {
                        // Add special class to mark groupchat messages
                        // in which we are mentioned.
                        extra_classes += ' mentioned';
                    }
                    return extra_classes;
                },

                getToolbarOptions () {
                    return _.extend(
                        _converse.ChatBoxView.prototype.getToolbarOptions.apply(this, arguments),
                        {
                          label_hide_occupants: __('Hide the list of occupants'),
                          show_occupants_toggle: this.is_chatroom && _converse.visible_toolbar_buttons.toggle_occupants
                        }
                    );
                },

                close (ev) {
                    /* Close this chat box, which implies leaving the room as
                     * well.
                     */
                    this.leave();
                },

                setOccupantsVisibility () {
                    const icon_el = this.el.querySelector('.toggle-occupants');
                    if (this.model.get('hidden_occupants')) {
                        this.el.querySelector('.chat-area').classList.add('full');
                        u.hideElement(this.el.querySelector('.occupants'));
                    } else {
                        this.el.querySelector('.chat-area').classList.remove('full');
                        this.el.querySelector('.occupants').classList.remove('hidden');
                    }
                    this.occupantsview.setOccupantsHeight();
                },

                toggleOccupants (ev, preserve_state) {
                    /* Show or hide the right sidebar containing the chat
                     * occupants (and the invite widget).
                     */
                    if (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                    }
                    if (!preserve_state) {
                        this.model.set({'hidden_occupants': !this.model.get('hidden_occupants')});
                    }
                    this.setOccupantsVisibility();
                    this.scrollDown();
                },

                onOccupantClicked (ev) {
                    /* When an occupant is clicked, insert their nickname into
                     * the chat textarea input.
                     */
                    this.insertIntoTextArea(ev.target.textContent);
                },

                requestMemberList (chatroom_jid, affiliation) {
                    /* Send an IQ stanza to the server, asking it for the
                     * member-list of this room.
                     *
                     * See: http://xmpp.org/extensions/xep-0045.html#modifymember
                     *
                     * Parameters:
                     *  (String) chatroom_jid: The JID of the chatroom for
                     *      which the member-list is being requested
                     *  (String) affiliation: The specific member list to
                     *      fetch. 'admin', 'owner' or 'member'.
                     *
                     * Returns:
                     *  A promise which resolves once the list has been
                     *  retrieved.
                     */
                    return new Promise((resolve, reject) => {
                        affiliation = affiliation || 'member';
                        const iq = $iq({to: chatroom_jid, type: "get"})
                            .c("query", {xmlns: Strophe.NS.MUC_ADMIN})
                                .c("item", {'affiliation': affiliation});
                        _converse.connection.sendIQ(iq, resolve, reject);
                    });
                },

                parseMemberListIQ (iq) {
                    /* Given an IQ stanza with a member list, create an array of member
                     * objects.
                     */
                    return _.map(
                        sizzle(`query[xmlns="${Strophe.NS.MUC_ADMIN}"] item`, iq),
                        (item) => ({
                            'jid': item.getAttribute('jid'),
                            'affiliation': item.getAttribute('affiliation'),
                        })
                    );
                },

                computeAffiliationsDelta (exclude_existing, remove_absentees, new_list, old_list) {
                    /* Given two lists of objects with 'jid', 'affiliation' and
                     * 'reason' properties, return a new list containing
                     * those objects that are new, changed or removed
                     * (depending on the 'remove_absentees' boolean).
                     *
                     * The affiliations for new and changed members stay the
                     * same, for removed members, the affiliation is set to 'none'.
                     *
                     * The 'reason' property is not taken into account when
                     * comparing whether affiliations have been changed.
                     *
                     * Parameters:
                     *  (Boolean) exclude_existing: Indicates whether JIDs from
                     *      the new list which are also in the old list
                     *      (regardless of affiliation) should be excluded
                     *      from the delta. One reason to do this
                     *      would be when you want to add a JID only if it
                     *      doesn't have *any* existing affiliation at all.
                     *  (Boolean) remove_absentees: Indicates whether JIDs
                     *      from the old list which are not in the new list
                     *      should be considered removed and therefore be
                     *      included in the delta with affiliation set
                     *      to 'none'.
                     *  (Array) new_list: Array containing the new affiliations
                     *  (Array) old_list: Array containing the old affiliations
                     */
                    const new_jids = _.map(new_list, 'jid');
                    const old_jids = _.map(old_list, 'jid');

                    // Get the new affiliations
                    let delta = _.map(
                        _.difference(new_jids, old_jids),
                        (jid) => new_list[_.indexOf(new_jids, jid)]
                    );
                    if (!exclude_existing) {
                        // Get the changed affiliations
                        delta = delta.concat(_.filter(new_list, function (item) {
                            const idx = _.indexOf(old_jids, item.jid);
                            if (idx >= 0) {
                                return item.affiliation !== old_list[idx].affiliation;
                            }
                            return false;
                        }));
                    }
                    if (remove_absentees) {
                        // Get the removed affiliations
                        delta = delta.concat(
                            _.map(
                                _.difference(old_jids, new_jids),
                                (jid) => ({'jid': jid, 'affiliation': 'none'})
                            )
                        );
                    }
                    return delta;
                },

                sendAffiliationIQ (chatroom_jid, affiliation, member) {
                    /* Send an IQ stanza specifying an affiliation change.
                     *
                     * Paremeters:
                     *  (String) chatroom_jid: JID of the relevant room
                     *  (String) affiliation: affiliation (could also be stored
                     *      on the member object).
                     *  (Object) member: Map containing the member's jid and
                     *      optionally a reason and affiliation.
                     */
                    return new Promise((resolve, reject) => {
                        const iq = $iq({to: chatroom_jid, type: "set"})
                            .c("query", {xmlns: Strophe.NS.MUC_ADMIN})
                            .c("item", {
                                'affiliation': member.affiliation || affiliation,
                                'jid': member.jid
                            });
                        if (!_.isUndefined(member.reason)) {
                            iq.c("reason", member.reason);
                        }
                        _converse.connection.sendIQ(iq, resolve, reject);
                    });
                },

                setAffiliation (affiliation, members) {
                    /* Send IQ stanzas to the server to set an affiliation for
                     * the provided JIDs.
                     *
                     * See: http://xmpp.org/extensions/xep-0045.html#modifymember
                     *
                     * XXX: Prosody doesn't accept multiple JIDs' affiliations
                     * being set in one IQ stanza, so as a workaround we send
                     * a separate stanza for each JID.
                     * Related ticket: https://prosody.im/issues/issue/795
                     *
                     * Parameters:
                     *  (String) affiliation: The affiliation
                     *  (Object) members: A map of jids, affiliations and
                     *      optionally reasons. Only those entries with the
                     *      same affiliation as being currently set will be
                     *      considered.
                     *
                     * Returns:
                     *  A promise which resolves and fails depending on the
                     *  XMPP server response.
                     */
                    members = _.filter(members, (member) =>
                        // We only want those members who have the right
                        // affiliation (or none, which implies the provided
                        // one).
                        _.isUndefined(member.affiliation) ||
                                member.affiliation === affiliation
                    );
                    const promises = _.map(
                        members,
                        _.partial(this.sendAffiliationIQ, this.model.get('jid'), affiliation)
                    );
                    return Promise.all(promises);
                },

                setAffiliations (members) {
                    /* Send IQ stanzas to the server to modify the
                     * affiliations in this room.
                     *
                     * See: http://xmpp.org/extensions/xep-0045.html#modifymember
                     *
                     * Parameters:
                     *  (Object) members: A map of jids, affiliations and optionally reasons
                     *  (Function) onSuccess: callback for a succesful response
                     *  (Function) onError: callback for an error response
                     */
                    const affiliations = _.uniq(_.map(members, 'affiliation'));
                    _.each(affiliations, _.partial(this.setAffiliation.bind(this), _, members));
                },

                marshallAffiliationIQs () {
                    /* Marshall a list of IQ stanzas into a map of JIDs and
                     * affiliations.
                     *
                     * Parameters:
                     *  Any amount of XMLElement objects, representing the IQ
                     *  stanzas.
                     */
                    return _.flatMap(arguments[0], this.parseMemberListIQ);
                },

                getJidsWithAffiliations (affiliations) {
                    /* Returns a map of JIDs that have the affiliations
                     * as provided.
                     */
                    if (_.isString(affiliations)) {
                        affiliations = [affiliations];
                    }
                    return new Promise((resolve, reject) => {
                        const promises = _.map(
                            affiliations,
                            _.partial(this.requestMemberList, this.model.get('jid'))
                        );

                        Promise.all(promises).then(
                            _.flow(this.marshallAffiliationIQs.bind(this), resolve),
                            _.flow(this.marshallAffiliationIQs.bind(this), resolve)
                        );
                    });
                },

                updateMemberLists (members, affiliations, deltaFunc) {
                    /* Fetch the lists of users with the given affiliations.
                     * Then compute the delta between those users and
                     * the passed in members, and if it exists, send the delta
                     * to the XMPP server to update the member list.
                     *
                     * Parameters:
                     *  (Object) members: Map of member jids and affiliations.
                     *  (String|Array) affiliation: An array of affiliations or
                     *      a string if only one affiliation.
                     *  (Function) deltaFunc: The function to compute the delta
                     *      between old and new member lists.
                     *
                     * Returns:
                     *  A promise which is resolved once the list has been
                     *  updated or once it's been established there's no need
                     *  to update the list.
                     */
                    this.getJidsWithAffiliations(affiliations).then((old_members) => {
                        this.setAffiliations(deltaFunc(members, old_members));
                    });
                },

                directInvite (recipient, reason) {
                    /* Send a direct invitation as per XEP-0249
                     *
                     * Parameters:
                     *    (String) recipient - JID of the person being invited
                     *    (String) reason - Optional reason for the invitation
                     */
                    if (this.model.get('membersonly')) {
                        // When inviting to a members-only room, we first add
                        // the person to the member list by giving them an
                        // affiliation of 'member' (if they're not affiliated
                        // already), otherwise they won't be able to join.
                        const map = {}; map[recipient] = 'member';
                        const deltaFunc = _.partial(this.computeAffiliationsDelta, true, false);
                        this.updateMemberLists(
                            [{'jid': recipient, 'affiliation': 'member', 'reason': reason}],
                            ['member', 'owner', 'admin'],
                            deltaFunc
                        );
                    }
                    const attrs = {
                        'xmlns': 'jabber:x:conference',
                        'jid': this.model.get('jid')
                    };
                    if (reason !== null) { attrs.reason = reason; }
                    if (this.model.get('password')) { attrs.password = this.model.get('password'); }
                    const invitation = $msg({
                        from: _converse.connection.jid,
                        to: recipient,
                        id: _converse.connection.getUniqueId()
                    }).c('x', attrs);
                    _converse.connection.send(invitation);
                    _converse.emit('roomInviteSent', {
                        'room': this,
                        'recipient': recipient,
                        'reason': reason
                    });
                },

                handleChatStateMessage (message) {
                    /* Override the method on the ChatBoxView base class to
                     * ignore <gone/> notifications in groupchats.
                     *
                     * As laid out in the business rules in XEP-0085
                     * http://xmpp.org/extensions/xep-0085.html#bizrules-groupchat
                     */
                    if (message.get('fullname') === this.model.get('nick')) {
                        // Don't know about other servers, but OpenFire sends
                        // back to you your own chat state notifications.
                        // We ignore them here...
                        return;
                    }
                    if (message.get('chat_state') !== _converse.GONE) {
                        _converse.ChatBoxView.prototype.handleChatStateMessage.apply(this, arguments);
                    }
                },

                sendChatState () {
                    /* Sends a message with the status of the user in this chat session
                     * as taken from the 'chat_state' attribute of the chat box.
                     * See XEP-0085 Chat State Notifications.
                     */
                    if (this.model.get('connection_status') !==  converse.ROOMSTATUS.ENTERED) {
                        return;
                    }
                    const chat_state = this.model.get('chat_state');
                    if (chat_state === _converse.GONE) {
                        // <gone/> is not applicable within MUC context
                        return;
                    }
                    _converse.connection.send(
                        $msg({'to':this.model.get('jid'), 'type': 'groupchat'})
                            .c(chat_state, {'xmlns': Strophe.NS.CHATSTATES}).up()
                            .c('no-store', {'xmlns': Strophe.NS.HINTS}).up()
                            .c('no-permanent-store', {'xmlns': Strophe.NS.HINTS})
                    );
                },

                sendChatRoomMessage (text) {
                    /* Constuct a message stanza to be sent to this chat room,
                     * and send it to the server.
                     *
                     * Parameters:
                     *  (String) text: The message text to be sent.
                     */
                    text = emojione.shortnameToUnicode(text)
                    const msgid = _converse.connection.getUniqueId();
                    const msg = $msg({
                        to: this.model.get('jid'),
                        from: _converse.connection.jid,
                        type: 'groupchat',
                        id: msgid
                    }).c("body").t(text).up()
                    .c("x", {xmlns: "jabber:x:event"}).c(_converse.COMPOSING);
                    _converse.connection.send(msg);
                    this.model.messages.create({
                        fullname: this.model.get('nick'),
                        sender: 'me',
                        time: moment().format(),
                        message: text,
                        msgid
                    });
                },

                modifyRole(room, nick, role, reason, onSuccess, onError) {
                    const item = $build("item", {nick, role});
                    const iq = $iq({to: room, type: "set"}).c("query", {xmlns: Strophe.NS.MUC_ADMIN}).cnode(item.node);
                    if (reason !== null) { iq.c("reason", reason); }
                    return _converse.connection.sendIQ(iq, onSuccess, onError);
                },

                validateRoleChangeCommand (command, args) {
                    /* Check that a command to change a chat room user's role or
                     * affiliation has anough arguments.
                     */
                    // TODO check if first argument is valid
                    if (args.length < 1 || args.length > 2) {
                        this.showStatusNotification(
                            __('Error: the "%1$s" command takes two arguments, the user\'s nickname and optionally a reason.',
                                command),
                            true
                        );
                        return false;
                    }
                    return true;
                },

                clearChatRoomMessages (ev) {
                    /* Remove all messages from the chat room UI.
                     */
                    if (!_.isUndefined(ev)) { ev.stopPropagation(); }
                    const result = confirm(__("Are you sure you want to clear the messages from this room?"));
                    if (result === true) {
                        this.content.innerHTML = '';
                    }
                    return this;
                },

                onCommandError () {
                    this.showStatusNotification(__("Error: could not execute the command"), true);
                },

                onMessageSubmitted (text) {
                    /* Gets called when the user presses enter to send off a
                     * message in a chat room.
                     *
                     * Parameters:
                     *    (String) text - The message text.
                     */
                    if (_converse.muc_disable_moderator_commands) {
                        return this.sendChatRoomMessage(text);
                    }
                    const match = text.replace(/^\s*/, "").match(/^\/(.*?)(?: (.*))?$/) || [false, '', ''],
                        args = match[2] && match[2].splitOnce(' ') || [],
                        command = match[1].toLowerCase();
                    switch (command) {
                        case 'admin':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.setAffiliation('admin',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).then(null, this.onCommandError.bind(this));
                            break;
                        case 'ban':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.setAffiliation('outcast',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).then(null, this.onCommandError.bind(this));
                            break;
                        case 'clear':
                            this.clearChatRoomMessages();
                            break;
                        case 'deop':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'participant', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'help':
                            this.showHelpMessages([
                                `<strong>/admin</strong>: ${__("Change user's affiliation to admin")}`,
                                `<strong>/ban</strong>: ${__('Ban user from room')}`,
                                `<strong>/clear</strong>: ${__('Remove messages')}`,
                                `<strong>/deop</strong>: ${__('Change user role to participant')}`,
                                `<strong>/help</strong>: ${__('Show this menu')}`,
                                `<strong>/kick</strong>: ${__('Kick user from room')}`,
                                `<strong>/me</strong>: ${__('Write in 3rd person')}`,
                                `<strong>/member</strong>: ${__('Grant membership to a user')}`,
                                `<strong>/mute</strong>: ${__("Remove user's ability to post messages")}`,
                                `<strong>/nick</strong>: ${__('Change your nickname')}`,
                                `<strong>/op</strong>: ${__('Grant moderator role to user')}`,
                                `<strong>/owner</strong>: ${__('Grant ownership of this room')}`,
                                `<strong>/revoke</strong>: ${__("Revoke user's membership")}`,
                                `<strong>/subject</strong>: ${__('Set room subject')}`,
                                `<strong>/topic</strong>: ${__('Set room subject (alias for /subject)')}`,
                                `<strong>/voice</strong>: ${__('Allow muted user to post messages')}`
                            ]);
                            break;
                        case 'kick':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'none', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'mute':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'visitor', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'member':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.setAffiliation('member',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).then(null, this.onCommandError.bind(this));
                            break;
                        case 'nick':
                            _converse.connection.send($pres({
                                from: _converse.connection.jid,
                                to: this.getRoomJIDAndNick(match[2]),
                                id: _converse.connection.getUniqueId()
                            }).tree());
                            break;
                        case 'owner':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.setAffiliation('owner',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).then(null, this.onCommandError.bind(this));
                            break;
                        case 'op':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'moderator', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'revoke':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.setAffiliation('none',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).then(null, this.onCommandError.bind(this));
                            break;
                        case 'topic':
                        case 'subject':
                            _converse.connection.send(
                                $msg({
                                    to: this.model.get('jid'),
                                    from: _converse.connection.jid,
                                    type: "groupchat"
                                }).c("subject", {xmlns: "jabber:client"}).t(match[2]).tree()
                            );
                            break;
                        case 'voice':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'participant', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        default:
                            this.sendChatRoomMessage(text);
                        break;
                    }
                },

                handleMUCMessage (stanza) {
                    /* Handler for all MUC messages sent to this chat room.
                     *
                     * Parameters:
                     *  (XMLElement) stanza: The message stanza.
                     */
                    const configuration_changed = stanza.querySelector("status[code='104']");
                    const logging_enabled = stanza.querySelector("status[code='170']");
                    const logging_disabled = stanza.querySelector("status[code='171']");
                    const room_no_longer_anon = stanza.querySelector("status[code='172']");
                    const room_now_semi_anon = stanza.querySelector("status[code='173']");
                    const room_now_fully_anon = stanza.querySelector("status[code='173']");
                    if (configuration_changed || logging_enabled || logging_disabled ||
                            room_no_longer_anon || room_now_semi_anon || room_now_fully_anon) {
                        this.getRoomFeatures();
                    }
                    _.flow(this.showStatusMessages.bind(this), this.onChatRoomMessage.bind(this))(stanza);
                    return true;
                },

                getRoomJIDAndNick (nick) {
                    /* Utility method to construct the JID for the current user
                     * as occupant of the room.
                     *
                     * This is the room JID, with the user's nick added at the
                     * end.
                     *
                     * For example: room@conference.example.org/nickname
                     */
                    if (nick) {
                        this.model.save({'nick': nick});
                    } else {
                        nick = this.model.get('nick');
                    }
                    const room = this.model.get('jid');
                    const jid = Strophe.getBareJidFromJid(room);
                    return jid + (nick !== null ? `/${nick}` : "");
                },

                registerHandlers () {
                    /* Register presence and message handlers for this chat
                     * room
                     */
                    const room_jid = this.model.get('jid');
                    this.removeHandlers();
                    this.presence_handler = _converse.connection.addHandler(
                        this.onChatRoomPresence.bind(this),
                        Strophe.NS.MUC, 'presence', null, null, room_jid,
                        {'ignoreNamespaceFragment': true, 'matchBareFromJid': true}
                    );
                    this.message_handler = _converse.connection.addHandler(
                        this.handleMUCMessage.bind(this),
                        null, 'message', 'groupchat', null, room_jid,
                        {'matchBareFromJid': true}
                    );
                },

                removeHandlers () {
                    /* Remove the presence and message handlers that were
                     * registered for this chat room.
                     */
                    if (this.message_handler) {
                        _converse.connection.deleteHandler(this.message_handler);
                        delete this.message_handler;
                    }
                    if (this.presence_handler) {
                        _converse.connection.deleteHandler(this.presence_handler);
                        delete this.presence_handler;
                    }
                    return this;
                },

                join (nick, password) {
                    /* Join the chat room.
                     *
                     * Parameters:
                     *  (String) nick: The user's nickname
                     *  (String) password: Optional password, if required by
                     *      the room.
                     */
                    nick = nick ? nick : this.model.get('nick');
                    if (!nick) {
                        return this.checkForReservedNick();
                    }
                    if (this.model.get('connection_status') === converse.ROOMSTATUS.ENTERED) {
                        // We have restored a chat room from session storage,
                        // so we don't send out a presence stanza again.
                        return this;
                    }

                    const stanza = $pres({
                        'from': _converse.connection.jid,
                        'to': this.getRoomJIDAndNick(nick)
                    }).c("x", {'xmlns': Strophe.NS.MUC})
                      .c("history", {'maxstanzas': _converse.muc_history_max_stanzas}).up();
                    if (password) {
                        stanza.cnode(Strophe.xmlElement("password", [], password));
                    }
                    this.model.save('connection_status', converse.ROOMSTATUS.CONNECTING);
                    _converse.connection.send(stanza);
                    return this;
                },

                sendUnavailablePresence (exit_msg) {
                    const presence = $pres({
                        type: "unavailable",
                        from: _converse.connection.jid,
                        to: this.getRoomJIDAndNick()
                    });
                    if (exit_msg !== null) {
                        presence.c("status", exit_msg);
                    }
                    _converse.connection.sendPresence(presence);
                },

                leave(exit_msg) {
                    /* Leave the chat room.
                     *
                     * Parameters:
                     *  (String) exit_msg: Optional message to indicate your
                     *      reason for leaving.
                     */
                    this.hide();
                    if (Backbone.history.getFragment() === "converse/room?jid="+this.model.get('jid')) {
                        _converse.router.navigate('');
                    }
                    this.occupantsview.model.reset();
                    this.occupantsview.model.browserStorage._clear();
                    if (_converse.connection.connected) {
                        this.sendUnavailablePresence(exit_msg);
                    }
                    u.safeSave(
                        this.model,
                        {'connection_status': converse.ROOMSTATUS.DISCONNECTED}
                    );
                    this.removeHandlers();
                    _converse.ChatBoxView.prototype.close.apply(this, arguments);
                },

                renderConfigurationForm (stanza) {
                    /* Renders a form given an IQ stanza containing the current
                     * room configuration.
                     *
                     * Returns a promise which resolves once the user has
                     * either submitted the form, or canceled it.
                     *
                     * Parameters:
                     *  (XMLElement) stanza: The IQ stanza containing the room
                     *      config.
                     */
                    const container_el = this.el.querySelector('.chatroom-body');
                    _.each(container_el.querySelectorAll('.chatroom-form-container'), u.removeElement);
                    _.each(container_el.children, u.hideElement);
                    container_el.insertAdjacentHTML('beforeend', tpl_chatroom_form());

                    const form_el = container_el.querySelector('form.chatroom-form'),
                          fieldset_el = form_el.querySelector('fieldset'),
                          fields = stanza.querySelectorAll('field'),
                          title = _.get(stanza.querySelector('title'), 'textContent'),
                          instructions = _.get(stanza.querySelector('instructions'), 'textContent');

                    u.removeElement(fieldset_el.querySelector('span.spinner'));
                    fieldset_el.insertAdjacentHTML('beforeend', `<legend>${title}</legend>`);

                    if (instructions && instructions !== title) {
                        fieldset_el.insertAdjacentHTML('beforeend', `<p class="instructions">${instructions}</p>`);
                    }
                    _.each(fields, function (field) {
                        fieldset_el.insertAdjacentHTML('beforeend', u.xForm2webForm(field, stanza));
                    });

                    // Render save/cancel buttons
                    const last_fieldset_el = document.createElement('fieldset');
                    last_fieldset_el.insertAdjacentHTML(
                        'beforeend',
                        `<input type="submit" class="pure-button button-primary" value="${__('Save')}"/>`);
                    last_fieldset_el.insertAdjacentHTML(
                        'beforeend',
                        `<input type="button" class="pure-button button-cancel" value="${__('Cancel')}"/>`);
                    form_el.insertAdjacentElement('beforeend', last_fieldset_el);

                    last_fieldset_el.querySelector('input[type=button]').addEventListener('click', (ev) => {
                        ev.preventDefault();
                        this.closeForm();
                    });

                    form_el.addEventListener('submit', (ev) => {
                            ev.preventDefault();
                            this.saveConfiguration(ev.target).then(
                                this.getRoomFeatures.bind(this)
                            );
                        },
                        false
                    );
                },

                sendConfiguration(config, onSuccess, onError) {
                    /* Send an IQ stanza with the room configuration.
                     *
                     * Parameters:
                     *  (Array) config: The room configuration
                     *  (Function) onSuccess: Callback upon succesful IQ response
                     *      The first parameter passed in is IQ containing the
                     *      room configuration.
                     *      The second is the response IQ from the server.
                     *  (Function) onError: Callback upon error IQ response
                     *      The first parameter passed in is IQ containing the
                     *      room configuration.
                     *      The second is the response IQ from the server.
                     */
                    const iq = $iq({to: this.model.get('jid'), type: "set"})
                        .c("query", {xmlns: Strophe.NS.MUC_OWNER})
                        .c("x", {xmlns: Strophe.NS.XFORM, type: "submit"});
                    _.each(config || [], function (node) { iq.cnode(node).up(); });
                    onSuccess = _.isUndefined(onSuccess) ? _.noop : _.partial(onSuccess, iq.nodeTree);
                    onError = _.isUndefined(onError) ? _.noop : _.partial(onError, iq.nodeTree);
                    return _converse.connection.sendIQ(iq, onSuccess, onError);
                },

                saveConfiguration (form) {
                    /* Submit the room configuration form by sending an IQ
                     * stanza to the server.
                     *
                     * Returns a promise which resolves once the XMPP server
                     * has return a response IQ.
                     *
                     * Parameters:
                     *  (HTMLElement) form: The configuration form DOM element.
                     */
                    return new Promise((resolve, reject) => {
                        const inputs = form ? sizzle(':input:not([type=button]):not([type=submit])', form) : [],
                              configArray = _.map(inputs, u.webForm2xForm);
                        this.sendConfiguration(configArray, resolve, reject);
                        this.closeForm();
                    });
                },

                autoConfigureChatRoom () {
                    /* Automatically configure room based on the
                     * 'roomconfig' data on this view's model.
                     *
                     * Returns a promise which resolves once a response IQ has
                     * been received.
                     *
                     * Parameters:
                     *  (XMLElement) stanza: IQ stanza from the server,
                     *       containing the configuration.
                     */
                    const that = this;
                    return new Promise((resolve, reject) => {
                        this.fetchRoomConfiguration().then(function (stanza) {
                            const configArray = [],
                                fields = stanza.querySelectorAll('field'),
                                config = that.model.get('roomconfig');
                            let count = fields.length;

                            _.each(fields, function (field) {
                                const fieldname = field.getAttribute('var').replace('muc#roomconfig_', ''),
                                    type = field.getAttribute('type');
                                let value;
                                if (fieldname in config) {
                                    switch (type) {
                                        case 'boolean':
                                            value = config[fieldname] ? 1 : 0;
                                            break;
                                        case 'list-multi':
                                            // TODO: we don't yet handle "list-multi" types
                                            value = field.innerHTML;
                                            break;
                                        default:
                                            value = config[fieldname];
                                    }
                                    field.innerHTML = $build('value').t(value);
                                }
                                configArray.push(field);
                                if (!--count) {
                                    that.sendConfiguration(configArray, resolve, reject);
                                }
                            });
                        });
                    });
                },

                closeForm () {
                    /* Remove the configuration form without submitting and
                     * return to the chat view.
                     */
                    u.removeElement(this.el.querySelector('.chatroom-form-container'));
                    this.renderAfterTransition();
                },

                fetchRoomConfiguration (handler) {
                    /* Send an IQ stanza to fetch the room configuration data.
                     * Returns a promise which resolves once the response IQ
                     * has been received.
                     *
                     * Parameters:
                     *  (Function) handler: The handler for the response IQ
                     */
                    return new Promise((resolve, reject) => {
                        _converse.connection.sendIQ(
                            $iq({
                                'to': this.model.get('jid'),
                                'type': "get"
                            }).c("query", {xmlns: Strophe.NS.MUC_OWNER}),
                            (iq) => {
                                if (handler) {
                                    handler.apply(this, arguments);
                                }
                                resolve(iq);
                            },
                            reject // errback
                        );
                    });
                },

                parseRoomFeatures (iq) {
                    /* See http://xmpp.org/extensions/xep-0045.html#disco-roominfo
                     *
                     *  <identity
                     *      category='conference'
                     *      name='A Dark Cave'
                     *      type='text'/>
                     *  <feature var='http://jabber.org/protocol/muc'/>
                     *  <feature var='muc_passwordprotected'/>
                     *  <feature var='muc_hidden'/>
                     *  <feature var='muc_temporary'/>
                     *  <feature var='muc_open'/>
                     *  <feature var='muc_unmoderated'/>
                     *  <feature var='muc_nonanonymous'/>
                     *  <feature var='urn:xmpp:mam:0'/>
                     */
                    const features = {
                        'features_fetched': true,
                        'name': iq.querySelector('identity').getAttribute('name')
                    }
                    _.each(iq.querySelectorAll('feature'), function (field) {
                        const fieldname = field.getAttribute('var');
                        if (!fieldname.startsWith('muc_')) {
                            if (fieldname === Strophe.NS.MAM) {
                                features.mam_enabled = true;
                            }
                            return;
                        }
                        features[fieldname.replace('muc_', '')] = true;
                    });
                    const desc_field = iq.querySelector('field[var="muc#roominfo_description"] value');
                    if (!_.isNull(desc_field)) {
                        features.description = desc_field.textContent;
                    }
                    this.model.save(features);
                },

                getRoomFeatures () {
                    /* Fetch the room disco info, parse it and then
                     * save it on the Backbone.Model of this chat rooms.
                     */
                    return new Promise((resolve, reject) => {
                        _converse.connection.disco.info(
                            this.model.get('jid'),
                            null,
                            _.flow(this.parseRoomFeatures.bind(this), resolve),
                            () => { reject(new Error("Could not parse the room features")) },
                            5000
                        );
                    });
                },

                getAndRenderConfigurationForm (ev) {
                    /* Start the process of configuring a chat room, either by
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
                    this.showSpinner();
                    this.fetchRoomConfiguration()
                        .then(this.renderConfigurationForm.bind(this))
                        .catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                },

                submitNickname (ev) {
                    /* Get the nickname value from the form and then join the
                     * chat room with it.
                     */
                    ev.preventDefault();
                    const nick_el = ev.target.nick;
                    const nick = nick_el.value;
                    if (!nick) {
                        nick_el.classList.add('error');
                        return;
                    }
                    else {
                        nick_el.classList.remove('error');
                    }
                    this.el.querySelector('.chatroom-form-container').outerHTML = tpl_spinner();
                    this.join(nick);
                },

                checkForReservedNick () {
                    /* User service-discovery to ask the XMPP server whether
                     * this user has a reserved nickname for this room.
                     * If so, we'll use that, otherwise we render the nickname
                     * form.
                     */
                    this.showSpinner();
                    _converse.connection.sendIQ(
                        $iq({
                            'to': this.model.get('jid'),
                            'from': _converse.connection.jid,
                            'type': "get"
                        }).c("query", {
                            'xmlns': Strophe.NS.DISCO_INFO,
                            'node': 'x-roomuser-item'
                        }),
                        this.onNickNameFound.bind(this),
                        this.onNickNameNotFound.bind(this)
                    );
                    return this;
                },

                onNickNameFound (iq) {
                    /* We've received an IQ response from the server which
                     * might contain the user's reserved nickname.
                     * If no nickname is found we either render a form for
                     * them to specify one, or we try to join the room with the
                     * node of the user's JID.
                     *
                     * Parameters:
                     *  (XMLElement) iq: The received IQ stanza
                     */
                    const identity_el = iq.querySelector('query[node="x-roomuser-item"] identity'),
                          nick = identity_el ? identity_el.getAttribute('name') : null;
                    if (!nick) {
                        this.onNickNameNotFound();
                    } else {
                        this.join(nick);
                    }
                },

                onNickNameNotFound (message) {
                    if (_converse.muc_nickname_from_jid) {
                        // We try to enter the room with the node part of
                        // the user's JID.
                        this.join(this.getDefaultNickName());
                    } else {
                        this.renderNicknameForm(message);
                    }
                },

                getDefaultNickName () {
                    /* The default nickname (used when muc_nickname_from_jid is true)
                     * is the node part of the user's JID.
                     * We put this in a separate method so that it can be
                     * overridden by plugins.
                     */
                    return Strophe.unescapeNode(Strophe.getNodeFromJid(_converse.bare_jid));
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
                        if (nick === this.getDefaultNickName()) {
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
                        _.each(container_el.children, (child) => { child.classList.add('hidden'); });
                    }
                },

                renderNicknameForm (message) {
                    /* Render a form which allows the user to choose their
                     * nickname.
                     */
                    this.hideChatRoomContents();
                    _.each(this.el.querySelectorAll('span.centered.spinner'), u.removeElement);
                    if (!_.isString(message)) {
                        message = '';
                    }
                    const container_el = this.el.querySelector('.chatroom-body');
                    container_el.insertAdjacentHTML(
                        'beforeend',
                        tpl_chatroom_nickname_form({
                            heading: __('Please choose your nickname'),
                            label_nickname: __('Nickname'),
                            label_join: __('Enter room'),
                            validation_message: message
                        }));
                    this.model.save('connection_status', converse.ROOMSTATUS.NICKNAME_REQUIRED);

                    const form_el = this.el.querySelector('.chatroom-form');
                    form_el.addEventListener('submit', this.submitNickname.bind(this), false);
                },

                submitPassword (ev) {
                    ev.preventDefault();
                    const password = this.el.querySelector('.chatroom-form input[type=password]').value;
                    this.showSpinner();
                    this.join(this.model.get('nick'), password);
                },

                renderPasswordForm () {
                    const container_el = this.el.querySelector('.chatroom-body');
                    _.each(container_el.children, u.hideElement);
                    _.each(this.el.querySelectorAll('.spinner'), u.removeElement);

                    container_el.insertAdjacentHTML('beforeend',
                        tpl_chatroom_password_form({
                            heading: __('This chatroom requires a password'),
                            label_password: __('Password: '),
                            label_submit: __('Submit')
                        }));

                    this.model.save('connection_status', converse.ROOMSTATUS.PASSWORD_REQUIRED);
                    this.el.querySelector('.chatroom-form').addEventListener(
                        'submit', this.submitPassword.bind(this), false);
                },

                showDisconnectMessage (msg) {
                    u.hideElement(this.el.querySelector('.chat-area'));
                    u.hideElement(this.el.querySelector('.occupants'));
                    _.each(this.el.querySelectorAll('.spinner'), u.removeElement);
                    this.el.querySelector('.chatroom-body').insertAdjacentHTML(
                        'beforeend',
                        tpl_chatroom_disconnect({
                            'disconnect_message': msg
                        })
                    );
                },

                getMessageFromStatus (stat, stanza, is_self) {
                    /* Parameters:
                     *  (XMLElement) stat: A <status> element.
                     *  (Boolean) is_self: Whether the element refers to the
                     *                     current user.
                     *  (XMLElement) stanza: The original stanza received.
                     */
                    const code = stat.getAttribute('code');
                    if (code === '110') { return; }
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

                saveAffiliationAndRole (pres) {
                    /* Parse the presence stanza for the current user's
                     * affiliation.
                     *
                     * Parameters:
                     *  (XMLElement) pres: A <presence> stanza.
                     */
                    const item = sizzle(`x[xmlns="${Strophe.NS.MUC_USER}"] item`, pres).pop();
                    const is_self = pres.querySelector("status[code='110']");
                    if (is_self && !_.isNil(item)) {
                        const affiliation = item.getAttribute('affiliation');
                        const role = item.getAttribute('role');
                        if (affiliation) {
                            this.model.save({'affiliation': affiliation});
                        }
                        if (role) {
                            this.model.save({'role': role});
                        }
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
                    const messages = _.reject(_.map(statuses, mapper), _.isUndefined);
                    if (messages.length) {
                        notification.messages = messages;
                    }
                    // 2. Get disconnection messages based on the <status> elements
                    const codes = _.invokeMap(statuses, Element.prototype.getAttribute, 'code');
                    const disconnection_codes = _.intersection(codes, _.keys(_converse.muc.disconnect_messages));
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

                displayNotificationsforUser (notification) {
                    /* Given the notification object generated by
                     * parseXUserElement, display any relevant messages and
                     * information to the user.
                     */
                    if (notification.disconnected) {
                        this.showDisconnectMessage(notification.disconnection_message);
                        if (notification.actor) {
                            this.showDisconnectMessage(__('This action was done by %1$s.', notification.actor));
                        }
                        if (notification.reason) {
                            this.showDisconnectMessage(__('The reason given is: "%1$s".', notification.reason));
                        }
                        this.model.save('connection_status', converse.ROOMSTATUS.DISCONNECTED);
                        return;
                    }
                    _.each(notification.messages, (message) => {
                        this.content.insertAdjacentHTML(
                            'beforeend',
                            tpl_info({
                                'data': '',
                                'isodate': moment().format(),
                                'message': message
                            }));
                    });
                    if (notification.reason) {
                        this.showStatusNotification(__('The reason given is: "%1$s".', notification.reason), true);
                    }
                    if (_.get(notification.messages, 'length')) {
                        this.scrollDown();
                    }
                },

                displayJoinNotification (stanza) {
                    const nick = Strophe.getResourceFromJid(stanza.getAttribute('from'));
                    const stat = stanza.querySelector('status');
                    const last_el = this.content.lastElementChild;

                    if (_.includes(_.get(last_el, 'classList', []), 'chat-info') &&
                            _.get(last_el, 'dataset', {}).leave === `"${nick}"`) {
                        last_el.outerHTML =
                            tpl_info({
                                'data': `data-leavejoin="${nick}"`,
                                'isodate': moment().format(),
                                'message': __('%1$s has left and re-entered the room.', nick)
                            });
                    } else {
                        let  message;
                        if (_.get(stat, 'textContent')) {
                            message = __('%1$s has entered the room. "%2$s"', nick, stat.textContent);
                        } else {
                            message = __('%1$s has entered the room.', nick);
                        }
                        const data = {
                            'data': `data-join="${nick}"`,
                            'isodate': moment().format(),
                            'message': message
                        };
                        if (_.includes(_.get(last_el, 'classList', []), 'chat-info') &&
                            _.get(last_el, 'dataset', {}).joinleave === `"${nick}"`) {

                            last_el.outerHTML = tpl_info(data);
                        } else {
                            const el = u.stringToElement(tpl_info(data));
                            this.content.insertAdjacentElement('beforeend', el);
                            this.insertDayIndicator(el);
                        }
                    }
                    this.scrollDown();
                },

                displayLeaveNotification (stanza) {
                    const nick = Strophe.getResourceFromJid(stanza.getAttribute('from'));
                    const stat = stanza.querySelector('status');
                    const last_el = this.content.lastElementChild;
                    if (_.includes(_.get(last_el, 'classList', []), 'chat-info') &&
                            _.get(last_el, 'dataset', {}).join === `"${nick}"`) {

                        let message;
                        if (_.get(stat, 'textContent')) {
                            message = __('%1$s has entered and left the room. "%2$s"', nick, stat.textContent);
                        } else {
                            message = __('%1$s has entered and left the room.', nick);
                        }
                        last_el.outerHTML =
                            tpl_info({
                                'data': `data-joinleave="${nick}"`,
                                'isodate': moment().format(),
                                'message': message
                            });
                    } else {
                        let message;
                        if (_.get(stat, 'textContent')) {
                            message = __('%1$s has left the room. "%2$s"', nick, stat.textContent);
                        } else {
                            message = __('%1$s has left the room.', nick);
                        }
                        const data = {
                            'message': message,
                            'isodate': moment().format(),
                            'data': `data-leave="${nick}"`
                        }
                        if (_.includes(_.get(last_el, 'classList', []), 'chat-info') &&
                            _.get(last_el, 'dataset', {}).leavejoin === `"${nick}"`) {

                            last_el.outerHTML = tpl_info(data);
                        } else {
                            const el = u.stringToElement(tpl_info(data));
                            this.content.insertAdjacentElement('beforeend', el);
                            this.insertDayIndicator(el);
                        }
                    }
                    this.scrollDown();
                },

                displayJoinOrLeaveNotification (stanza) {
                    if (stanza.getAttribute('type') === 'unavailable') {
                        this.displayLeaveNotification(stanza);
                    } else {
                        const nick = Strophe.getResourceFromJid(stanza.getAttribute('from'));
                        if (!this.occupantsview.model.find({'nick': nick})) {
                            // Only show join message if we don't already have the
                            // occupant model. Doing so avoids showing duplicate
                            // join messages.
                            this.displayJoinNotification(stanza);
                        }
                    }
                },

                showStatusMessages (stanza) {
                    /* Check for status codes and communicate their purpose to the user.
                     * See: http://xmpp.org/registrar/mucstatus.html
                     *
                     * Parameters:
                     *  (XMLElement) stanza: The message or presence stanza
                     *      containing the status codes.
                     */
                    const elements = sizzle(`x[xmlns="${Strophe.NS.MUC_USER}"]`, stanza);
                    const is_self = stanza.querySelectorAll("status[code='110']").length;
                    const iteratee = _.partial(this.parseXUserElement.bind(this), _, stanza, is_self);
                    const notifications = _.reject(_.map(elements, iteratee), _.isEmpty);
                    if (_.isEmpty(notifications)) {
                        if (_converse.muc_show_join_leave &&
                                stanza.nodeName === 'presence' &&
                                this.model.get('connection_status') === converse.ROOMSTATUS.ENTERED) {
                            this.displayJoinOrLeaveNotification(stanza);
                        }
                    } else {
                        _.each(notifications, this.displayNotificationsforUser.bind(this));
                    }
                    return stanza;
                },

                showErrorMessage (presence) {
                    // We didn't enter the room, so we must remove it from the MUC add-on
                    const error = presence.querySelector('error');
                    if (error.getAttribute('type') === 'auth') {
                        if (!_.isNull(error.querySelector('not-authorized'))) {
                            this.renderPasswordForm();
                        } else if (!_.isNull(error.querySelector('registration-required'))) {
                            this.showDisconnectMessage(__('You are not on the member list of this room.'));
                        } else if (!_.isNull(error.querySelector('forbidden'))) {
                            this.showDisconnectMessage(__('You have been banned from this room.'));
                        }
                    } else if (error.getAttribute('type') === 'modify') {
                        if (!_.isNull(error.querySelector('jid-malformed'))) {
                            this.showDisconnectMessage(__('No nickname was specified.'));
                        }
                    } else if (error.getAttribute('type') === 'cancel') {
                        if (!_.isNull(error.querySelector('not-allowed'))) {
                            this.showDisconnectMessage(__('You are not allowed to create new rooms.'));
                        } else if (!_.isNull(error.querySelector('not-acceptable'))) {
                            this.showDisconnectMessage(__("Your nickname doesn't conform to this room's policies."));
                        } else if (!_.isNull(error.querySelector('conflict'))) {
                            this.onNicknameClash(presence);
                        } else if (!_.isNull(error.querySelector('item-not-found'))) {
                            this.showDisconnectMessage(__("This room does not (yet) exist."));
                        } else if (!_.isNull(error.querySelector('service-unavailable'))) {
                            this.showDisconnectMessage(__("This room has reached its maximum number of occupants."));
                        }
                    }
                },

                renderAfterTransition () {
                    /* Rerender the room after some kind of transition. For
                     * example after the spinner has been removed or after a
                     * form has been submitted and removed.
                     */
                    if (this.model.get('connection_status') == converse.ROOMSTATUS.NICKNAME_REQUIRED) {
                        this.renderNicknameForm();
                    } else if (this.model.get('connection_status') == converse.ROOMSTATUS.PASSWORD_REQUIRED) {
                        this.renderPasswordForm();
                    } else {
                        this.el.querySelector('.chat-area').classList.remove('hidden');
                        this.setOccupantsVisibility();
                        this.scrollDown();
                    }
                },

                showSpinner () {
                    u.removeElement(this.el.querySelector('.spinner'));

                    const container_el = this.el.querySelector('.chatroom-body');
                    const children = Array.prototype.slice.call(container_el.children, 0);
                    container_el.insertAdjacentHTML('afterbegin', tpl_spinner());
                    _.each(children, u.hideElement);

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

                onOwnChatRoomPresence (pres) {
                    /* Handles a received presence relating to the current
                     * user.
                     *
                     * For locked rooms (which are by definition "new"), the
                     * room will either be auto-configured or created instantly
                     * (with default config) or a configuration room will be
                     * rendered.
                     *
                     * If the room is not locked, then the room will be
                     * auto-configured only if applicable and if the current
                     * user is the room's owner.
                     *
                     * Parameters:
                     *  (XMLElement) pres: The stanza
                     */
                    this.saveAffiliationAndRole(pres);

                    const locked_room = pres.querySelector("status[code='201']");
                    if (locked_room) {
                        if (this.model.get('auto_configure')) {
                            this.autoConfigureChatRoom().then(this.getRoomFeatures.bind(this));
                        } else if (_converse.muc_instant_rooms) {
                            // Accept default configuration
                            this.saveConfiguration().then(this.getRoomFeatures.bind(this));
                        } else {
                            this.getAndRenderConfigurationForm();
                            return; // We haven't yet entered the room, so bail here.
                        }
                    } else if (!this.model.get('features_fetched')) {
                        // The features for this room weren't fetched.
                        // That must mean it's a new room without locking
                        // (in which case Prosody doesn't send a 201 status),
                        // otherwise the features would have been fetched in
                        // the "initialize" method already.
                        if (this.model.get('affiliation') === 'owner' && this.model.get('auto_configure')) {
                            this.autoConfigureChatRoom().then(this.getRoomFeatures.bind(this));
                        } else {
                            this.getRoomFeatures();
                        }
                    }
                    this.model.save('connection_status', converse.ROOMSTATUS.ENTERED);
                },

                onChatRoomPresence (pres) {
                    /* Handles all MUC presence stanzas.
                     *
                     * Parameters:
                     *  (XMLElement) pres: The stanza
                     */
                    if (pres.getAttribute('type') === 'error') {
                        this.model.save('connection_status', converse.ROOMSTATUS.DISCONNECTED);
                        this.showErrorMessage(pres);
                        return true;
                    }
                    const is_self = pres.querySelector("status[code='110']");
                    if (is_self && pres.getAttribute('type') !== 'unavailable') {
                        this.onOwnChatRoomPresence(pres);
                    }
                    this.hideSpinner().showStatusMessages(pres);
                    // This must be called after showStatusMessages so that
                    // "join" messages are correctly shown.
                    this.occupantsview.updateOccupantsOnPresence(pres);
                    if (this.model.get('role') !== 'none' &&
                            this.model.get('connection_status') === converse.ROOMSTATUS.CONNECTING) {
                        this.model.save('connection_status', converse.ROOMSTATUS.CONNECTED);
                    }
                    return true;
                },

                setChatRoomSubject (sender, subject) {
                    // For translators: the %1$s and %2$s parts will get
                    // replaced by the user and topic text respectively
                    // Example: Topic set by JC Brand to: Hello World!
                    this.content.insertAdjacentHTML(
                        'beforeend',
                        tpl_info({
                            'data': '',
                            'isodate': moment().format(),
                            'message': __('Topic set by %1$s to: %2$s', sender, subject)
                        }));
                    this.scrollDown();
                },

                isDuplicateBasedOnTime (message) {
                    /* Checks whether a received messages is actually a
                     * duplicate based on whether it has a "ts" attribute
                     * with a unix timestamp.
                     *
                     * This is used for better integration with Slack's XMPP
                     * gateway, which doesn't use message IDs but instead the
                     * aforementioned "ts" attributes.
                     */
                    const entity = _converse.disco_entities.get(_converse.domain);
                    if (entity.identities.where({'name': "Slack-XMPP"})) {
                        const ts = message.getAttribute('ts');
                        if (_.isNull(ts)) {
                            return false;
                        } else {
                            return this.model.messages.where({
                                'sender': 'me',
                                'message': this.model.getMessageBody(message)
                            }).filter(
                                (msg) => Math.abs(moment(msg.get('time')).diff(moment.unix(ts))) < 5000
                            ).length > 0;
                        }
                    }
                    return false;
                },

                isDuplicate (message, original_stanza) {
                    const msgid = message.getAttribute('id'),
                          jid = message.getAttribute('from'),
                          resource = Strophe.getResourceFromJid(jid),
                          sender = resource && Strophe.unescapeNode(resource) || '';
                    if (msgid) {
                        return this.model.messages.filter(
                            // Some bots (like HAL in the prosody chatroom)
                            // respond to commands with the same ID as the
                            // original message. So we also check the sender.
                            (msg) => msg.get('msgid') === msgid && msg.get('fullname') === sender
                        ).length > 0;
                    }
                    return this.isDuplicateBasedOnTime(message);
                },

                onChatRoomMessage (message) {
                    /* Given a <message> stanza, create a message
                     * Backbone.Model if appropriate.
                     *
                     * Parameters:
                     *  (XMLElement) msg: The received message stanza
                     */
                    const original_stanza = message,
                        forwarded = message.querySelector('forwarded');
                    let delay;
                    if (!_.isNull(forwarded)) {
                        message = forwarded.querySelector('message');
                        delay = forwarded.querySelector('delay');
                    }
                    const jid = message.getAttribute('from'),
                        resource = Strophe.getResourceFromJid(jid),
                        sender = resource && Strophe.unescapeNode(resource) || '',
                        subject = _.propertyOf(message.querySelector('subject'))('textContent');

                    if (this.isDuplicate(message, original_stanza)) {
                        return true;
                    }
                    if (subject) {
                        this.setChatRoomSubject(sender, subject);
                    }
                    if (sender === '') {
                        return true;
                    }
                    this.model.incrementUnreadMsgCounter(original_stanza);
                    this.model.createMessage(message, delay, original_stanza);
                    if (sender !== this.model.get('nick')) {
                        // We only emit an event if it's not our own message
                        _converse.emit(
                            'message',
                            {'stanza': original_stanza, 'chatbox': this.model}
                        );
                    }
                    return true;
                }
            });


            _converse.RoomsPanel = Backbone.NativeView.extend({
                /* Backbone.NativeView which renders MUC section of the control box.
                 *
                 * Chat rooms can be listed, joined and new rooms can be created.
                 */
                tagName: 'div',
                className: 'controlbox-pane',
                id: 'chatrooms',
                events: {
                    'click a.chatbox-btn.fa-users': 'showAddRoomModal',
                    'click a.chatbox-btn.fa-list-ul': 'showListRoomsModal',
                    'click a.room-info': 'toggleRoomInfo'
                },

                render () {
                    this.el.innerHTML = tpl_room_panel({
                        'heading_chatrooms': __('Chatrooms'),
                        'title_new_room': __('Add a new room'),
                        'title_list_rooms': __('Query for rooms')
                    });
                    return this;
                },

                toggleRoomInfo (ev) {
                    ev.preventDefault();
                    toggleRoomInfo(ev);
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


            _converse.ChatRoomOccupantView = Backbone.VDOMView.extend({
                tagName: 'li',
                initialize () {
                    this.model.on('change', this.render, this);
                },

                toHTML () {
                    const show = this.model.get('show') || 'online';
                    return tpl_occupant(
                        _.extend(
                            { 'jid': '',
                              'show': show,
                              'hint_show': _converse.PRETTY_CHAT_STATUS[show],
                              'hint_occupant': __('Click to mention %1$s in your message.', this.model.get('nick')),
                              'desc_moderator': __('This user is a moderator.'),
                              'desc_occupant': __('This user can send messages in this room.'),
                              'desc_visitor': __('This user can NOT send messages in this room.')
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

                initialize () {
                    Backbone.OrderedListView.prototype.initialize.apply(this, arguments);

                    this.chatroomview = this.model.chatroomview;
                    this.chatroomview.model.on('change:open', this.renderInviteWidget, this);
                    this.chatroomview.model.on('change:affiliation', this.renderInviteWidget, this);
                    this.chatroomview.model.on('change:hidden', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:mam_enabled', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:membersonly', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:moderated', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:nonanonymous', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:open', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:passwordprotected', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:persistent', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:publicroom', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:semianonymous', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:temporary', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:unmoderated', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:unsecured', this.onFeatureChanged, this);

                    const id = b64_sha1(`converse.occupants${_converse.bare_jid}${this.chatroomview.model.get('jid')}`);
                    this.model.browserStorage = new Backbone.BrowserStorage.session(id);
                    this.render();
                    this.model.fetch({
                        'add': true,
                        'silent': true,
                        'success': this.sortAndPositionAllItems.bind(this)
                    });
                },

                render () {
                    this.el.innerHTML = tpl_chatroom_sidebar(
                        _.extend(this.chatroomview.model.toJSON(), {
                            'allow_muc_invitations': _converse.allow_muc_invitations,
                            'label_occupants': __('Occupants')
                        })
                    );
                    if (_converse.allow_muc_invitations) {
                        _converse.api.waitUntil('rosterContactsFetched').then(
                            this.renderInviteWidget.bind(this)
                        );
                    }
                    return this.renderRoomFeatures();
                },

                renderInviteWidget () {
                    const form = this.el.querySelector('form.room-invite');
                    if (this.shouldInviteWidgetBeShown()) {
                        if (_.isNull(form)) {
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
                    } else if (!_.isNull(form)) {
                        form.remove();
                    }
                    return this;
                },

                renderRoomFeatures () {
                    const picks = _.pick(this.chatroomview.model.attributes, converse.ROOM_FEATURES),
                        iteratee = (a, v) => a || v,
                        el = this.el.querySelector('.chatroom-features');

                    el.innerHTML = tpl_chatroom_features(
                            _.extend(this.chatroomview.model.toJSON(), {
                                'has_features': _.reduce(_.values(picks), iteratee),
                                'label_features': __('Features'),
                                'label_hidden': __('Hidden'),
                                'label_mam_enabled': __('Message archiving'),
                                'label_membersonly': __('Members only'),
                                'label_moderated': __('Moderated'),
                                'label_nonanonymous': __('Non-anonymous'),
                                'label_open': __('Open'),
                                'label_passwordprotected': __('Password protected'),
                                'label_persistent': __('Persistent'),
                                'label_public': __('Public'),
                                'label_semianonymous': __('Semi-anonymous'),
                                'label_temporary': __('Temporary'),
                                'label_unmoderated': __('Unmoderated'),
                                'label_unsecured': __('No password'),
                                'tt_hidden': __('This room is not publicly searchable'),
                                'tt_mam_enabled': __('Messages are archived on the server'),
                                'tt_membersonly': __('This room is restricted to members only'),
                                'tt_moderated': __('This room is being moderated'),
                                'tt_nonanonymous': __('All other room occupants can see your XMPP username'),
                                'tt_open': __('Anyone can join this room'),
                                'tt_passwordprotected': __('This room requires a password before entry'),
                                'tt_persistent': __('This room persists even if it\'s unoccupied'),
                                'tt_public': __('This room is publicly searchable'),
                                'tt_semianonymous': __('Only moderators can see your XMPP username'),
                                'tt_temporary': __('This room will disappear once the last person leaves'),
                                'tt_unmoderated': __('This room is not being moderated'),
                                'tt_unsecured': __('This room does not require a password upon entry')
                            }));
                    this.setOccupantsHeight();
                    return this;
                },

                onFeatureChanged (model) {
                    /* When a feature has been changed, it's logical opposite
                     * must be set to the opposite value.
                     *
                     * So for example, if "temporary" was set to "false", then
                     * "persistent" will be set to "true" in this method.
                     *
                     * Additionally a debounced render method is called to make
                     * sure the features widget gets updated.
                     */
                    if (_.isUndefined(this.debouncedRenderRoomFeatures)) {
                        this.debouncedRenderRoomFeatures = _.debounce(
                            this.renderRoomFeatures, 100, {'leading': false}
                        );
                    }
                    const changed_features = {};
                    _.each(_.keys(model.changed), function (k) {
                        if (!_.isNil(ROOM_FEATURES_MAP[k])) {
                            changed_features[ROOM_FEATURES_MAP[k]] = !model.changed[k];
                        }
                    });
                    this.chatroomview.model.save(changed_features, {'silent': true});
                    this.debouncedRenderRoomFeatures();
                },

                setOccupantsHeight () {
                    const el = this.el.querySelector('.chatroom-features');
                    this.el.querySelector('.occupant-list').style.cssText =
                        `height: calc(100% - ${el.offsetHeight}px - 5em);`;
                },

                parsePresence (pres) {
                    const id = Strophe.getResourceFromJid(pres.getAttribute("from"));
                    const data = {
                        nick: id,
                        type: pres.getAttribute("type"),
                        states: []
                    };
                    _.each(pres.childNodes, function (child) {
                        switch (child.nodeName) {
                            case "status":
                                data.status = child.textContent || null;
                                break;
                            case "show":
                                data.show = child.textContent || 'online';
                                break;
                            case "x":
                                if (child.getAttribute("xmlns") === Strophe.NS.MUC_USER) {
                                    _.each(child.childNodes, function (item) {
                                        switch (item.nodeName) {
                                            case "item":
                                                data.affiliation = item.getAttribute("affiliation");
                                                data.role = item.getAttribute("role");
                                                data.jid = item.getAttribute("jid");
                                                data.nick = item.getAttribute("nick") || data.nick;
                                                break;
                                            case "status":
                                                if (item.getAttribute("code")) {
                                                    data.states.push(item.getAttribute("code"));
                                                }
                                        }
                                    });
                                }
                        }
                    });
                    return data;
                },

                findOccupant (data) {
                    /* Try to find an existing occupant based on the passed in
                     * data object.
                     *
                     * If we have a JID, we use that as lookup variable,
                     * otherwise we use the nick. We don't always have both,
                     * but should have at least one or the other.
                     */
                    const jid = Strophe.getBareJidFromJid(data.jid);
                    if (jid !== null) {
                        return this.model.where({'jid': jid}).pop();
                    } else {
                        return this.model.where({'nick': data.nick}).pop();
                    }
                },

                updateOccupantsOnPresence (pres) {
                    /* Given a presence stanza, update the occupant models
                     * based on its contents.
                     *
                     * Parameters:
                     *  (XMLElement) pres: The presence stanza
                     */
                    const data = this.parsePresence(pres);
                    if (data.type === 'error') {
                        return true;
                    }
                    const occupant = this.findOccupant(data);
                    if (data.type === 'unavailable') {
                        if (occupant) { occupant.destroy(); }
                    } else {
                        const jid = Strophe.getBareJidFromJid(data.jid);
                        const attributes = _.extend(data, {
                            'jid': jid ? jid : undefined,
                            'resource': data.jid ? Strophe.getResourceFromJid(data.jid) : undefined
                        });
                        if (occupant) {
                            occupant.save(attributes);
                        } else {
                            this.model.create(attributes);
                        }
                    }
                },

                promptForInvite (suggestion) {
                    const reason = prompt(
                        __('You are about to invite %1$s to the chat room "%2$s". '+
                           'You may optionally include a message, explaining the reason for the invitation.',
                           suggestion.text.label, this.model.get('id'))
                    );
                    if (reason !== null) {
                        this.chatroomview.directInvite(suggestion.text.value, reason);
                    }
                    const form = suggestion.target.form,
                          error = form.querySelector('.pure-form-message.error');
                    if (!_.isNull(error)) {
                        error.parentNode.removeChild(error);
                    }
                    suggestion.target.value = '';
                },

                inviteFormSubmitted (evt) {
                    evt.preventDefault();
                    const el = evt.target.querySelector('input.invited-contact'),
                          jid = el.value;
                    if (!jid || _.compact(jid.split('@')).length < 2) {
                        evt.target.outerHTML = tpl_chatroom_invite({
                            'error_message': __('Please enter a valid XMPP username'),
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
                        (this.chatroomview.model.get('open') ||
                            this.chatroomview.model.get('affiliation') === "owner"
                        );
                },

                initInviteWidget () {
                    const form = this.el.querySelector('form.room-invite');
                    if (_.isNull(form)) {
                        return;
                    }
                    form.addEventListener('submit', this.inviteFormSubmitted.bind(this), false);
                    const el = this.el.querySelector('input.invited-contact');
                    const list = _converse.roster.map(function (item) {
                            const label = item.get('fullname') || item.get('jid');
                            return {'label': label, 'value':item.get('jid')};
                        });
                    const awesomplete = new Awesomplete(el, {
                        'minChars': 1,
                        'list': list
                    });
                    el.addEventListener('awesomplete-selectcomplete',
                        this.promptForInvite.bind(this));
                }
            });


            function setMUCDomain (domain, controlboxview) {
                _converse.muc_domain = domain;
                controlboxview.roomspanel.model.save({'muc_domain': domain});
            }

            function setMUCDomainFromDisco (controlboxview) {
                /* Check whether service discovery for the user's domain
                 * returned MUC information and use that to automatically
                 * set the MUC domain for the "Rooms" panel of the controlbox.
                 */
                function featureAdded (feature) {
                    if ((feature.get('var') === Strophe.NS.MUC)) {
                        setMUCDomain(feature.get('from'), controlboxview);
                    }
                }
                _converse.api.waitUntil('discoInitialized').then(() => {
                    _converse.api.listen.on('serviceDiscovered', featureAdded);
                    // Features could have been added before the controlbox was
                    // initialized. We're only interested in MUC
                    _converse.disco_entities.each((entity) => {
                        const feature = entity.features.findWhere({'var': Strophe.NS.MUC });
                        if (feature) {
                            featureAdded(feature)
                        }
                    });
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
            _converse.on('controlboxInitialized', (view) => {
                if (!_converse.allow_muc) {
                    return;
                }
                fetchAndSetMUCDomain(view);
                view.model.on('change:connected', _.partial(fetchAndSetMUCDomain, view));
            });
            /************************ END Event Handlers ************************/
        }
    });
}));
