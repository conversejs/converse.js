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
    define(["jquery.noconflict",
            "utils",
            "converse-core",
            "converse-muc",
            "tpl!chatroom_bookmark_form",
            "tpl!chatroom_bookmark_toggle",
            "tpl!bookmark",
            "tpl!bookmarks_list"
        ],
        factory);
}(this, function (
        $,
        utils,
        converse,
        muc,
        tpl_chatroom_bookmark_form,
        tpl_chatroom_bookmark_toggle,
        tpl_bookmark,
        tpl_bookmarks_list
    ) {

    const { Backbone, Promise, Strophe, $iq, b64_sha1, sizzle, _ } = converse.env;

    converse.plugins.add('converse-bookmarks', {
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

                generateHeadingHTML () {
                    const { _converse } = this.__super__,
                        { __ } = _converse,
                        html = this.__super__.generateHeadingHTML.apply(this, arguments);
                    if (_converse.allow_bookmarks) {
                        const div = document.createElement('div');
                        div.innerHTML = html;
                        const bookmark_button = tpl_chatroom_bookmark_toggle(
                            _.assignIn(
                                this.model.toJSON(),
                                {
                                    info_toggle_bookmark: __('Bookmark this room'),
                                    bookmarked: this.model.get('bookmarked')
                                }
                            ));
                        const close_button = div.querySelector('.close-chatbox-button');
                        close_button.insertAdjacentHTML('afterend', bookmark_button);
                        return div.innerHTML;
                    }
                    return html;
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
                    const icon = this.el.querySelector('.icon-pushpin');
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
                    let form = body.querySelector('form.chatroom-form');
                    if (!_.isNull(form)) {
                        form.parentNode.removeChild(form);
                    }
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
                    form = body.querySelector('form.chatroom-form');
                    form.addEventListener(
                        'submit',
                        this.onBookmarkFormSubmitted.bind(this)
                    );
                    form.querySelector('.button-cancel').addEventListener(
                        'click',
                        this.cancelConfiguration.bind(this)
                    );
                },

                onBookmarkFormSubmitted (ev) {
                    ev.preventDefault();
                    const { _converse } = this.__super__;
                    const $form = $(ev.target), that = this;
                    _converse.bookmarks.createBookmark({
                        'jid': this.model.get('jid'),
                        'autojoin': $form.find('input[name="autojoin"]').prop('checked'),
                        'name':  $form.find('input[name=name]').val(),
                        'nick':  $form.find('input[name=nick]').val()
                    });
                    this.$el.find('div.chatroom-form-container').hide(
                        function () {
                            $(this).remove();
                            that.renderAfterTransition();
                        });
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
                        this.el.querySelector('.icon-pushpin').classList.remove('button-on');
                    }
                }
            }
        },

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this,
                { __,
                ___ } = _converse;

            // Configuration values for this plugin
            // ====================================
            // Refer to docs/source/configuration.rst for explanations of these
            // configuration settings.
            _converse.api.settings.update({
                allow_bookmarks: true,
                hide_open_bookmarks: false
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
                    if (confirm(__(___("Are you sure you want to remove the bookmark \"%1$s\"?"), name))) {
                        _.invokeMap(_converse.bookmarks.where({'jid': jid}), Backbone.Model.prototype.destroy);
                    }
                },

                addBookmarkViaEvent (ev) {
                    /* Add a bookmark as determined by the passed in
                     * event.
                     */
                    ev.preventDefault();
                    const jid = ev.target.getAttribute('data-room-jid');
                    const chatroom = _converse.openChatRoom({'jid': jid}, true);
                    _converse.chatboxviews.get(jid).renderBookmarkForm();
                },
            });

            _converse.Bookmark = Backbone.Model;

            _converse.BookmarksList = Backbone.Model.extend({
                defaults: {
                    "toggle-state":  _converse.OPENED
                }
            });

            _converse.Bookmarks = Backbone.Collection.extend({
                model: _converse.Bookmark,

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
                        _converse.api.rooms.open(bookmark.get('jid'), bookmark.get('nick'));
                    }
                    return bookmark;
                },

                fetchBookmarks () {
                    const deferred = utils.getWrappedPromise();
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
                    return deferred.promise;
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

                onBookmarksReceived (deferred, iq) {
                    const bookmarks = $(iq).find(
                        'items[node="storage:bookmarks"] item[id="current"] storage conference'
                    );
                    const that = this;
                    _.forEach(bookmarks, function (bookmark) {
                        that.create({
                            'jid': bookmark.getAttribute('jid'),
                            'name': bookmark.getAttribute('name'),
                            'autojoin': bookmark.getAttribute('autojoin') === 'true',
                            'nick': bookmark.querySelector('nick').textContent
                        });
                    });
                    if (!_.isUndefined(deferred)) {
                        return deferred.resolve();
                    }
                },

                onBookmarksReceivedError (deferred, iq) {
                    window.sessionStorage.setItem(this.fetched_flag, true);
                    _converse.log('Error while fetching bookmarks', Strophe.LogLevel.ERROR);
                    _converse.log(iq, Strophe.LogLevel.DEBUG);
                    if (!_.isNil(deferred)) {
                        return deferred.reject();
                    }
                }
            });

            _converse.BookmarksView = Backbone.View.extend({
                tagName: 'div',
                className: 'bookmarks-list, rooms-list-container',
                events: {
                    'click .add-bookmark': 'addBookmark',
                    'click .bookmarks-toggle': 'toggleBookmarksList',
                    'click .remove-bookmark': 'removeBookmark'
                },

                initialize () {
                    this.model.on('add', this.renderBookmarkListElement, this);
                    this.model.on('remove', this.removeBookmarkListElement, this);
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
                },

                render () {
                    this.$el.html(tpl_bookmarks_list({
                        'toggle_state': this.list_model.get('toggle-state'),
                        'desc_bookmarks': __('Click to toggle the bookmarks list'),
                        'label_bookmarks': __('Bookmarks')
                    })).hide();
                    if (this.list_model.get('toggle-state') !== _converse.OPENED) {
                        this.$('.bookmarks').hide();
                    }
                    this.model.each(this.renderBookmarkListElement.bind(this));
                    const controlboxview = _converse.chatboxviews.get('controlbox');
                    if (!_.isUndefined(controlboxview)) {
                        this.$el.prependTo(controlboxview.$('#chatrooms'));
                    }
                    return this.$el;
                },

                removeBookmark: _converse.removeBookmarkViaEvent,
                addBookmark: _converse.addBookmarkViaEvent,

                renderBookmarkListElement (item) {
                    if (item instanceof _converse.ChatBox) {
                        item = _.head(this.model.where({'jid': item.get('jid')}));
                        if (_.isNil(item)) {
                            // A chat box has been closed, but we don't have a
                            // bookmark for it, so nothing further to do here.
                            return;
                        }
                    }
                    if (_converse.hide_open_bookmarks &&
                            _converse.chatboxes.where({'jid': item.get('jid')}).length) {
                        // A chat box has been opened, and we don't show
                        // bookmarks for open chats, so we remove it.
                        this.removeBookmarkListElement(item);
                        return;
                    }

                    const list_el = this.el.querySelector('.bookmarks');
                    const div = document.createElement('div');
                    div.innerHTML = tpl_bookmark({
                        'bookmarked': true,
                        'info_leave_room': __('Leave this room'),
                        'info_remove': __('Remove this bookmark'),
                        'info_remove_bookmark': __('Unbookmark this room'),
                        'info_title': __('Show more information on this room'),
                        'jid': item.get('jid'),
                        'name': item.get('name'),
                        'open_title': __('Click to open this room')
                    });
                    const el = _.head(sizzle(
                        `.available-chatroom[data-room-jid="${item.get('jid')}"]`,
                        list_el));

                    if (el) {
                        el.innerHTML = div.firstChild.innerHTML;
                    } else {
                        list_el.appendChild(div.firstChild);
                    }
                    this.show();
                },

                show () {
                    if (!this.$el.is(':visible')) {
                        this.$el.show();
                    }
                },

                hide () {
                    this.$el.hide();
                },

                removeBookmarkListElement (item) {
                    const list_el = this.el.querySelector('.bookmarks');
                    const el = _.head(sizzle(`.available-chatroom[data-room-jid="${item.get('jid')}"]`, list_el));
                    if (el) {
                        list_el.removeChild(el);
                    }
                    if (list_el.childElementCount === 0) {
                        this.hide();
                    }
                },

                toggleBookmarksList (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    const $el = $(ev.target);
                    if ($el.hasClass("icon-opened")) {
                        this.$('.bookmarks').slideUp('fast');
                        this.list_model.save({'toggle-state': _converse.CLOSED});
                        $el.removeClass("icon-opened").addClass("icon-closed");
                    } else {
                        $el.removeClass("icon-closed").addClass("icon-opened");
                        this.$('.bookmarks').slideDown('fast');
                        this.list_model.save({'toggle-state': _converse.OPENED});
                    }
                }
            });

            const initBookmarks = function () {
                if (!_converse.allow_bookmarks) {
                    return;
                }
                _converse.bookmarks = new _converse.Bookmarks();
                _converse.bookmarks.fetchBookmarks().then(function () {
                    _converse.bookmarksview = new _converse.BookmarksView(
                        {'model': _converse.bookmarks}
                    );
                    _converse.emit('bookmarksInitialized');
                });
            };

            Promise.all([
                _converse.api.waitUntil('chatBoxesFetched'),
                _converse.api.waitUntil('roomsPanelRendered')
            ]).then(initBookmarks);

            const afterReconnection = function () {
                if (!_converse.allow_bookmarks) {
                    return;
                }
                if (_.isUndefined(_converse.bookmarksview)) {
                    initBookmarks();
                } else {
                    _converse.bookmarksview.render();
                }
            };
            _converse.on('reconnected', afterReconnection);
        }
    });
}));
