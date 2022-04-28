/**
 * @description
 * Converse.js plugin which adds views for bookmarks specified in XEP-0048.
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "@converse/headless/plugins/muc/index.js";
import Bookmark from './model.js';
import Bookmarks from './collection.js';
import { Collection } from "@converse/skeletor/src/collection.js";
import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api, converse } from "@converse/headless/core.js";
import { initBookmarks, getNicknameFromBookmark, handleBookmarksPush } from './utils.js';

const { Strophe } = converse.env;

Strophe.addNamespace('BOOKMARKS', 'storage:bookmarks');


converse.plugins.add('converse-bookmarks', {

    dependencies: ["converse-chatboxes", "converse-muc"],

    overrides: {
        // Overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        // New functions which don't exist yet can also be added.

        ChatRoom: {
            getDisplayName () {
                const { _converse, getDisplayName } = this.__super__;
                const bookmark = this.get('bookmarked') ? _converse.bookmarks?.get(this.get('jid')) : null;
                return bookmark?.get('name') || getDisplayName.apply(this, arguments);
            },

            getAndPersistNickname (nick) {
                nick = nick || getNicknameFromBookmark(this.get('jid'));
                return this.__super__.getAndPersistNickname.call(this, nick);
            }
        }
    },

    initialize () {
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
            if (_converse.bookmarks) {
                _converse.bookmarks.clearStore({'silent': true});
                window.sessionStorage.removeItem(_converse.bookmarks.fetched_flag);
                delete _converse.bookmarks;
            }
        });

        api.listen.on('connected', async () =>  {
            // Add a handler for bookmarks pushed from other connected clients
            const { connection } = _converse;
            connection.addHandler(handleBookmarksPush, null, 'message', 'headline', null, _converse.bare_jid);
            await Promise.all([api.waitUntil('chatBoxesFetched')]);
            initBookmarks();
        });
    }
});
