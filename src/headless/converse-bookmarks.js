/**
 * @module converse-bookmarks
 * @description
 * Converse.js plugin which adds views for bookmarks specified in XEP-0048.
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "@converse/headless/converse-muc";
import log from "./log";
import { Collection } from "@converse/skeletor/src/collection";
import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api, converse } from "@converse/headless/converse-core";

const { Strophe, $iq, sizzle } = converse.env;
const u = converse.env.utils;

Strophe.addNamespace('BOOKMARKS', 'storage:bookmarks');


function handleBookmarksPush (message) {
    if (sizzle(`event[xmlns="${Strophe.NS.PUBSUB}#event"] items[node="${Strophe.NS.BOOKMARKS}"]`, message).length) {
        api.waitUntil('bookmarksInitialized')
            .then(() => _converse.bookmarks.createBookmarksFromStanza(message))
            .catch(e => log.fatal(e));
    }
    return true;
}


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
        const { __ } = _converse;

        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        api.settings.extend({
            allow_bookmarks: true,
            allow_public_bookmarks: false,
            muc_respect_autojoin: true
        });

        api.promises.add('bookmarksInitialized');

        /**
          * Check if the user has a bookmark with a saved nickanme
          * for this groupchat and return it.
          * @private
          * @method _converse#getNicknameFromBookmark
          */
        _converse.getNicknameFromBookmark = function (jid) {
            if (!_converse.bookmarks || !api.settings.get('allow_bookmarks')) {
                return null;
            }
            const bookmark = _converse.bookmarks.findWhere({'jid': jid});
            if (bookmark) {
                return bookmark.get('nick');
            }
        }

        _converse.Bookmark = Model.extend({
            idAttribute: 'jid',
            getDisplayName () {
                return Strophe.xmlunescape(this.get('name'));
            }
        });

        _converse.Bookmarks = Collection.extend({
            model: _converse.Bookmark,
            comparator: (item) => item.get('name').toLowerCase(),

            initialize () {
                this.on('add', bm => this.openBookmarkedRoom(bm)
                    .then(bm => this.markRoomAsBookmarked(bm))
                    .catch(e => log.fatal(e))
                );

                this.on('remove', this.markRoomAsUnbookmarked, this);
                this.on('remove', this.sendBookmarkStanza, this);

                const cache_key = `converse.room-bookmarks${_converse.bare_jid}`;
                this.fetched_flag = cache_key+'fetched';
                this.browserStorage = _converse.createStore(cache_key);
            },

            async openBookmarkedRoom (bookmark) {
                if ( api.settings.get('muc_respect_autojoin') && bookmark.get('autojoin')) {
                    const groupchat = await api.rooms.create(
                        bookmark.get('jid'),
                        {'nick': bookmark.get('nick')}
                    );
                    groupchat.maybeShow();
                }
                return bookmark;
            },

            fetchBookmarks () {
                const deferred = u.getResolveablePromise();
                if (window.sessionStorage.getItem(this.fetched_flag)) {
                    this.fetch({
                        'success': () => deferred.resolve(),
                        'error': () => deferred.resolve()
                    });
                } else {
                    this.fetchBookmarksFromServer(deferred);
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
                        .c('publish', {'node': Strophe.NS.BOOKMARKS})
                            .c('item', {'id': 'current'})
                                .c('storage', {'xmlns': Strophe.NS.BOOKMARKS});
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
                return api.sendIQ(stanza);
            },

            onBookmarkError (iq, options) {
                log.error("Error while trying to add bookmark");
                log.error(iq);
                api.alert(
                    'error', __('Error'), [__("Sorry, something went wrong while trying to save your bookmark.")]
                );
                this.findWhere({'jid': options.jid}).destroy();
            },

            fetchBookmarksFromServer (deferred) {
                const stanza = $iq({
                    'from': _converse.connection.jid,
                    'type': 'get',
                }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                    .c('items', {'node': Strophe.NS.BOOKMARKS});
                api.sendIQ(stanza)
                    .then(iq => this.onBookmarksReceived(deferred, iq))
                    .catch(iq => this.onBookmarksReceivedError(deferred, iq)
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
                const xmlns = Strophe.NS.BOOKMARKS;
                const sel = `items[node="${xmlns}"] item storage[xmlns="${xmlns}"] conference`;
                sizzle(sel, stanza).forEach(el => {
                    const jid = el.getAttribute('jid');
                    const bookmark = this.get(jid);
                    const attrs = {
                        'jid': jid,
                        'name': el.getAttribute('name') || jid,
                        'autojoin': el.getAttribute('autojoin') === 'true',
                        'nick': el.querySelector('nick')?.textContent || ''
                    }
                    bookmark ? bookmark.save(attrs) : this.create(attrs);
                });
            },

            onBookmarksReceived (deferred, iq) {
                this.createBookmarksFromStanza(iq);
                window.sessionStorage.setItem(this.fetched_flag, true);
                if (deferred !== undefined) {
                    return deferred.resolve();
                }
            },

            onBookmarksReceivedError (deferred, iq) {
                if (iq === null) {
                    log.error('Error: timeout while fetching bookmarks');
                    api.alert('error', __('Timeout Error'),
                        [__("The server did not return your bookmarks within the allowed time. "+
                            "You can reload the page to request them again.")]
                    );
                } else if (deferred) {
                    if (iq.querySelector('error[type="cancel"] item-not-found')) {
                        // Not an exception, the user simply doesn't have any bookmarks.
                        window.sessionStorage.setItem(this.fetched_flag, true);
                        return deferred.resolve();
                    } else {
                        log.error('Error while fetching bookmarks');
                        log.error(iq);
                        return deferred.reject(new Error("Could not fetch bookmarks"));
                    }
                } else {
                    log.error('Error while fetching bookmarks');
                    log.error(iq);
                }
            },

            getUnopenedBookmarks () {
                return this.filter(b => !_converse.chatboxes.get(b.get('jid')));
            }
        });

        _converse.BookmarksList = Model.extend({
            defaults: {
                "toggle-state":  _converse.OPENED
            }
        });

        _converse.checkBookmarksSupport = async function () {
            const identity = await api.disco.getIdentity('pubsub', 'pep', _converse.bare_jid);
            if (_converse.allow_public_bookmarks) {
                return !!identity;
            } else {
                return api.disco.supports(Strophe.NS.PUBSUB+'#publish-options', _converse.bare_jid);
            }
        }

        const initBookmarks = async function () {
            if (!api.settings.get('allow_bookmarks')) {
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
                api.trigger('bookmarksInitialized');
            }
        }

        api.listen.on('addClientFeatures', () => {
            if (api.settings.get('allow_bookmarks')) {
                api.disco.own.features.add(Strophe.NS.BOOKMARKS + '+notify')
            }
        })

        api.listen.on('clearSession', () => {
            if (_converse.bookmarks !== undefined) {
                _converse.bookmarks.clearStore({'silent': true});
                window.sessionStorage.removeItem(_converse.bookmarks.fetched_flag);
                delete _converse.bookmarks;
            }
        });

        api.listen.on('reconnected', initBookmarks);

        api.listen.on('connected', async () =>  {
            // Add a handler for bookmarks pushed from other connected clients
            const { connection } = _converse;
            connection.addHandler(handleBookmarksPush, null, 'message', 'headline', null, _converse.bare_jid);
            await Promise.all([api.waitUntil('chatBoxesFetched')]);
            initBookmarks();
        });
    }
});
