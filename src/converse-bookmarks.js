// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

/* This is a Converse.js plugin which add support for bookmarks specified
 * in XEP-0048.
 */
(function (root, factory) {
    define("converse-bookmarks", [
            "jquery",
            "lodash",
            "moment_with_locales",
            "strophe",
            "utils",
            "converse-core",
            "converse-api",
            "converse-muc",
            "tpl!chatroom_bookmark_form",
            "tpl!chatroom_bookmark_toggle",
            "tpl!bookmark",
            "tpl!bookmarks_list"
        ],
        factory);
}(this, function (
        $, _, moment, strophe, utils,
        converse, converse_api, muc,
        tpl_chatroom_bookmark_form,
        tpl_chatroom_bookmark_toggle,
        tpl_bookmark,
        tpl_bookmarks_list
    ) {

    var __ = utils.__.bind(converse),
        ___ = utils.___,
        Strophe = converse_api.env.Strophe,
        $iq = converse_api.env.$iq,
        b64_sha1 = converse_api.env.b64_sha1;

    // Add new HTML templates.
    converse.templates.chatroom_bookmark_form = tpl_chatroom_bookmark_form;
    converse.templates.chatroom_bookmark_toggle = tpl_chatroom_bookmark_toggle;
    converse.templates.bookmark = tpl_bookmark;
    converse.templates.bookmarks_list = tpl_bookmarks_list;

    converse_api.plugins.add('converse-bookmarks', {
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
                    var html = this.__super__.generateHeadingHTML.apply(this, arguments);
                    if (converse.allow_bookmarks) {
                        var div = document.createElement('div');
                        div.innerHTML = html;
                        var bookmark_button = converse.templates.chatroom_bookmark_toggle(
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
                    if (_.isUndefined(converse.bookmarks) || !converse.allow_bookmarks) {
                        return this.__super__.checkForReservedNick.apply(this, arguments);
                    }
                    var model = converse.bookmarks.findWhere({'jid': this.model.get('jid')});
                    if (!_.isUndefined(model) && model.get('nick')) {
                        this.join(this.model.get('nick'));
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
                    if (!_.isUndefined(converse.bookmarks)) {
                        var models = converse.bookmarks.where({'jid': this.model.get('jid')});
                        if (!models.length) {
                            this.model.save('bookmarked', false);
                        } else {
                            this.model.save('bookmarked', true);
                        }
                    }
                },

                renderBookmarkForm: function () {
                    var $body = this.$('.chatroom-body');
                    $body.children().addClass('hidden');
                    // Remove any existing forms
                    $body.find('form.chatroom-form').remove();
                    $body.append(
                        converse.templates.chatroom_bookmark_form({
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
                    var $form = $(ev.target), that = this;
                    converse.bookmarks.createBookmark({
                        'jid': this.model.get('jid'),
                        'autojoin': $form.find('input[name="autojoin"]').prop('checked'),
                        'name':  $form.find('input[name=name]').val(),
                        'nick':  $form.find('input[name=nick]').val()
                    });
                    this.$el.find('div.chatroom-form-container').hide(
                        function () {
                            $(this).remove();
                            that.$('.chatroom-body').children().removeClass('hidden');
                        });
                },

                toggleBookmark: function (ev) {
                    if (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                    }
                    var models = converse.bookmarks.where({'jid': this.model.get('jid')});
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
            var converse = this.converse;
            // Configuration values for this plugin
            // ====================================
            // Refer to docs/source/configuration.rst for explanations of these
            // configuration settings.
            this.updateSettings({
                allow_bookmarks: true
            });

            converse.Bookmark = Backbone.Model;

            converse.BookmarksList = Backbone.Model.extend({
                defaults: {
                    "toggle-state":  converse.OPENED
                }
            });

            converse.Bookmarks = Backbone.Collection.extend({
                model: converse.Bookmark,

                initialize: function () {
                    this.on('add', _.compose(this.markRoomAsBookmarked, this.openBookmarkedRoom));
                    this.on('remove', this.markRoomAsUnbookmarked, this);
                    this.on('remove', this.sendBookmarkStanza, this);

                    var cache_key = 'converse.room-bookmarks'+converse.bare_jid;
                    this.cached_flag = b64_sha1(cache_key+'fetched');
                    this.browserStorage = new Backbone.BrowserStorage[converse.storage](
                        b64_sha1(cache_key)
                    );
                },

                openBookmarkedRoom: function (bookmark) {
                    if (bookmark.get('autojoin')) {
                        converse_api.rooms.open(bookmark.get('jid'), bookmark.get('nick'));
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
                    converse.bookmarks.create(options);
                    converse.bookmarks.sendBookmarkStanza();
                },

                sendBookmarkStanza: function () {
                    var stanza = $iq({
                            'type': 'set',
                            'from': converse.connection.jid,
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
                    converse.connection.sendIQ(stanza, null, this.onBookmarkError.bind(this));
                },

                onBookmarkError: function (iq) {
                    converse.log("Error while trying to add bookmark", "error");
                    converse.log(iq);
                    // We remove all locally cached bookmarks and fetch them
                    // again from the server.
                    this.reset();
                    this.fetchBookmarksFromServer(null);
                    window.alert(__("Sorry, something went wrong while trying to save your bookmark."));
                },

                fetchBookmarksFromServer: function (deferred) {
                    var stanza = $iq({
                        'from': converse.connection.jid,
                        'type': 'get',
                    }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                        .c('items', {'node': 'storage:bookmarks'});
                    converse.connection.sendIQ(
                        stanza,
                        _.bind(this.onBookmarksReceived, this, deferred),
                        _.bind(this.onBookmarksReceivedError, this, deferred)
                    );
                },

                markRoomAsBookmarked: function (bookmark) {
                    var room = converse.chatboxes.get(bookmark.get('jid'));
                    if (!_.isUndefined(room)) {
                        room.save('bookmarked', true);
                    }
                },

                markRoomAsUnbookmarked: function (bookmark) {
                    var room = converse.chatboxes.get(bookmark.get('jid'));
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
                    converse.log('Error while fetching bookmarks');
                    converse.log(iq);
                    if (!_.isUndefined(deferred)) {
                        return deferred.reject();
                    }
                }
            });

            converse.BookmarksView = Backbone.View.extend({
                tagName: 'div',
                className: 'bookmarks-list',
                events: {
                    'click .remove-bookmark': 'removeBookmark',
                    'click .bookmarks-toggle': 'toggleBookmarksList'
                },

                initialize: function () {
                    this.model.on('add', this.renderBookmarkListElement, this);
                    this.model.on('remove', this.removeBookmarkListElement, this);

                    var cachekey = 'converse.room-bookmarks'+converse.bare_jid+'-list-model';
                    this.list_model = new converse.BookmarksList();
                    this.list_model.id = cachekey;
                    this.list_model.browserStorage = new Backbone.BrowserStorage[converse.storage](
                        b64_sha1(cachekey)
                    );
                    this.list_model.fetch();
                    this.render();
                },

                render: function (cfg) {
                    this.$el.html(converse.templates.bookmarks_list({
                        'toggle_state': this.list_model.get('toggle-state'),
                        'desc_bookmarks': __('Click to toggle the bookmarks list'),
                        'label_bookmarks': __('Bookmarked Rooms')
                    })).hide();
                    if (this.list_model.get('toggle-state') !== converse.OPENED) {
                        this.$('.bookmarks').hide();
                    }
                    this.model.each(this.renderBookmarkListElement, this);
                    var controlboxview = converse.chatboxviews.get('controlbox');
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
                        _.forEach(converse.bookmarks.where({'jid': jid}), function (item) { item.destroy(); });
                    }
                },

                renderBookmarkListElement: function (item) {
                    var $bookmark = $(converse.templates.bookmark({
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
                        this.list_model.save({'toggle-state': converse.CLOSED});
                        $el.removeClass("icon-opened").addClass("icon-closed");
                    } else {
                        $el.removeClass("icon-closed").addClass("icon-opened");
                        this.$('.bookmarks').slideDown('fast');
                        this.list_model.save({'toggle-state': converse.OPENED});
                    }
                }
            });

            var initBookmarks = function () {
                if (!converse.allow_bookmarks) {
                    return;
                }
                converse.bookmarks = new converse.Bookmarks();
                converse.bookmarks.fetchBookmarks().always(function () {
                    converse.bookmarksview = new converse.BookmarksView(
                        {'model': converse.bookmarks}
                    );
                });
            };
            converse.on('chatBoxesFetched', initBookmarks);

            var afterReconnection = function () {
                if (!converse.allow_bookmarks) {
                    return;
                }
                if (_.isUndefined(converse.bookmarksview)) {
                    initBookmarks();
                } else {
                    converse.bookmarksview.render();
                }
            };
            converse.on('reconnected', afterReconnection);
        }
    });
}));
