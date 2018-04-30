// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

/* This is a Converse.js plugin which add support for bookmarks specified
 * in XEP-0048.
 */
(function (root, factory) {
    define(["converse-core",
            "converse-muc",
            "tpl!chatroom_bookmark_form",
            "tpl!chatroom_bookmark_toggle",
            "tpl!bookmark",
            "tpl!bookmarks_list"
        ],
        factory);
}(this, function (
        converse,
        muc,
        tpl_chatroom_bookmark_form,
        tpl_chatroom_bookmark_toggle,
        tpl_bookmark,
        tpl_bookmarks_list
    ) {

    const { Backbone, Promise, Strophe, $iq, b64_sha1, sizzle, _ } = converse.env;
    const u = converse.env.utils;

    converse.plugins.add('converse-bookmarks', {

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
            //
            // New functions which don't exist yet can also be added.

            clearSession () {
                this.__super__.clearSession.apply(this, arguments);
                if (!_.isUndefined(this.bookmarks)) {
                    this.bookmarks.reset();
                    this.bookmarks.browserStorage._clear();
                    window.sessionStorage.removeItem(this.bookmarks.fetched_flag);
                }
            },

            ChatRoomView: {
                events: {
                    'click .toggle-bookmark': 'toggleBookmark'
                },

                initialize () {
                    this.__super__.initialize.apply(this, arguments);
                    this.model.on('change:bookmarked', this.onBookmarked, this);
                    this.setBookmarkState();
                },

                renderBookmarkToggle () {
                    const { _converse } = this.__super__,
                          { __ } = _converse;
                    const bookmark_button = tpl_chatroom_bookmark_toggle(
                        _.assignIn(this.model.toJSON(), {
                            info_toggle_bookmark: __('Bookmark this room'),
                            bookmarked: this.model.get('bookmarked')
                        }));
                    const close_button = this.el.querySelector('.close-chatbox-button');
                    close_button.insertAdjacentHTML('afterend', bookmark_button);
                },

                renderHeading () {
                    this.__super__.renderHeading.apply(this, arguments);
                    const { _converse } = this.__super__;
                    if (_converse.allow_bookmarks) {
                        _converse.checkBookmarksSupport().then((supported) => {
                            if (supported) {
                                this.renderBookmarkToggle();
                            }
                        }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                    }
                },

                checkForReservedNick () {
                    /* Check if the user has a bookmark with a saved nickanme
                     * for this room, and if so use it.
                     * Otherwise delegate to the super method.
                     */
                    const { _converse } = this.__super__;
                    if (_.isUndefined(_converse.bookmarks) || !_converse.allow_bookmarks) {
                        return this.__super__.checkForReservedNick.apply(this, arguments);
                    }
                    const model = _converse.bookmarks.findWhere({'jid': this.model.get('jid')});
                    if (!_.isUndefined(model) && model.get('nick')) {
                        this.join(model.get('nick'));
                    } else {
                        return this.__super__.checkForReservedNick.apply(this, arguments);
                    }
                },

                onBookmarked () {
                    const icon = this.el.querySelector('.toggle-bookmark');
                    if (_.isNull(icon)) {
                        return;
                    }
                    if (this.model.get('bookmarked')) {
                        icon.classList.add('button-on');
                    } else {
                        icon.classList.remove('button-on');
                    }
                },

                setBookmarkState () {
                    /* Set whether the room is bookmarked or not.
                     */
                    const { _converse } = this.__super__;
                    if (!_.isUndefined(_converse.bookmarks)) {
                        const models = _converse.bookmarks.where({'jid': this.model.get('jid')});
                        if (!models.length) {
                            this.model.save('bookmarked', false);
                        } else {
                            this.model.save('bookmarked', true);
                        }
                    }
                },

                renderBookmarkForm () {
                    const { _converse } = this.__super__,
                        { __ } = _converse,
                        body = this.el.querySelector('.chatroom-body');

                    _.each(body.children, function (child) {
                        child.classList.add('hidden');
                    });
                    // Remove any existing forms
                    _.each(body.querySelectorAll('.chatroom-form-container'), u.removeElement);

                    body.insertAdjacentHTML(
                        'beforeend',
                        tpl_chatroom_bookmark_form({
                            heading: __('Bookmark this room'),
                            label_name: __('The name for this bookmark:'),
                            label_autojoin: __('Would you like this room to be automatically joined upon startup?'),
                            label_nick: __('What should your nickname for this room be?'),
                            default_nick: this.model.get('nick'),
                            label_submit: __('Save'),
                            label_cancel: __('Cancel')
                        })
                    );
                    const form = body.querySelector('form.chatroom-form');
                    form.addEventListener(
                        'submit',
                        this.onBookmarkFormSubmitted.bind(this)
                    );
                    form.querySelector('.button-cancel').addEventListener(
                        'click',
                        this.closeForm.bind(this)
                    );
                },

                onBookmarkFormSubmitted (ev) {
                    ev.preventDefault();
                    const { _converse } = this.__super__;
                    _converse.bookmarks.createBookmark({
                        'jid': this.model.get('jid'),
                        'autojoin': _.get(ev.target.querySelector('input[name="autojoin"]'), 'checked') || false,
                        'name':  _.get(ev.target.querySelector('input[name=name]'), 'value'),
                        'nick':  _.get(ev.target.querySelector('input[name=nick]'), 'value')
                    });
                    u.removeElement(this.el.querySelector('div.chatroom-form-container'));
                    this.renderAfterTransition();
                },

                toggleBookmark (ev) {
                    if (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                    }
                    const { _converse } = this.__super__;
                    const models = _converse.bookmarks.where({'jid': this.model.get('jid')});
                    if (!models.length) {
                        this.renderBookmarkForm();
                    } else {
                        _.forEach(models, function (model) {
                            model.destroy();
                        });
                        this.el.querySelector('.toggle-bookmark').classList.remove('button-on');
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
                allow_bookmarks: true,
                allow_public_bookmarks: false,
                hide_open_bookmarks: true
            });
            // Promises exposed by this plugin
            _converse.api.promises.add('bookmarksInitialized');

            // Pure functions on the _converse object
            _.extend(_converse, {
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
                    const chatroom = _converse.api.rooms.open(jid, {'bring_to_foreground': true});
                    _converse.chatboxviews.get(jid).renderBookmarkForm();
                },
            });

            _converse.Bookmark = Backbone.Model;

            _converse.Bookmarks = Backbone.Collection.extend({
                model: _converse.Bookmark,
                comparator: 'name',

                initialize () {
                    this.on('add', _.flow(this.openBookmarkedRoom, this.markRoomAsBookmarked));
                    this.on('remove', this.markRoomAsUnbookmarked, this);
                    this.on('remove', this.sendBookmarkStanza, this);

                    const cache_key = `converse.room-bookmarks${_converse.bare_jid}`;
                    this.fetched_flag = b64_sha1(cache_key+'fetched');
                    this.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                        b64_sha1(cache_key)
                    );
                },

                openBookmarkedRoom (bookmark) {
                    if (bookmark.get('autojoin')) {
                        const room = _converse.api.rooms.create(bookmark.get('jid'), bookmark.get('nick'));
                        if (!room.get('hidden')) {
                            room.trigger('show');
                        }
                    }
                    return bookmark;
                },

                fetchBookmarks () {
                    const deferred = u.getResolveablePromise();
                    if (this.browserStorage.records.length > 0) {
                        this.fetch({
                            'success': _.bind(this.onCachedBookmarksFetched, this, deferred),
                            'error':  _.bind(this.onCachedBookmarksFetched, this, deferred)
                        });
                    } else if (! window.sessionStorage.getItem(this.fetched_flag)) {
                        // There aren't any cached bookmarks and the
                        // `fetched_flag` is off, so we query the XMPP server.
                        // If nothing is returned from the XMPP server, we set
                        // the `fetched_flag` to avoid calling the server again.
                        this.fetchBookmarksFromServer(deferred);
                    } else {
                        deferred.resolve();
                    }
                    return deferred;
                },

                onCachedBookmarksFetched (deferred) {
                    return deferred.resolve();
                },

                createBookmark (options) {
                    _converse.bookmarks.create(options);
                    _converse.bookmarks.sendBookmarkStanza();
                },

                sendBookmarkStanza () {
                    let stanza = $iq({
                            'type': 'set',
                            'from': _converse.connection.jid,
                        })
                        .c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                            .c('publish', {'node': 'storage:bookmarks'})
                                .c('item', {'id': 'current'})
                                    .c('storage', {'xmlns':'storage:bookmarks'});
                    this.each(function (model) {
                        stanza = stanza.c('conference', {
                            'name': model.get('name'),
                            'autojoin': model.get('autojoin'),
                            'jid': model.get('jid'),
                        }).c('nick').t(model.get('nick')).up().up();
                    });
                    stanza.up().up().up();
                    stanza.c('publish-options')
                        .c('x', {'xmlns': Strophe.NS.XFORM, 'type':'submit'})
                            .c('field', {'var':'FORM_TYPE', 'type':'hidden'})
                                .c('value').t('http://jabber.org/protocol/pubsub#publish-options').up().up()
                            .c('field', {'var':'pubsub#persist_items'})
                                .c('value').t('true').up().up()
                            .c('field', {'var':'pubsub#access_model'})
                                .c('value').t('whitelist');
                    _converse.connection.sendIQ(stanza, null, this.onBookmarkError.bind(this));
                },

                onBookmarkError (iq) {
                    _converse.log("Error while trying to add bookmark", Strophe.LogLevel.ERROR);
                    _converse.log(iq);
                    // We remove all locally cached bookmarks and fetch them
                    // again from the server.
                    this.reset();
                    this.fetchBookmarksFromServer(null);
                    window.alert(__("Sorry, something went wrong while trying to save your bookmark."));
                },

                fetchBookmarksFromServer (deferred) {
                    const stanza = $iq({
                        'from': _converse.connection.jid,
                        'type': 'get',
                    }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                        .c('items', {'node': 'storage:bookmarks'});
                    _converse.connection.sendIQ(
                        stanza,
                        _.bind(this.onBookmarksReceived, this, deferred),
                        _.bind(this.onBookmarksReceivedError, this, deferred)
                    );
                },

                markRoomAsBookmarked (bookmark) {
                    const room = _converse.chatboxes.get(bookmark.get('jid'));
                    if (!_.isUndefined(room)) {
                        room.save('bookmarked', true);
                    }
                },

                markRoomAsUnbookmarked (bookmark) {
                    const room = _converse.chatboxes.get(bookmark.get('jid'));
                    if (!_.isUndefined(room)) {
                        room.save('bookmarked', false);
                    }
                },

                createBookmarksFromStanza (stanza) {
                    const bookmarks = sizzle(
                        'items[node="storage:bookmarks"] '+
                        'item#current '+
                        'storage[xmlns="storage:bookmarks"] '+
                        'conference',
                        stanza
                    )
                    _.forEach(bookmarks, (bookmark) => {
                        this.create({
                            'jid': bookmark.getAttribute('jid'),
                            'name': bookmark.getAttribute('name'),
                            'autojoin': bookmark.getAttribute('autojoin') === 'true',
                            'nick': _.get(bookmark.querySelector('nick'), 'textContent')
                        });
                    });
                },

                onBookmarksReceived (deferred, iq) {
                    this.createBookmarksFromStanza(iq);
                    if (!_.isUndefined(deferred)) {
                        return deferred.resolve();
                    }
                },

                onBookmarksReceivedError (deferred, iq) {
                    window.sessionStorage.setItem(this.fetched_flag, true);
                    _converse.log('Error while fetching bookmarks', Strophe.LogLevel.WARN);
                    _converse.log(iq.outerHTML, Strophe.LogLevel.DEBUG);
                    if (!_.isNil(deferred)) {
                        if (iq.querySelector('error[type="cancel"] item-not-found')) {
                            // Not an exception, the user simply doesn't have
                            // any bookmarks.
                            return deferred.resolve();
                        } else {
                            return deferred.reject(new Error("Could not fetch bookmarks"));
                        }
                    }
                }
            });

            _converse.BookmarksList = Backbone.Model.extend({
                defaults: {
                    "toggle-state":  _converse.OPENED
                }
            });

            _converse.BookmarkView = Backbone.VDOMView.extend({
                toHTML () {
                    return tpl_bookmark({
                        'hidden': _converse.hide_open_bookmarks &&
                                  _converse.chatboxes.where({'jid': this.model.get('jid')}).length,
                        'bookmarked': true,
                        'info_leave_room': __('Leave this room'),
                        'info_remove': __('Remove this bookmark'),
                        'info_remove_bookmark': __('Unbookmark this room'),
                        'info_title': __('Show more information on this room'),
                        'jid': this.model.get('jid'),
                        'name': Strophe.xmlunescape(this.model.get('name')),
                        'open_title': __('Click to open this room')
                    });
                }
            });

            _converse.BookmarksView = Backbone.OrderedListView.extend({
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
                    Backbone.OrderedListView.prototype.initialize.apply(this, arguments);

                    this.model.on('add', this.showOrHide, this);
                    this.model.on('remove', this.showOrHide, this);

                    _converse.chatboxes.on('add', this.renderBookmarkListElement, this);
                    _converse.chatboxes.on('remove', this.renderBookmarkListElement, this);

                    const cachekey = `converse.room-bookmarks${_converse.bare_jid}-list-model`;
                    this.list_model = new _converse.BookmarksList();
                    this.list_model.id = cachekey;
                    this.list_model.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                        b64_sha1(cachekey)
                    );
                    this.list_model.fetch();
                    this.render();
                    this.sortAndPositionAllItems();
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
                    if (!_.isUndefined(controlboxview) &&
                            !_converse.root.contains(this.el)) {
                        const el = controlboxview.el.querySelector('.bookmarks-list');
                        if (!_.isNull(el)) {
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
                    _converse.api.rooms.open(jid, data);
                },

                removeBookmark: _converse.removeBookmarkViaEvent,
                addBookmark: _converse.addBookmarkViaEvent,

                renderBookmarkListElement (chatbox) {
                    const bookmarkview = this.get(chatbox.get('jid'));
                    if (_.isNil(bookmarkview)) {
                        // A chat box has been closed, but we don't have a
                        // bookmark for it, so nothing further to do here.
                        return;
                    }
                    bookmarkview.render();
                    this.showOrHide();
                },

                showOrHide (item) {
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
                    const icon_el = ev.target.querySelector('.fa');
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

            _converse.checkBookmarksSupport = function () {
                return new Promise((resolve, reject) => {
                    Promise.all([
                        _converse.api.disco.getIdentity('pubsub', 'pep', _converse.bare_jid),
                        _converse.api.disco.supports(Strophe.NS.PUBSUB+'#publish-options', _converse.bare_jid)
                    ]).then((args) => {
                        resolve(args[0] && (args[1].length || _converse.allow_public_bookmarks));
                    }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
            }

            const initBookmarks = function () {
                if (!_converse.allow_bookmarks) {
                    return;
                }
                _converse.checkBookmarksSupport().then((supported) => {
                    if (supported) {
                        _converse.bookmarks = new _converse.Bookmarks();
                        _converse.bookmarksview = new _converse.BookmarksView({'model': _converse.bookmarks});
                        _converse.bookmarks.fetchBookmarks()
                            .catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL))
                            .then(() => _converse.emit('bookmarksInitialized'));
                    } else {
                        _converse.emit('bookmarksInitialized');
                    }
                });
            }

            u.onMultipleEvents([
                    {'object': _converse, 'event': 'chatBoxesFetched'},
                    {'object': _converse, 'event': 'roomsPanelRendered'}
                ], initBookmarks);

            _converse.on('reconnected', initBookmarks);

            _converse.on('connected', () => {
                // Add a handler for bookmarks pushed from other connected clients
                // (from the same user obviously)
                _converse.connection.addHandler((message) => {
                    if (message.querySelector('event[xmlns="'+Strophe.NS.PUBSUB+'#event"]')) {
                        _converse.bookmarks.createBookmarksFromStanza(message);
                    }
                }, null, 'message', 'headline', null, _converse.bare_jid);
            });

        }
    });
}));
