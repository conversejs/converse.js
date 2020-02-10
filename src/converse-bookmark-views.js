/**
 * @module converse-bookmark-views
 * @description Converse.js plugin which adds views for XEP-0048 bookmarks
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "@converse/headless/converse-muc";
import { Model } from 'skeletor.js/src/model.js';
import { View } from 'skeletor.js/src/view.js';
import { __ } from '@converse/headless/i18n';
import converse from "@converse/headless/converse-core";
import tpl_bookmarks_list from "templates/bookmarks_list.js"
import tpl_muc_bookmark_form from "templates/muc_bookmark_form.js";
import tpl_chatroom_bookmark_toggle from "templates/chatroom_bookmark_toggle.html";

const { Strophe, _ } = converse.env;
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
            getHeadingButtons () {
                const { _converse } = this.__super__;
                const buttons = this.__super__.getHeadingButtons.call(this);
                if (_converse.allow_bookmarks) {
                    const supported = _converse.checkBookmarksSupport();
                    const bookmarked = this.model.get('bookmarked');
                    const data = {
                        'i18n_title': this.model.get('bookmarked') ? __('Unbookmark') : __('Bookmark'),
                        'handler': ev => this.toggleBookmark(ev),
                        'icon_class': 'fa-bookmark',
                        'name': 'bookmark'
                    }
                    const names = buttons.map(t => t.name);
                    const idx = names.indexOf('configure');
                    const data_promise = supported.then(s => s ? data : '');
                    return idx > -1 ? [...buttons.slice(0, idx), data_promise, ...buttons.slice(idx)] : [data_promise, ...buttons];
                }
                return buttons;
            }
        }
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;

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
                    _.invokeMap(_converse.bookmarks.where({'jid': jid}), Model.prototype.destroy);
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
            /**
             * Set whether the groupchat is bookmarked or not.
             * @private
             */
            setBookmarkState () {
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


        _converse.MUCBookmarkForm = View.extend({
            className: 'muc-bookmark-form chatroom-form-container',

            initialize (attrs) {
                this.chatroomview = attrs.chatroomview;
                this.render();
            },

            toHTML () {
                return tpl_muc_bookmark_form(Object.assign(
                    this.model.toJSON(), {
                        'onCancel': ev => this.closeBookmarkForm(ev),
                        'onSubmit': ev => this.onBookmarkFormSubmitted(ev)
                    }
                ));
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


        _converse.BookmarksView = View.extend({
            tagName: 'span',

            initialize () {
                this.listenTo(this.model, 'add', this.render);
                this.listenTo(this.model, 'remove', this.render);

                this.listenTo(_converse.chatboxes, 'add', this.render);
                this.listenTo(_converse.chatboxes, 'remove', this.render);

                const id = `converse.room-bookmarks${_converse.bare_jid}-list-model`;
                this.list_model = new _converse.BookmarksList({id});
                this.list_model.browserStorage = _converse.createStore(id);

                const render = () => {
                    this.render();
                    this.insertIntoControlBox();
                }
                this.list_model.fetch({'success': render, 'error': render});
            },

            toHTML () {
                const is_hidden = b => !!(_converse.hide_open_bookmarks && _converse.chatboxes.get(b.get('jid')));
                return tpl_bookmarks_list({
                    '_converse': _converse,
                    'bookmarks': this.model,
                    'hidden': this.model.getUnopenedBookmarks().length && true,
                    'is_hidden': is_hidden,
                    'openRoom': ev => this.openRoom(ev),
                    'removeBookmark': ev => this.removeBookmark(ev),
                    'toggleBookmarksList': ev => this.toggleBookmarksList(ev),
                    'toggle_state': this.list_model.get('toggle-state')
                });
            },

            insertIntoControlBox () {
                const controlboxview = _converse.chatboxviews.get('controlbox');
                if (controlboxview !== undefined && !u.rootContains(_converse.root, this.el)) {
                    const el = controlboxview.el.querySelector('.list-container--bookmarks');
                    el && el.parentNode.replaceChild(this.el, el);
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
        _converse.api.listen.on('chatRoomViewInitialized', view => view.setBookmarkState());
        /************************ END Event Handlers ************************/
    }
});
