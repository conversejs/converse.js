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
    const { Backbone, Promise, b64_sha1, sizzle, _ } = converse.env;

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
        optional_dependencies: ["converse-bookmarks"],

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this,
                  { __, ___ } = _converse;

            _converse.RoomsList = Backbone.Model.extend({
                defaults: {
                    "toggle-state":  _converse.OPENED
                }
            });

            _converse.RoomsListView = Backbone.View.extend({
                tagName: 'div',
                className: 'open-rooms-list rooms-list-container',
                events: {
                    'click .add-bookmark': 'addBookmark',
                    'click .close-room': 'closeRoom',
                    'click .open-rooms-toggle': 'toggleRoomsList',
                    'click .remove-bookmark': 'removeBookmark',
                },

                initialize () {
                    this.toggleRoomsList = _.debounce(this.toggleRoomsList, 600, {'leading': true});

                    this.model.on('add', this.renderRoomsListElement, this);
                    this.model.on('change:bookmarked', this.renderRoomsListElement, this);
                    this.model.on('change:name', this.renderRoomsListElement, this);
                    this.model.on('change:num_unread', this.renderRoomsListElement, this);
                    this.model.on('change:num_unread_general', this.renderRoomsListElement, this);
                    this.model.on('remove', this.removeRoomsListElement, this);

                    const cachekey = `converse.roomslist${_converse.bare_jid}`;
                    this.list_model = new _converse.RoomsList();
                    this.list_model.id = cachekey;
                    this.list_model.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                        b64_sha1(cachekey)
                    );
                    this.list_model.fetch();
                    this.render();
                },

                render () {
                    this.el.innerHTML =
                        tpl_rooms_list({
                        'toggle_state': this.list_model.get('toggle-state'),
                        'desc_rooms': __('Click to toggle the rooms list'),
                        'label_rooms': __('Open Rooms')
                    });
                    this.hide();
                    if (this.list_model.get('toggle-state') !== _converse.OPENED) {
                        this.el.querySelector('.open-rooms-list').classList.add('collapsed');
                    }
                    this.model.each(this.renderRoomsListElement.bind(this));
                    const controlboxview = _converse.chatboxviews.get('controlbox');

                    if (!_.isUndefined(controlboxview) &&
                            !document.body.contains(this.el)) {
                        const container = controlboxview.el.querySelector('#chatrooms');
                        if (!_.isNull(container)) {
                            container.insertBefore(this.el, container.firstChild);
                        }
                    }
                    return this.el;
                },

                hide () {
                    this.el.classList.add('hidden');
                },

                show () {
                    this.el.classList.remove('hidden');
                },

                closeRoom (ev) {
                    ev.preventDefault();
                    const name = ev.target.getAttribute('data-room-name');
                    const jid = ev.target.getAttribute('data-room-jid');
                    if (confirm(__(___("Are you sure you want to leave the room \"%1$s\"?"), name))) {
                        _converse.chatboxviews.get(jid).leave();
                    }
                },

                renderRoomsListElement (item) {
                    if (item.get('type') !== 'chatroom') {
                        return;
                    }
                    this.removeRoomsListElement(item);

                    let name, bookmark;
                    if (item.get('bookmarked')) {
                        bookmark = _.head(_converse.bookmarksview.model.where({'jid': item.get('jid')}));
                        name = bookmark.get('name');
                    } else {
                        name = item.get('name');
                    }
                    const div = document.createElement('div');
                    div.innerHTML = tpl_rooms_list_item(_.extend(item.toJSON(), {
                        'allow_bookmarks': _converse.allow_bookmarks,
                        'info_leave_room': __('Leave this room'),
                        'info_remove_bookmark': __('Unbookmark this room'),
                        'info_add_bookmark': __('Bookmark this room'),
                        'info_title': __('Show more information on this room'),
                        'name': name,
                        'open_title': __('Click to open this room')
                    }));
                    this.el.querySelector('.open-rooms-list').appendChild(div.firstChild);
                    this.show();
                },

                removeBookmark: _converse.removeBookmarkViaEvent,
                addBookmark: _converse.addBookmarkViaEvent,

                removeRoomsListElement (item) {
                    const list_el = this.el.querySelector('.open-rooms-list');
                    const el = _.head(sizzle(`.available-chatroom[data-room-jid="${item.get('jid')}"]`, list_el));
                    if (el) {
                        list_el.removeChild(el);
                    }
                    if (list_el.childElementCount === 0) {
                        this.hide();
                    }
                },

                toggleRoomsList (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    const el = ev.target;
                    if (el.classList.contains("icon-opened")) {
                        utils.slideIn(this.el.querySelector('.open-rooms-list')).then(() => {
                            this.list_model.save({'toggle-state': _converse.CLOSED});
                            el.classList.remove("icon-opened");
                            el.classList.add("icon-closed");
                        });
                    } else {
                        utils.slideOut(this.el.querySelector('.open-rooms-list')).then(() => {
                            this.list_model.save({'toggle-state': _converse.OPENED});
                            el.classList.remove("icon-closed");
                            el.classList.add("icon-opened");
                        });
                    }
                }
            });

            const initRoomsListView = function () {
                _converse.rooms_list_view = new _converse.RoomsListView(
                    {'model': _converse.chatboxes}
                );
            };

            Promise.all([
                _converse.api.waitUntil('chatBoxesFetched'),
                _converse.api.waitUntil('roomsPanelRendered')
            ]).then(() => {
                if (_converse.allow_bookmarks) {
                    _converse.api.waitUntil('bookmarksInitialized').then(
                        initRoomsListView
                    );
                } else {
                    initRoomsListView();
                }
            });

            const afterReconnection = function () {
                if (_.isUndefined(_converse.rooms_list_view)) {
                    initRoomsListView();
                } else {
                    _converse.rooms_list_view.render();
                }
            };
            _converse.api.listen.on('reconnected', afterReconnection);
        }
    });
}));
