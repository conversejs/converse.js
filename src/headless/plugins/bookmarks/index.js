/**
 * @description
 * Converse.js plugin which adds views for bookmarks specified in XEP-0048.
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "@converse/headless/plugins/muc/index.js";
import Bookmark from './model.js';
import Bookmarks from './collection.js';
import log from "@converse/headless/log.js";
import { Collection } from "@converse/skeletor/src/collection";
import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api, converse } from "@converse/headless/core";
import { checkBookmarksSupport, getNicknameFromBookmark } from './utils.js';

const { Strophe, sizzle } = converse.env;

Strophe.addNamespace('BOOKMARKS', 'storage:bookmarks');


async function initBookmarks () {
    if (!api.settings.get('allow_bookmarks')) {
        return;
    }
    if (await checkBookmarksSupport()) {
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
                nick = nick || getNicknameFromBookmark(this.get('jid'));
                return this.__super__.getAndPersistNickname.call(this, nick);
            }
        }
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */

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

        _converse.Bookmark = Bookmark;
        _converse.Bookmarks = Collection.extend(Bookmarks);

        _converse.BookmarksList = Model.extend({
            defaults: {
                "toggle-state":  _converse.OPENED
            }
        });

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
