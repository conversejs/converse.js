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
            "underscore",
            "moment_with_locales",
            "strophe",
            "utils",
            "converse-core",
            "converse-api",
            "converse-muc",
            "tpl!chatroom_bookmark_form",
            "tpl!bookmark",
            "tpl!bookmarks_list"
        ],
        factory);
}(this, function (
        $, _, moment, strophe, utils,
        converse, converse_api, muc,
        tpl_chatroom_bookmark_form,
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
    converse.templates.bookmark = tpl_bookmark;
    converse.templates.bookmarks_list = tpl_bookmarks_list;

    converse_api.plugins.add('converse-bookmarks', {
        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            ChatRoomView: {
                events: {
                    'click .toggle-bookmark': 'toggleBookmark'
                },

                initialize: function () {
                    this.__super__.initialize.apply(this, arguments);
                    this.model.on('change:bookmarked', this.onBookmarked, this);
                    this.setBookmarkState();
                },

                render: function (options) {
                    this.__super__.render.apply(this, arguments);
                    var label_bookmark = _('Bookmark this room');
                    var button = '<a class="chatbox-btn toggle-bookmark icon-pushpin '+
                            (this.model.get('bookmarked') ? 'button-on"' : '"') +
                            'title="'+label_bookmark+'"></a>';
                    this.$el.find('.chat-head-chatroom .icon-wrench').before(button);
                    return this;
                },

                checkForReservedNick: function () {
                    /* Check if the user has a bookmark with a saved nickanme
                     * for this room, and if so use it.
                     * Otherwise delegate to the super method.
                     */
                    if (_.isUndefined(converse.bookmarks)) {
                        return;
                    }
                    var model = converse.bookmarks.findWhere({'jid': this.model.get('jid')});
                    if (!_.isUndefined(model) && model.get('nick')) {
                        this.join(this.model.get('nick'));
                    } else {
                        this.__super__.checkForReservedNick.apply(this, arguments);
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
                    this.$('.chatroom-form').submit(this.addBookmark.bind(this));
                    this.$('.chatroom-form .button-cancel').on('click', this.cancelConfiguration.bind(this));
                },

                addBookmark: function (ev) {
                    ev.preventDefault();
                    var $form = $(ev.target),
                        that = this;
                    converse.bookmarks.create({
                        'jid': this.model.get('jid'),
                        'autojoin': $form.find('input[name="autojoin"]').prop('checked'),
                        'name':  $form.find('input[name=name]').val(),
                        'nick':  $form.find('input[name=nick]').val()
                    });
                    this.model.save('bookmarked', true);
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
                        converse.bookmarks.remove(models);
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

            converse.Bookmark = Backbone.Model;

            converse.Bookmarks = Backbone.Collection.extend({
                model: converse.Bookmark,

                initialize: function () {
                    this.on('add', this.markRoomAsBookmarked, this);
                    this.on('add', this.openBookmarkedRoom, this);
                    this.on('add', this.sendBookmarkStanza, this);
                    this.on('remove', this.markRoomAsUnbookmarked, this);
                    this.on('remove', this.sendBookmarkStanza, this);

                    this.browserStorage = new Backbone.BrowserStorage[converse.storage](
                        b64_sha1('converse.room-bookmarks'+converse.bare_jid)
                    );
                },

                openBookmarkedRoom: function (bookmark) {
                    if (bookmark.get('autojoin')) {
                        converse_api.rooms.open(bookmark.get('jid'), bookmark.get('nick'));
                    }
                },

                fetchBookmarks: function () {
                    this.fetch({
                        'add': true,
                        'success': this.onCachedBookmarksFetched.bind(this),
                        'error':  this.onCachedBookmarksFetched.bind(this)
                    });
                },

                sendBookmarkStanza: function () {
                    var deferred = new $.Deferred();
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
                    converse.connection.sendIQ(
                        stanza,
                        deferred.resolve,
                        _.bind(this.onBookmarkError, this, deferred)
                    );
                    return deferred.promise();
                },

                onBookmarkError: function (deferred, iq) {
                    converse.log("Error while trying to add bookmark", "error");
                    converse.log(iq);
                    // We remove all locally cached bookmarks and fetch them
                    // again from the server.
                    this.reset();
                    this.fetchBookmarksFromServer();
                    window.alert(__("Sorry, something went wrong while trying to save your bookmark."));
                    return deferred.reject();
                },

                onCachedBookmarksFetched: function () {
                    if (!window.sessionStorage.getItem(this.browserStorage.name)) {
                        // There aren't any cached bookmarks, so we query the
                        // XMPP server.
                        this.fetchBookmarksFromServer();
                    }
                },

                fetchBookmarksFromServer: function () {
                    var stanza = $iq({
                        'from': converse.connection.jid,
                        'type': 'get',
                    }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                        .c('items', {'node': 'storage:bookmarks'});
                    converse.connection.sendIQ(
                        stanza,
                        this.onBookmarksReceived.bind(this),
                        this.onBookmarksReceivedError
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

                onBookmarksReceived: function (iq) {
                    var bookmarks = $(iq).find(
                        'items[node="storage:bookmarks"] item[id="current"] storage conference'
                    );
                    _.each(bookmarks, function (bookmark) {
                        this.create({
                            'jid': bookmark.getAttribute('jid'),
                            'name': bookmark.getAttribute('name'),
                            'autojoin': bookmark.getAttribute('autojoin') === 'true',
                            'nick': bookmark.querySelector('nick').textContent
                        });
                    }.bind(this));
                },

                onBookmarksReceivedError: function (iq) {
                    converse.log('Error while fetching bookmarks');
                    converse.log(iq);
                }
            });

            converse.BookmarksView = Backbone.View.extend({
                tagName: 'div',
                className: 'bookmarks-list',
                events: {
                    'click .remove-bookmark': 'removebookmark',
                    'click .bookmarks-toggle': 'toggleBookmarksList'
                },

                initialize: function () {
                    this.model.on('add', this.onBookmarkAdded, this);
                },

                render: function (cfg) {
                    this.$el.html(converse.templates.bookmarks_list({
                        'toggle_state': converse.OPENED,
                        'desc_bookmarks': __('Click to toggle the bookmarks list'),
                        'label_bookmarks': __('Bookmarked Rooms')
                    }));
                    this.$bookmarks = this.$('.bookmarks');
                    return this.$el;
                },

                removeBookmark: function (ev) {
                    ev.preventDefault();
                    var name = $(ev.target).data('bookmarkName');
                    var jid = $(ev.target).data('roomJid');
                    if (confirm(__(___("Are you sure you want to remove the bookmark \"%1$s\"?"), name))) {
                        var models = converse.bookmarks.where({'jid': jid});
                        converse.bookmarks.remove(models);
                    }
                },

                onBookmarkAdded: function (item) {
                    // TODO: Try to come up with a way to avoid DOM reflows.
                    var $bookmark = $(converse.templates.bookmark({
                            'name': item.get('name'),
                            'jid': item.get('jid'),
                            'open_title': __('Click to open this room'),
                            'info_title': __('Show more information on this room'),
                            'info_remove': __('Remove this bookmark')
                        }));
                    if (_.isUndefined(this.$bookmarks)) {
                        this.render();
                        var controlboxview = converse.chatboxviews.get('controlbox');
                        this.$el.prependTo(controlboxview.$('#chatrooms'));
                    }
                    this.$bookmarks.append($bookmark);
                },

                toggleBookmarksList: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $el = $(ev.target);
                    if ($el.hasClass("icon-opened")) {
                        this.$('.bookmarks').slideUp();
                        $el.removeClass("icon-opened").addClass("icon-closed");
                    } else {
                        $el.removeClass("icon-closed").addClass("icon-opened");
                        this.$('.bookmarks').slideDown();
                    }
                }
            });

            converse.initBookmarks = function () {
                converse.bookmarks = new converse.Bookmarks();
                converse.bookmarksview = new converse.BookmarksView(
                    {'model': converse.bookmarks}
                );
                converse.bookmarks.fetchBookmarks();
            };
            converse.on('connected', converse.initBookmarks);
            converse.on('reconnected', converse.initBookmarks);
        }
    });
}));
