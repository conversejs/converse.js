// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// Copyright (c) 2013-2019, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
/**
 * @module converse-roomslist
 * @description
 * Converse.js plugin which shows a list of currently open
 * rooms in the "Rooms Panel" of the ControlBox.
 */
import "@converse/headless/converse-muc";
import { Model } from 'skeletor.js/src/model.js';
import converse from "@converse/headless/converse-core";
import tpl_rooms_list from "templates/rooms_list.html";

const { Backbone, Strophe, } = converse.env;
const u = converse.env.utils;


converse.plugins.add('converse-roomslist', {

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
    dependencies: ["converse-singleton", "converse-controlbox", "converse-muc", "converse-bookmarks"],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;
        const { __ } = _converse;

        // Promises exposed by this plugin
        _converse.api.promises.add('roomsListInitialized');


        _converse.RoomsList = Model.extend({
            defaults: {
                "toggle-state":  _converse.OPENED
            }
        });


        _converse.RoomsListView = Backbone.VDOMView.extend({
            tagName: 'div',
            className: 'list-container list-container--openrooms',
            events: {
                'click .add-bookmark': 'addBookmark',
                'click .close-room': 'closeRoom',
                'click .list-toggle': 'toggleRoomsList',
                'click .remove-bookmark': 'removeBookmark',
                'click .open-room': 'openRoom',
                'click .room-info': 'showRoomDetailsModal'
            },

            initialize () {
                this.listenTo(this.model, 'add', this.renderIfChatRoom)
                this.listenTo(this.model, 'remove', this.renderIfChatRoom)
                this.listenTo(this.model, 'destroy', this.renderIfChatRoom)
                this.listenTo(this.model, 'change', this.renderIfRelevantChange)

                const id = `converse.roomslist${_converse.bare_jid}`;
                this.list_model = new _converse.RoomsList({id});
                this.list_model.browserStorage = _converse.createStore(id);
                this.list_model.fetch();
                this.render();
                this.insertIntoControlBox();
            },

            renderIfChatRoom (model) {
                u.isChatRoom(model) && this.render();
            },

            renderIfRelevantChange (model) {
                const attrs = ['bookmarked', 'hidden', 'name', 'num_unread', 'num_unread_general'];
                const changed = model.changed || {};
                if (u.isChatRoom(model) && Object.keys(changed).filter(m => attrs.includes(m)).length) {
                    this.render();
                }
            },

            toHTML () {
                return tpl_rooms_list({
                    'rooms': this.model.filter(m => m.get('type') === _converse.CHATROOMS_TYPE),
                    'allow_bookmarks': _converse.allow_bookmarks && _converse.bookmarks,
                    'collapsed': this.list_model.get('toggle-state') !== _converse.OPENED,
                    'desc_rooms': __('Click to toggle the list of open groupchats'),
                    'info_add_bookmark': __('Bookmark this groupchat'),
                    'info_leave_room': __('Leave this groupchat'),
                    'info_remove_bookmark': __('Unbookmark this groupchat'),
                    'info_title': __('Show more information on this groupchat'),
                    'open_title': __('Click to open this groupchat'),
                    'currently_open': room => _converse.isUniView() && !room.get('hidden'),
                    'toggle_state': this.list_model.get('toggle-state'),
                    // Note to translators, "Open Groupchats" refers to groupchats that are open, NOT a command.
                    'label_rooms': __('Open Groupchats'),
                    '_converse': _converse,
                });
            },

            insertIntoControlBox () {
                const controlboxview = _converse.chatboxviews.get('controlbox');
                if (controlboxview !== undefined && !u.rootContains(_converse.root, this.el)) {
                    const el = controlboxview.el.querySelector('.list-container--openrooms');
                    el && el.parentNode.replaceChild(this.el, el);
                }
            },

            showRoomDetailsModal (ev) {
                const jid = ev.target.getAttribute('data-room-jid');
                const room = _converse.chatboxes.get(jid);
                ev.preventDefault();
                if (room.room_details_modal === undefined) {
                    room.room_details_modal = new _converse.RoomDetailsModal({'model': room});
                }
                room.room_details_modal.show(ev);
            },

            async openRoom (ev) {
                ev.preventDefault();
                const name = ev.target.textContent;
                const jid = ev.target.getAttribute('data-room-jid');
                const data = {
                    'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)) || jid
                }
                await _converse.api.rooms.open(jid, data, true);
                _converse.api.chatviews.get(jid).maybeFocus();
            },

            closeRoom (ev) {
                ev.preventDefault();
                const name = ev.target.getAttribute('data-room-name');
                const jid = ev.target.getAttribute('data-room-jid');
                if (confirm(__("Are you sure you want to leave the groupchat %1$s?", name))) {
                    // TODO: replace with API call
                    _converse.chatboxviews.get(jid).close();
                }
            },

            removeBookmark: _converse.removeBookmarkViaEvent,
            addBookmark: _converse.addBookmarkViaEvent,

            toggleRoomsList (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                const icon_el = ev.target.matches('.fa') ? ev.target : ev.target.querySelector('.fa');
                if (icon_el.classList.contains("fa-caret-down")) {
                    u.slideIn(this.el.querySelector('.open-rooms-list')).then(() => {
                        this.list_model.save({'toggle-state': _converse.CLOSED});
                        icon_el.classList.remove("fa-caret-down");
                        icon_el.classList.add("fa-caret-right");
                    });
                } else {
                    u.slideOut(this.el.querySelector('.open-rooms-list')).then(() => {
                        this.list_model.save({'toggle-state': _converse.OPENED});
                        icon_el.classList.remove("fa-caret-right");
                        icon_el.classList.add("fa-caret-down");
                    });
                }
            }
        });

        const initRoomsListView = function () {
            _converse.rooms_list_view = new _converse.RoomsListView({'model': _converse.chatboxes});
            /**
             * Triggered once the _converse.RoomsListView has been created and initialized.
             * @event _converse#roomsListInitialized
             * @example _converse.api.listen.on('roomsListInitialized', status => { ... });
             */
            _converse.api.trigger('roomsListInitialized');
        };

        _converse.api.listen.on('connected', async () =>  {
            if (_converse.allow_bookmarks) {
                await _converse.api.waitUntil('bookmarksInitialized');
            } else {
                await Promise.all([
                    _converse.api.waitUntil('chatBoxesFetched'),
                    _converse.api.waitUntil('roomsPanelRendered')
                ]);
            }
            initRoomsListView();
        });

        _converse.api.listen.on('reconnected', initRoomsListView);
    }
});

