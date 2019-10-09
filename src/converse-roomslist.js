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
import BrowserStorage from "backbone.browserStorage";
import { OrderedListView } from "backbone.overview";
import converse from "@converse/headless/converse-core";
import tpl_rooms_list from "templates/rooms_list.html";
import tpl_rooms_list_item from "templates/rooms_list_item.html"

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
        const { _converse } = this,
              { __ } = _converse;

        // Promises exposed by this plugin
        _converse.api.promises.add('roomsListInitialized');


        _converse.OpenRooms = _converse.Collection.extend({

            comparator (room) {
                if (_converse.bookmarks && room.get('bookmarked')) {
                    const bookmark = _converse.bookmarks.findWhere({'jid': room.get('jid')});
                    return bookmark.get('name');
                } else {
                    return room.get('name');
                }
            },

            initialize () {
                _converse.chatboxes.on('add', this.onChatBoxAdded, this);
                _converse.chatboxes.on('change:hidden', this.onChatBoxChanged, this);
                _converse.chatboxes.on('change:bookmarked', this.onChatBoxChanged, this);
                _converse.chatboxes.on('change:name', this.onChatBoxChanged, this);
                _converse.chatboxes.on('change:num_unread', this.onChatBoxChanged, this);
                _converse.chatboxes.on('change:num_unread_general', this.onChatBoxChanged, this);
                _converse.chatboxes.on('remove', this.onChatBoxRemoved, this);
                this.reset(_converse.chatboxes.where({'type': _converse.CHATROOMS_TYPE}).map(cb => cb.attributes));
            },

            onChatBoxAdded (item) {
                if (item.get('type') === _converse.CHATROOMS_TYPE) {
                    this.create(item.attributes);
                }
            },

            onChatBoxChanged (item) {
                if (item.get('type') === _converse.CHATROOMS_TYPE) {
                    const room =  this.get(item.get('jid'));
                    room && room.set(item.attributes);
                }
            },

            onChatBoxRemoved (item) {
                if (item.get('type') === _converse.CHATROOMS_TYPE) {
                    const room = this.get(item.get('jid'))
                    this.remove(room);
                }
            }
        });


        _converse.RoomsList = Backbone.Model.extend({
            defaults: {
                "toggle-state":  _converse.OPENED
            }
        });

        _converse.RoomsListElementView = Backbone.VDOMView.extend({
            events: {
                'click .room-info': 'showRoomDetailsModal'
            },

            initialize () {
                this.listenTo(this.model, 'destroy', this.remove)
                this.listenTo(this.model, 'remove', this.remove)
                this.listenTo(this.model, 'change:bookmarked', this.render)
                this.listenTo(this.model, 'change:hidden', this.render)
                this.listenTo(this.model, 'change:name', this.render)
                this.listenTo(this.model, 'change:num_unread', this.render)
                this.listenTo(this.model, 'change:num_unread_general', this.render)
            },

            toHTML () {
                return tpl_rooms_list_item(
                    Object.assign(this.model.toJSON(), {
                        // XXX: By the time this renders, the _converse.bookmarks
                        // collection should already exist if bookmarks are
                        // supported by the XMPP server. So we can use it
                        // as a check for support (other ways of checking are async).
                        'allow_bookmarks': _converse.allow_bookmarks && _converse.bookmarks,
                        'currently_open': _converse.isUniView() && !this.model.get('hidden'),
                        'info_leave_room': __('Leave this groupchat'),
                        'info_remove_bookmark': __('Unbookmark this groupchat'),
                        'info_add_bookmark': __('Bookmark this groupchat'),
                        'info_title': __('Show more information on this groupchat'),
                        'name': this.getRoomsListElementName(),
                        'open_title': __('Click to open this groupchat')
                    }));
            },

            showRoomDetailsModal (ev) {
                const room = _converse.chatboxes.get(this.model.get('jid'));
                ev.preventDefault();
                if (room.room_details_modal === undefined) {
                    room.room_details_modal = new _converse.RoomDetailsModal({'model': room});
                }
                room.room_details_modal.show(ev);
            },

            getRoomsListElementName () {
                if (this.model.get('bookmarked') && _converse.bookmarks) {
                    const bookmark = _converse.bookmarks.findWhere({'jid': this.model.get('jid')});
                    if (bookmark) {
                        return bookmark.get('name');
                    }
                }
                return this.model.get('name');
            }
        });


        _converse.RoomsListView = OrderedListView.extend({
            tagName: 'div',
            className: 'open-rooms-list list-container rooms-list-container',
            events: {
                'click .add-bookmark': 'addBookmark',
                'click .close-room': 'closeRoom',
                'click .list-toggle': 'toggleRoomsList',
                'click .remove-bookmark': 'removeBookmark',
                'click .open-room': 'openRoom',
            },
            listSelector: '.rooms-list',
            ItemView: _converse.RoomsListElementView,
            subviewIndex: 'jid',

            initialize () {
                OrderedListView.prototype.initialize.apply(this, arguments);

                this.listenTo(this.model, 'add', this.showOrHide)
                this.listenTo(this.model, 'remove', this.showOrHide)

                const storage = _converse.config.get('storage'),
                      id = `converse.roomslist${_converse.bare_jid}`;

                this.list_model = new _converse.RoomsList({'id': id});
                this.list_model.browserStorage = new BrowserStorage[storage](id);
                this.list_model.fetch();
                this.render();
                this.sortAndPositionAllItems();
            },

            render () {
                this.el.innerHTML = tpl_rooms_list({
                    'toggle_state': this.list_model.get('toggle-state'),
                    'desc_rooms': __('Click to toggle the list of open groupchats'),
                    // Note to translators, "Open Groupchats" refers to groupchats that are open, NOT a command.
                    'label_rooms': __('Open Groupchats'),
                    '_converse': _converse
                });
                if (this.list_model.get('toggle-state') !== _converse.OPENED) {
                    this.el.querySelector('.open-rooms-list').classList.add('collapsed');
                }
                this.showOrHide();
                this.insertIntoControlBox();
                return this;
            },

            insertIntoControlBox () {
                const controlboxview = _converse.chatboxviews.get('controlbox');
                if (controlboxview !== undefined && !u.rootContains(_converse.root, this.el)) {
                    const el = controlboxview.el.querySelector('.open-rooms-list');
                    if (el !== null) {
                        el.parentNode.replaceChild(this.el, el);
                    }
                }
            },

            hide () {
                u.hideElement(this.el);
            },

            show () {
                u.showElement(this.el);
            },

            async openRoom (ev) {
                ev.preventDefault();
                const name = ev.target.textContent;
                const jid = ev.target.getAttribute('data-room-jid');
                const data = {
                    'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)) || jid
                }
                await _converse.api.rooms.open(jid, data, true);
                _converse.api.chatviews.get(jid).focus();
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

            showOrHide () {
                if (!this.model.models.length) {
                    u.hideElement(this.el);
                } else {
                    u.showElement(this.el);
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
            const storage = _converse.config.get('storage'),
                  id = `converse.open-rooms-{_converse.bare_jid}`,
                  model = new _converse.OpenRooms();

            model.browserStorage = new BrowserStorage[storage](id);
            _converse.rooms_list_view = new _converse.RoomsListView({'model': model});
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

