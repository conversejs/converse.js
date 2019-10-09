// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// Copyright (c) 2019, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/**
 * @module converse-bookmark-views
 * @description
 * Converse.js plugin which adds views for XEP-0048 bookmarks
 */
import "backbone.nativeview";
import "@converse/headless/converse-muc";
import BrowserStorage from "backbone.browserStorage";
import { OrderedListView } from "backbone.overview";
import converse from "@converse/headless/converse-core";
import tpl_bookmark from "templates/bookmark.html";
import tpl_bookmarks_list from "templates/bookmarks_list.html"
import tpl_chatroom_bookmark_form from "templates/chatroom_bookmark_form.html";
import tpl_chatroom_bookmark_toggle from "templates/chatroom_bookmark_toggle.html";

const { Backbone, Strophe, _ } = converse.env;
const u = converse.env.utils;


converse.plugins.add('converse-bookmark-views', {

    /* Plugin dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin.
     *
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found. By default it's
     * false, which means these plugins are only loaded opportunistically.
     *
     * NB: These plugins need to have already been loaded via require.js.
     */
    dependencies: ["converse-chatboxes", "converse-muc", "converse-muc-views"],

    overrides: {
        // Overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        ChatRoomView: {
            events: {
                'click .toggle-bookmark': 'toggleBookmark'
            },
            async renderHeading () {
                this.__super__.renderHeading.apply(this, arguments);
                const { _converse } = this.__super__;
                if (_converse.allow_bookmarks) {
                    const supported = await _converse.checkBookmarksSupport();
                    if (supported) {
                        this.renderBookmarkToggle();
                    }
                }
            }
        }
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this,
              { __ } = _converse;

        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        _converse.api.settings.update({
            hide_open_bookmarks: true,
            muc_respect_autojoin: true
        });


        Object.assign(_converse, {

            removeBookmarkViaEvent (ev) {
                /* Remove a bookmark as determined by the passed in
                 * event.
                 */
                ev.preventDefault();
                const name = ev.target.getAttribute('data-bookmark-name');
                const jid = ev.target.getAttribute('data-room-jid');
                if (confirm(__("Are you sure you want to remove the bookmark \"%1$s\"?", name))) {
                    _.invokeMap(_converse.bookmarks.where({'jid': jid}), Backbone.Model.prototype.destroy);
                }
            },

            addBookmarkViaEvent (ev) {
                /* Add a bookmark as determined by the passed in
                 * event.
                 */
                ev.preventDefault();
                const jid = ev.target.getAttribute('data-room-jid');
                _converse.api.rooms.open(jid, {'bring_to_foreground': true});
                _converse.chatboxviews.get(jid).renderBookmarkForm();
            },
        });

        const bookmarkableChatRoomView = {

            renderBookmarkToggle () {
                if (this.el.querySelector('.chat-head .toggle-bookmark')) {
                    return;
                }
                const { _converse } = this.__super__,
                      { __ } = _converse;

                const bookmark_button = tpl_chatroom_bookmark_toggle(
                    _.assignIn(this.model.toJSON(), {
                        'info_toggle_bookmark': this.model.get('bookmarked') ?
                            __('Unbookmark this groupchat') :
                            __('Bookmark this groupchat'),
                        'bookmarked': this.model.get('bookmarked')
                    }));

                const buttons_row = this.el.querySelector('.chatbox-buttons')
                const close_button = buttons_row.querySelector('.close-chatbox-button');
                if (close_button) {
                    close_button.insertAdjacentHTML('afterend', bookmark_button);
                } else {
                    buttons_row.insertAdjacentHTML('beforeEnd', bookmark_button);
                }
            },

            setBookmarkState () {
                /* Set whether the groupchat is bookmarked or not.
                 */
                if (_converse.bookmarks !== undefined) {
                    const models = _converse.bookmarks.where({'jid': this.model.get('jid')});
                    if (!models.length) {
                        this.model.save('bookmarked', false);
                    } else {
                        this.model.save('bookmarked', true);
                    }
                }
            },

            renderBookmarkForm () {
                this.hideChatRoomContents();
                if (!this.bookmark_form) {
                    this.bookmark_form = new _converse.MUCBookmarkForm({
                        'model': this.model,
                        'chatroomview': this
                    });
                    const container_el = this.el.querySelector('.chatroom-body');
                    container_el.insertAdjacentElement('beforeend', this.bookmark_form.el);
                }
                u.showElement(this.bookmark_form.el);
            },

            toggleBookmark (ev) {
                if (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                const models = _converse.bookmarks.where({'jid': this.model.get('jid')});
                if (!models.length) {
                    this.renderBookmarkForm();
                } else {
                    models.forEach(model => model.destroy());
                }
            }
        }
        Object.assign(_converse.ChatRoomView.prototype, bookmarkableChatRoomView);


        _converse.MUCBookmarkForm = Backbone.VDOMView.extend({
            className: 'muc-bookmark-form',

            events: {
                'submit form': 'onBookmarkFormSubmitted',
                'click .button-cancel': 'closeBookmarkForm'
            },

            initialize (attrs) {
                this.chatroomview = attrs.chatroomview;
                this.render();
            },

            toHTML () {
                return tpl_chatroom_bookmark_form({
                    'default_nick': this.model.get('nick'),
                    'heading': __('Bookmark this groupchat'),
                    'label_autojoin': __('Would you like this groupchat to be automatically joined upon startup?'),
                    'label_cancel': __('Cancel'),
                    'label_name': __('The name for this bookmark:'),
                    'label_nick': __('What should your nickname for this groupchat be?'),
                    'label_submit': __('Save'),
                    'name': this.model.get('name')
                });
            },

            onBookmarkFormSubmitted (ev) {
                ev.preventDefault();
                _converse.bookmarks.createBookmark({
                    'jid': this.model.get('jid'),
                    'autojoin': _.get(ev.target.querySelector('input[name="autojoin"]'), 'checked') || false,
                    'name':  _.get(ev.target.querySelector('input[name=name]'), 'value'),
                    'nick':  _.get(ev.target.querySelector('input[name=nick]'), 'value')
                });
                this.closeBookmarkForm(ev);
            },

            closeBookmarkForm (ev) {
                ev.preventDefault();
                this.chatroomview.closeForm();
            }
        });


        _converse.BookmarkView = Backbone.VDOMView.extend({
            toHTML () {
                return tpl_bookmark({
                    'hidden': _converse.hide_open_bookmarks &&
                              _converse.chatboxes.where({'jid': this.model.get('jid')}).length,
                    'bookmarked': true,
                    'info_leave_room': __('Leave this groupchat'),
                    'info_remove': __('Remove this bookmark'),
                    'info_remove_bookmark': __('Unbookmark this groupchat'),
                    'info_title': __('Show more information on this groupchat'),
                    'jid': this.model.get('jid'),
                    'name': Strophe.xmlunescape(this.model.get('name')),
                    'open_title': __('Click to open this groupchat')
                });
            }
        });


        _converse.BookmarksView = OrderedListView.extend({
            tagName: 'div',
            className: 'bookmarks-list list-container rooms-list-container',
            events: {
                'click .add-bookmark': 'addBookmark',
                'click .bookmarks-toggle': 'toggleBookmarksList',
                'click .remove-bookmark': 'removeBookmark',
                'click .open-room': 'openRoom',
            },
            listSelector: '.rooms-list',
            ItemView: _converse.BookmarkView,
            subviewIndex: 'jid',

            initialize () {
                OrderedListView.prototype.initialize.apply(this, arguments);

                this.listenTo(this.model, 'add', this.showOrHide);
                this.listenTo(this.model, 'remove', this.showOrHide);

                this.listenTo(_converse.chatboxes, 'add', this.renderBookmarkListElement);
                this.listenTo(_converse.chatboxes, 'remove', this.renderBookmarkListElement);

                const storage = _converse.config.get('storage'),
                      id = `converse.room-bookmarks${_converse.bare_jid}-list-model`;
                this.list_model = new _converse.BookmarksList({'id': id});
                this.list_model.browserStorage = new BrowserStorage[storage](id);

                const render = () => {
                    this.render();
                    this.sortAndPositionAllItems();
                }
                this.list_model.fetch({'success': render, 'error': render});
            },

            render () {
                this.el.innerHTML = tpl_bookmarks_list({
                    'toggle_state': this.list_model.get('toggle-state'),
                    'desc_bookmarks': __('Click to toggle the bookmarks list'),
                    'label_bookmarks': __('Bookmarks'),
                    '_converse': _converse
                });
                this.showOrHide();
                this.insertIntoControlBox();
                return this;
            },

            insertIntoControlBox () {
                const controlboxview = _converse.chatboxviews.get('controlbox');
                if (controlboxview !== undefined && !u.rootContains(_converse.root, this.el)) {
                    const el = controlboxview.el.querySelector('.bookmarks-list');
                    if (el !== null) {
                        el.parentNode.replaceChild(this.el, el);
                    }
                }
            },

            openRoom (ev) {
                ev.preventDefault();
                const name = ev.target.textContent;
                const jid = ev.target.getAttribute('data-room-jid');
                const data = {
                    'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)) || jid
                }
                _converse.api.rooms.open(jid, data, true);
            },

            removeBookmark: _converse.removeBookmarkViaEvent,
            addBookmark: _converse.addBookmarkViaEvent,

            renderBookmarkListElement (chatbox) {
                const bookmarkview = this.get(chatbox.get('jid'));
                if (bookmarkview) {
                    bookmarkview.render();
                    this.showOrHide();
                }
            },

            showOrHide () {
                if (_converse.hide_open_bookmarks) {
                    const bookmarks = this.model.filter((bookmark) =>
                            !_converse.chatboxes.get(bookmark.get('jid')));
                    if (!bookmarks.length) {
                        u.hideElement(this.el);
                        return;
                    }
                }
                if (this.model.models.length) {
                    u.showElement(this.el);
                }
            },

            toggleBookmarksList (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                const icon_el = ev.target.matches('.fa') ? ev.target : ev.target.querySelector('.fa');
                if (u.hasClass('fa-caret-down', icon_el)) {
                    u.slideIn(this.el.querySelector('.bookmarks'));
                    this.list_model.save({'toggle-state': _converse.CLOSED});
                    icon_el.classList.remove("fa-caret-down");
                    icon_el.classList.add("fa-caret-right");
                } else {
                    icon_el.classList.remove("fa-caret-right");
                    icon_el.classList.add("fa-caret-down");
                    u.slideOut(this.el.querySelector('.bookmarks'));
                    this.list_model.save({'toggle-state': _converse.OPENED});
                }
            }
        });

        /************************ BEGIN Event Handlers ************************/
        const initBookmarkViews = async function () {
            await _converse.api.waitUntil('roomsPanelRendered');
            _converse.bookmarksview = new _converse.BookmarksView({'model': _converse.bookmarks});
            /**
             * Triggered once the _converse.Bookmarks collection and _converse.BookmarksView view
             * has been created and cached bookmarks have been fetched.
             * @event _converse#bookmarkViewsInitialized
             * @example _converse.api.listen.on('bookmarkViewsInitialized', () => { ... });
             */
            _converse.api.trigger('bookmarkViewsInitialized');
        }

        _converse.api.listen.on('bookmarksInitialized', initBookmarkViews);

        _converse.api.listen.on('chatRoomOpened', view => view.setBookmarkState());
        /************************ END Event Handlers ************************/
    }
});
