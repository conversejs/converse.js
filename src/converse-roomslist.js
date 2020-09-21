/**
 * @module converse-roomslist
 * @description
 *  Converse.js plugin which shows a list of currently open
 *  rooms in the "Rooms Panel" of the ControlBox.
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "@converse/headless/converse-muc";
import RoomDetailsModal from 'modals/muc-details.js';
import { _converse, api, converse } from "@converse/headless/converse-core";
import tpl_rooms_list from "templates/rooms_list.js";
import { Model } from '@converse/skeletor/src/model.js';
import { View } from '@converse/skeletor/src/view.js';
import { __ } from './i18n';


const { Strophe } = converse.env;
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

        // Promises exposed by this plugin
        api.promises.add('roomsListInitialized');


        _converse.RoomsList = Model.extend({
            defaults: {
                "toggle-state":  _converse.OPENED
            }
        });


        _converse.RoomsListView = View.extend({
            tagName: 'span',

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
                    '_converse': _converse,
                    'addBookmark': ev => this.addBookmark(ev),
                    'allow_bookmarks': _converse.allow_bookmarks && _converse.bookmarks,
                    'closeRoom': ev => this.closeRoom(ev),
                    'collapsed': this.list_model.get('toggle-state') !== _converse.OPENED,
                    'currently_open': room => _converse.isUniView() && !room.get('hidden'),
                    'openRoom': ev => this.openRoom(ev),
                    'removeBookmark': ev => this.removeBookmark(ev),
                    'rooms': this.model.filter(m => m.get('type') === _converse.CHATROOMS_TYPE),
                    'showRoomDetailsModal': ev => this.showRoomDetailsModal(ev),
                    'toggleRoomsList': ev => this.toggleRoomsList(ev),
                    'toggle_state': this.list_model.get('toggle-state')
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
                    room.room_details_modal = new RoomDetailsModal({'model': room});
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
                await api.rooms.open(jid, data, true);
                api.chatviews.get(jid).maybeFocus();
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
            api.trigger('roomsListInitialized');
        };

        api.listen.on('connected', async () =>  {
            if (_converse.allow_bookmarks) {
                await api.waitUntil('bookmarksInitialized');
            } else {
                await Promise.all([
                    api.waitUntil('chatBoxesFetched'),
                    api.waitUntil('roomsPanelRendered')
                ]);
            }
            initRoomsListView();
        });

        api.listen.on('reconnected', initRoomsListView);
    }
});

