// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

/* This is a Converse.js plugin which add support for bookmarks specified
 * in XEP-0048.
 */
(function (root, factory) {
    define([ "utils",
            "converse-core",
            "converse-muc",
            "tpl!chatroom_bookmark_form",
            "tpl!chatroom_bookmark_toggle",
            "tpl!bookmark",
            "tpl!bookmarks_list"
        ],
        factory);
}(this, function (
        utils,
        converse,
        muc,
        tpl_chatroom_bookmark_form,
        tpl_chatroom_bookmark_toggle,
        tpl_bookmark,
        tpl_bookmarks_list
    ) {

    var $ = converse.env.jQuery,
        Strophe = converse.env.Strophe,
        $iq = converse.env.$iq,
        b64_sha1 = converse.env.b64_sha1,
        _ = converse.env._;

    converse.plugins.add('converse-bookmarks', {
        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            clearSession: function () {
                this.__super__.clearSession.apply(this, arguments);
                if (!_.isUndefined(this.bookmarks)) {
                    this.bookmarks.browserStorage._clear();
                }
            },

            ChatRoomView: {
                events: {
                    'click .toggle-bookmark': 'toggleBookmark'
                },

                initialize: function () {
                    this.__super__.initialize.apply(this, arguments);
                    this.model.on('change:bookmarked', this.onBookmarked, this);
                    this.setBookmarkState();
                },

                generateHeadingHTML: function () {
                    var _converse = this.__super__._converse,
                        __ = _converse.__,
                        html = this.__super__.generateHeadingHTML.apply(this, arguments);
                    if (_converse.allow_bookmarks) {
                        var div = document.createElement('div');
                        div.innerHTML = html;
                        var bookmark_button = tpl_chatroom_bookmark_toggle(
                            _.assignIn(
                                this.model.toJSON(),
                                {
                                    info_toggle_bookmark: __('Bookmark this room'),
                                    bookmarked: this.model.get('bookmarked')
                                }
                            ));
                        var close_button = div.querySelector('.close-chatbox-button');
                        close_button.insertAdjacentHTML('afterend', bookmark_button);
                        return div.innerHTML;
                    }
                    return html;
                },

                checkForReservedNick: function () {
                    /* Check if the user has a bookmark with a saved nickanme
                     * for this room, and if so use it.
                     * Otherwise delegate to the super method.
                     */
                    var _converse = this.__super__._converse;
                    if (_.isUndefined(_converse.bookmarks) || !_converse.allow_bookmarks) {
                        return this.__super__.checkForReservedNick.apply(this, arguments);
                    }
                    var model = _converse.bookmarks.findWhere({'jid': this.model.get('jid')});
                    if (!_.isUndefined(model) && model.get('nick')) {
                        this.join(model.get('nick'));
                    } else {
                        return this.__super__.checkForReservedNick.apply(this, arguments);
                    }
                },

                onBookmarked: function () {
                    if (this.model.get('bookmarked')) {
                        this.$('.icon-pushpin').addClass('button-on');
                    } else {
                        this.$('.icon-pushpin').removeClass('button-on');
                    }
                },

                setBookmarkState: function () {
                    /* Set whether the room is bookmarked or not.
                     */
                    var _converse = this.__super__._converse;
                    if (!_.isUndefined(_converse.bookmarks)) {
                        var models = _converse.bookmarks.where({'jid': this.model.get('jid')});
                        if (!models.length) {
                            this.model.save('bookmarked', false);
                        } else {
                            this.model.save('bookmarked', true);
                        }
                    }
                },

                renderBookmarkForm: function () {
                    var _converse = this.__super__._converse,
                        __ = _converse.__,
                        $body = this.$('.chatroom-body');
                    $body.children().addClass('hidden');
                    // Remove any existing forms
                    $body.find('form.chatroom-form').remove();
                    $body.append(
                        tpl_chatroom_bookmark_form({
                            heading: __('Bookmark this room'),
                            label_name: __('The name for this bookmark:'),
                            label_autojoin: __('Would you like this room to be automatically joined upon startup?'),
                            label_nick: __('What should your nickname for this room be?'),
                            default_nick: this.model.get('nick'),
                            label_submit: __('Save'),
                            label_cancel: __('Cancel')
                        }));
                    this.$('.chatroom-form').submit(this.onBookmarkFormSubmitted.bind(this));
                    this.$('.chatroom-form .button-cancel').on('click', this.cancelConfiguration.bind(this));
                },

                onBookmarkFormSubmitted: function (ev) {
                    ev.preventDefault();
                    var _converse = this.__super__._converse;
                    var $form = $(ev.target), that = this;
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

                toggleBookmark: function (ev) {
                    if (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                    }
                    var _converse = this.__super__._converse;
                    var models = _converse.bookmarks.where({'jid': this.model.get('jid')});
                    if (!models.length) {
                        this.renderBookmarkForm();
                    } else {
                        _.forEach(models, function (model) {
                            model.destroy();
                        });
                        this.$('.icon-pushpin').removeClass('button-on');
                    }
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var _converse = this._converse,
                __ = _converse.__,
                ___ = _converse.___;

            // Configuration values for this plugin
            // ====================================
            // Refer to docs/source/configuration.rst for explanations of these
            // configuration settings.
            this.updateSettings({
                allow_bookmarks: true
            });

            _converse.Bookmark = Backbone.Model;

            _converse.BookmarksList = Backbone.Model.extend({
                defaults: {
                    "toggle-state":  _converse.OPENED
                }
            });

            _converse.Bookmarks = Backbone.Collection.extend({
                model: _converse.Bookmark,

                initialize: function () {
                    this.on('add', _.flow(this.openBookmarkedRoom, this.markRoomAsBookmarked));
                    this.on('remove', this.markRoomAsUnbookmarked, this);
                    this.on('remove', this.sendBookmarkStanza, this);

                    var cache_key = 'converse.room-bookmarks'+_converse.bare_jid;
                    this.cached_flag = b64_sha1(cache_key+'fetched');
                    this.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                        b64_sha1(cache_key)
                    );
                },

                openBookmarkedRoom: function (bookmark) {
                    if (bookmark.get('autojoin')) {
                        _converse.api.rooms.open(bookmark.get('jid'), bookmark.get('nick'));
                    }
                    return bookmark;
                },

                fetchBookmarks: function () {
                    var deferred = new $.Deferred();
                    var promise = deferred.promise();
                    if (window.sessionStorage.getItem(this.browserStorage.name)) {
                        this.fetch({
                            'success': _.bind(this.onCachedBookmarksFetched, this, deferred),
                            'error':  _.bind(this.onCachedBookmarksFetched, this, deferred)
                        });
                    } else if (! window.sessionStorage.getItem(this.cached_flag)) {
                        // There aren't any cached bookmarks, and the cache is
                        // not set to null. So we query the XMPP server.
                        // If nothing is returned from the XMPP server, we set
                        // the cache to null to avoid calling the server again.
                        this.fetchBookmarksFromServer(deferred);
                    } else {
                        deferred.resolve();
                    }
                    return promise;
                },

                onCachedBookmarksFetched: function (deferred) {
                    return deferred.resolve();
                },

                createBookmark: function (options) {
                    _converse.bookmarks.create(options);
                    _converse.bookmarks.sendBookmarkStanza();
                },

                sendBookmarkStanza: function () {
                    var stanza = $iq({
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

                onBookmarkError: function (iq) {
                    _converse.log("Error while trying to add bookmark", "error");
                    _converse.log(iq);
                    // We remove all locally cached bookmarks and fetch them
                    // again from the server.
                    this.reset();
                    this.fetchBookmarksFromServer(null);
                    window.alert(__("Sorry, something went wrong while trying to save your bookmark."));
                },

                fetchBookmarksFromServer: function (deferred) {
                    var stanza = $iq({
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

                markRoomAsBookmarked: function (bookmark) {
                    var room = _converse.chatboxes.get(bookmark.get('jid'));
                    if (!_.isUndefined(room)) {
                        room.save('bookmarked', true);
                    }
                },

                markRoomAsUnbookmarked: function (bookmark) {
                    var room = _converse.chatboxes.get(bookmark.get('jid'));
                    if (!_.isUndefined(room)) {
                        room.save('bookmarked', false);
                    }
                },

                onBookmarksReceived: function (deferred, iq) {
                    var bookmarks = $(iq).find(
                        'items[node="storage:bookmarks"] item[id="current"] storage conference'
                    );
                    var that = this;
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

                onBookmarksReceivedError: function (deferred, iq) {
                    window.sessionStorage.setItem(this.cached_flag, true);
                    _converse.log('Error while fetching bookmarks');
                    _converse.log(iq);
                    if (!_.isUndefined(deferred)) {
                        return deferred.reject();
                    }
                }
            });

            _converse.BookmarksView = Backbone.View.extend({
                tagName: 'div',
                className: 'bookmarks-list',
                events: {
                    'click .remove-bookmark': 'removeBookmark',
                    'click .bookmarks-toggle': 'toggleBookmarksList'
                },

                initialize: function () {
                    this.model.on('add', this.renderBookmarkListElement, this);
                    this.model.on('remove', this.removeBookmarkListElement, this);

                    var cachekey = 'converse.room-bookmarks'+_converse.bare_jid+'-list-model';
                    this.list_model = new _converse.BookmarksList();
                    this.list_model.id = cachekey;
                    this.list_model.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                        b64_sha1(cachekey)
                    );
                    this.list_model.fetch();
                    this.render();
                },

                render: function () {
                    this.$el.html(tpl_bookmarks_list({
                        'toggle_state': this.list_model.get('toggle-state'),
                        'desc_bookmarks': __('Click to toggle the bookmarks list'),
                        'label_bookmarks': __('Bookmarked Rooms')
                    })).hide();
                    if (this.list_model.get('toggle-state') !== _converse.OPENED) {
                        this.$('.bookmarks').hide();
                    }
                    this.model.each(this.renderBookmarkListElement.bind(this));
                    var controlboxview = _converse.chatboxviews.get('controlbox');
                    if (!_.isUndefined(controlboxview)) {
                        this.$el.prependTo(controlboxview.$('#chatrooms'));
                    }
                    return this.$el;
                },

                removeBookmark: function (ev) {
                    ev.preventDefault();
                    var name = $(ev.target).data('bookmarkName');
                    var jid = $(ev.target).data('roomJid');
                    if (confirm(__(___("Are you sure you want to remove the bookmark \"%1$s\"?"), name))) {
                        _.invokeMap(_converse.bookmarks.where({'jid': jid}), Backbone.Model.prototype.destroy);
                    }
                },

                renderBookmarkListElement: function (item) {
                    var $bookmark = $(tpl_bookmark({
                            'name': item.get('name'),
                            'jid': item.get('jid'),
                            'open_title': __('Click to open this room'),
                            'info_title': __('Show more information on this room'),
                            'info_remove': __('Remove this bookmark')
                        }));
                    this.$('.bookmarks').append($bookmark);
                    if (!this.$el.is(':visible')) {
                        this.$el.show();
                    }
                },

                removeBookmarkListElement: function (item) {
                    this.$('[data-room-jid="'+item.get('jid')+'"]:first').parent().remove();
                    if (this.model.length === 0) {
                        this.$el.hide();
                    }
                },

                toggleBookmarksList: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $el = $(ev.target);
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

            var initBookmarks = function () {
                if (!_converse.allow_bookmarks) {
                    return;
                }
                _converse.bookmarks = new _converse.Bookmarks();
                _converse.bookmarks.fetchBookmarks().always(function () {
                    _converse.bookmarksview = new _converse.BookmarksView(
                        {'model': _converse.bookmarks}
                    );
                });
            };
            _converse.on('chatBoxesFetched', initBookmarks);

            var afterReconnection = function () {
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
