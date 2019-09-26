// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// Copyright (c) 2019, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/**
 * @module converse-bookmarks
 * @description
 * Converse.js plugin which adds views for bookmarks specified in XEP-0048.
 */
import "@converse/headless/converse-muc";
import BrowserStorage from "backbone.browserStorage";
import converse from "@converse/headless/converse-core";

const { Backbone, Strophe, $iq, sizzle, _ } = converse.env;
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
    dependencies: ["converse-chatboxes", "converse-muc"],

    overrides: {
        // Overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        //
        // New functions which don't exist yet can also be added.

        ChatRoom: {
            getDisplayName () {
                const { _converse } = this.__super__;
                if (this.get('bookmarked') && _converse.bookmarks) {
                    const bookmark = _converse.bookmarks.findWhere({'jid': this.get('jid')});
                    if (bookmark) {
                        return bookmark.get('name');
                    }
                }
                return this.__super__.getDisplayName.apply(this, arguments);
            },

            getAndPersistNickname (nick) {
                const { _converse } = this.__super__;
                nick = nick || _converse.getNicknameFromBookmark(this.get('jid'));
                return this.__super__.getAndPersistNickname.call(this, nick);
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
            allow_public_bookmarks: false
        });

        _converse.api.promises.add('bookmarksInitialized');

        /**
          * Check if the user has a bookmark with a saved nickanme
          * for this groupchat and return it.
          * @private
          * @method _converse#getNicknameFromBookmark
          */
        _converse.getNicknameFromBookmark = function (jid) {
            if (!_converse.bookmarks || !_converse.allow_bookmarks) {
                return null;
            }
            const bookmark = _converse.bookmarks.findWhere({'jid': jid});
            if (bookmark) {
                return bookmark.get('nick');
            }
        }

        _converse.Bookmark = Backbone.Model;

        _converse.Bookmarks = _converse.Collection.extend({
            model: _converse.Bookmark,
            comparator: (item) => item.get('name').toLowerCase(),

            initialize () {
                this.on('add', _.flow(this.openBookmarkedRoom, this.markRoomAsBookmarked));
                this.on('remove', this.markRoomAsUnbookmarked, this);
                this.on('remove', this.sendBookmarkStanza, this);

                const storage = _converse.config.get('storage'),
                      cache_key = `converse.room-bookmarks${_converse.bare_jid}`;
                this.fetched_flag = cache_key+'fetched';
                this.browserStorage = new BrowserStorage[storage](cache_key);
            },

            openBookmarkedRoom (bookmark) {
                if ( _converse.muc_respect_autojoin && bookmark.get('autojoin')) {
                    const groupchat = _converse.api.rooms.create(bookmark.get('jid'), bookmark.get('nick'));
                    groupchat.maybeShow();
                }
                return bookmark;
            },

            fetchBookmarks () {
                const deferred = u.getResolveablePromise();
                if (this.browserStorage.records.length > 0) {
                    this.fetch({
                        'success': () => deferred.resolve(),
                        'error':  () => deferred.resolve()
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

            createBookmark (options) {
                this.create(options);
                this.sendBookmarkStanza().catch(iq => this.onBookmarkError(iq, options));
            },

            sendBookmarkStanza () {
                const stanza = $iq({
                        'type': 'set',
                        'from': _converse.connection.jid,
                    })
                    .c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                        .c('publish', {'node': 'storage:bookmarks'})
                            .c('item', {'id': 'current'})
                                .c('storage', {'xmlns':'storage:bookmarks'});
                this.forEach(model => {
                    stanza.c('conference', {
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
                return _converse.api.sendIQ(stanza);
            },

            onBookmarkError (iq, options) {
                _converse.log("Error while trying to add bookmark", Strophe.LogLevel.ERROR);
                _converse.log(iq);
                _converse.api.alert.show(
                    Strophe.LogLevel.ERROR,
                    __('Error'), [__("Sorry, something went wrong while trying to save your bookmark.")]
                )
                this.findWhere({'jid': options.jid}).destroy();
            },

            fetchBookmarksFromServer (deferred) {
                const stanza = $iq({
                    'from': _converse.connection.jid,
                    'type': 'get',
                }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                    .c('items', {'node': 'storage:bookmarks'});
                _converse.api.sendIQ(stanza)
                    .then((iq) => this.onBookmarksReceived(deferred, iq))
                    .catch((iq) => this.onBookmarksReceivedError(deferred, iq)
                );
            },

            markRoomAsBookmarked (bookmark) {
                const groupchat = _converse.chatboxes.get(bookmark.get('jid'));
                if (groupchat !== undefined) {
                    groupchat.save('bookmarked', true);
                }
            },

            markRoomAsUnbookmarked (bookmark) {
                const groupchat = _converse.chatboxes.get(bookmark.get('jid'));
                if (groupchat !== undefined) {
                    groupchat.save('bookmarked', false);
                }
            },

            createBookmarksFromStanza (stanza) {
                const bookmarks = sizzle(
                    `items[node="storage:bookmarks"] item storage[xmlns="storage:bookmarks"] conference`,
                    stanza
                );
                _.forEach(bookmarks, (bookmark) => {
                    const jid = bookmark.getAttribute('jid');
                    this.create({
                        'jid': jid,
                        'name': bookmark.getAttribute('name') || jid,
                        'autojoin': bookmark.getAttribute('autojoin') === 'true',
                        'nick': _.get(bookmark.querySelector('nick'), 'textContent')
                    });
                });
            },

            onBookmarksReceived (deferred, iq) {
                this.createBookmarksFromStanza(iq);
                if (deferred !== undefined) {
                    return deferred.resolve();
                }
            },

            onBookmarksReceivedError (deferred, iq) {
                window.sessionStorage.setItem(this.fetched_flag, true);
                _converse.log('Error while fetching bookmarks', Strophe.LogLevel.ERROR);
                _converse.log(iq.outerHTML, Strophe.LogLevel.DEBUG);
                if (deferred) {
                    if (iq.querySelector('error[type="cancel"] item-not-found')) {
                        // Not an exception, the user simply doesn't have any bookmarks.
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

        _converse.checkBookmarksSupport = async function () {
            const identity = await _converse.api.disco.getIdentity('pubsub', 'pep', _converse.bare_jid);
            if (_converse.allow_public_bookmarks) {
                return !!identity;
            } else {
                return _converse.api.disco.supports(Strophe.NS.PUBSUB+'#publish-options', _converse.bare_jid);
            }
        }

        const initBookmarks = async function () {
            if (!_converse.allow_bookmarks) {
                return;
            }
            if (await _converse.checkBookmarksSupport()) {
                _converse.bookmarks = new _converse.Bookmarks();
                await _converse.bookmarks.fetchBookmarks();
                /**
                 * Triggered once the _converse.Bookmarks collection
                 * has been created and cached bookmarks have been fetched.
                 * @event _converse#bookmarksInitialized
                 * @example _converse.api.listen.on('bookmarksInitialized', () => { ... });
                 */
                _converse.api.trigger('bookmarksInitialized');
            }
        }

        _converse.api.listen.on('clearSession', () => {
            if (_converse.bookmarks !== undefined) {
                _converse.bookmarks.clearSession({'silent': true});
                window.sessionStorage.removeItem(_converse.bookmarks.fetched_flag);
            }
        });

        _converse.api.listen.on('reconnected', initBookmarks);

        _converse.api.listen.on('connected', async () =>  {
            // Add a handler for bookmarks pushed from other connected clients
            _converse.connection.addHandler(message => {
                if (sizzle('event[xmlns="'+Strophe.NS.PUBSUB+'#event"] items[node="storage:bookmarks"]', message).length) {
                    _converse.api.waitUntil('bookmarksInitialized')
                        .then(() => _converse.bookmarks.createBookmarksFromStanza(message))
                        .catch(e => _converse.log(e, Strophe.LogLevel.FATAL));
                }
            }, null, 'message', 'headline', null, _converse.bare_jid);

            await Promise.all([_converse.api.waitUntil('chatBoxesFetched')]);
            initBookmarks();
        });
    }
});
