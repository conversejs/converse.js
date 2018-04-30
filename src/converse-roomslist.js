// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

/* This is a non-core Converse.js plugin which shows a list of currently open
 * rooms in the "Rooms Panel" of the ControlBox.
 */
(function (root, factory) {
    define(["utils",
            "converse-core",
            "converse-muc",
            "tpl!rooms_list",
            "tpl!rooms_list_item"
        ], factory);
}(this, function (utils, converse, muc, tpl_rooms_list, tpl_rooms_list_item) {
    const { Backbone, Promise, Strophe, b64_sha1, sizzle, _ } = converse.env;
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
        dependencies: ["converse-controlbox", "converse-muc", "converse-bookmarks"],

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this,
                  { __ } = _converse;


            _converse.OpenRooms = Backbone.Collection.extend({
                comparator (room) {
                    if (room.get('bookmarked')) {
                        const bookmark = _.head(_converse.bookmarksview.model.where({'jid': room.get('jid')}));
                        return bookmark.get('name');
                    } else {
                        return room.get('name');
                    }
                },

                initialize () {
                    this.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                        b64_sha1(`converse.open-rooms-{_converse.bare_jid}`));
                    _converse.chatboxes.on('add', this.onChatBoxAdded, this);
                    _converse.chatboxes.on('change:bookmarked', this.onChatBoxChanged, this);
                    _converse.chatboxes.on('change:name', this.onChatBoxChanged, this);
                    _converse.chatboxes.on('change:num_unread', this.onChatBoxChanged, this);
                    _converse.chatboxes.on('change:num_unread_general', this.onChatBoxChanged, this);
                    _converse.chatboxes.on('remove', this.onChatBoxRemoved, this);
                    this.reset(_.map(_converse.chatboxes.where({'type': 'chatroom'}), 'attributes'));
                },

                onChatBoxAdded (item) {
                    if (item.get('type') === 'chatroom') {
                        this.create(item.attributes);
                    }
                },

                onChatBoxChanged (item) {
                    if (item.get('type') === 'chatroom') {
                        const room =  this.get(item.get('jid'));
                        if (!_.isNil(room)) {
                            room.set(item.attributes);
                        }
                    }
                },

                onChatBoxRemoved (item) {
                    if (item.get('type') === 'chatroom') {
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
                initialize () {
                    this.model.on('destroy', this.remove, this);
                    this.model.on('remove', this.remove, this);
                    this.model.on('change:bookmarked', this.render, this);
                    this.model.on('change:name', this.render, this);
                    this.model.on('change:num_unread', this.render, this);
                    this.model.on('change:num_unread_general', this.render, this);
                },

                getRoomsListElementName () {
                    if (this.model.get('bookmarked') && _converse.bookmarksview) {
                        const bookmark = _.head(_converse.bookmarksview.model.where({'jid': this.model.get('jid')}));
                        return bookmark.get('name');
                    } else {
                        return this.model.get('name');
                    }
                },

                toHTML () {
                    return tpl_rooms_list_item(
                        _.extend(this.model.toJSON(), {
                            // XXX: By the time this renders, the _converse.bookmarks
                            // collection should already exist if bookmarks are
                            // supported by the XMPP server. So we can use it
                            // as a check for support (other ways of checking are async).
                            'allow_bookmarks': _converse.allow_bookmarks && _converse.bookmarks,
                            'info_leave_room': __('Leave this room'),
                            'info_remove_bookmark': __('Unbookmark this room'),
                            'info_add_bookmark': __('Bookmark this room'),
                            'info_title': __('Show more information on this room'),
                            'name': this.getRoomsListElementName(),
                            'open_title': __('Click to open this room')
                        }));
                }
            });

            _converse.RoomsListView = Backbone.OrderedListView.extend({
                tagName: 'div',
                className: 'open-rooms-list list-container rooms-list-container',
                events: {
                    'click .add-bookmark': 'addBookmark',
                    'click .close-room': 'closeRoom',
                    'click .rooms-toggle': 'toggleRoomsList',
                    'click .remove-bookmark': 'removeBookmark',
                    'click .open-room': 'openRoom',
                },
                listSelector: '.rooms-list',
                ItemView: _converse.RoomsListElementView,
                subviewIndex: 'jid',

                initialize () {
                    Backbone.OrderedListView.prototype.initialize.apply(this, arguments);

                    this.model.on('add', this.showOrHide, this);
                    this.model.on('remove', this.showOrHide, this);

                    const cachekey = `converse.roomslist${_converse.bare_jid}`;
                    this.list_model = new _converse.RoomsList();
                    this.list_model.id = cachekey;
                    this.list_model.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                        b64_sha1(cachekey)
                    );
                    this.list_model.fetch();
                    this.render();
                    this.sortAndPositionAllItems();
                },

                render () {
                    this.el.innerHTML = tpl_rooms_list({
                        'toggle_state': this.list_model.get('toggle-state'),
                        'desc_rooms': __('Click to toggle the rooms list'),
                        'label_rooms': __('Open Rooms'),
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
                    if (!_.isUndefined(controlboxview) &&
                            !_converse.root.contains(this.el)) {
                        const el = controlboxview.el.querySelector('.open-rooms-list');
                        if (!_.isNull(el)) {
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

                openRoom (ev) {
                    ev.preventDefault();
                    const name = ev.target.textContent;
                    const jid = ev.target.getAttribute('data-room-jid');
                    const data = {
                        'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)) || jid
                    }
                    _converse.api.rooms.open(jid, data);
                },

                closeRoom (ev) {
                    ev.preventDefault();
                    const name = ev.target.getAttribute('data-room-name');
                    const jid = ev.target.getAttribute('data-room-jid');
                    if (confirm(__("Are you sure you want to leave the room %1$s?", name))) {
                        // TODO: replace with API call
                        _converse.chatboxviews.get(jid).close();
                    }
                },

                showOrHide (item) {
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
                    const icon_el = ev.target.querySelector('.fa');
                    if (icon_el.classList.contains("fa-caret-down")) {
                        utils.slideIn(this.el.querySelector('.open-rooms-list')).then(() => {
                            this.list_model.save({'toggle-state': _converse.CLOSED});
                            icon_el.classList.remove("fa-caret-down");
                            icon_el.classList.add("fa-caret-right");
                        });
                    } else {
                        utils.slideOut(this.el.querySelector('.open-rooms-list')).then(() => {
                            this.list_model.save({'toggle-state': _converse.OPENED});
                            icon_el.classList.remove("fa-caret-right");
                            icon_el.classList.add("fa-caret-down");
                        });
                    }
                }
            });

            const initRoomsListView = function () {
                _converse.rooms_list_view = new _converse.RoomsListView(
                    {'model': new _converse.OpenRooms()  }
                );
            };

            if (_converse.allow_bookmarks) {
                u.onMultipleEvents([
                        {'object': _converse, 'event': 'chatBoxesFetched'},
                        {'object': _converse, 'event': 'roomsPanelRendered'},
                        {'object': _converse, 'event': 'bookmarksInitialized'}
                    ], initRoomsListView);
            } else {
                u.onMultipleEvents([
                        {'object': _converse, 'event': 'chatBoxesFetched'},
                        {'object': _converse, 'event': 'roomsPanelRendered'}
                    ], initRoomsListView);
            }

            _converse.api.listen.on('reconnected', initRoomsListView);
        }
    });
}));
