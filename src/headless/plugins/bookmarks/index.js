/**
 * @description
 * Converse.js plugin which adds views for bookmarks specified in XEP-0048.
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "../..//plugins/muc/index.js";
import Bookmark from './model.js';
import Bookmarks from './collection.js';
import _converse from '../../shared/_converse.js';
import api, { converse } from '../../shared/api/index.js';
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

        const exports  = { Bookmark, Bookmarks };
        Object.assign(_converse, exports); // TODO: DEPRECATED
        Object.assign(_converse.exports, exports);

        api.listen.on('addClientFeatures', () => {
            if (api.settings.get('allow_bookmarks')) {
                api.disco.own.features.add(Strophe.NS.BOOKMARKS + '+notify')
            }
        })

        api.listen.on('clearSession', () => {
            const { state } = _converse;
            if (state.bookmarks) {
                state.bookmarks.clearStore({'silent': true});
                window.sessionStorage.removeItem(state.bookmarks.fetched_flag);
                delete state.bookmarks;
            }
        });

        api.listen.on('connected', async () =>  {
            // Add a handler for bookmarks pushed from other connected clients
            const bare_jid = _converse.session.get('bare_jid');
            api.connection.get().addHandler(handleBookmarksPush, null, 'message', 'headline', null, bare_jid);
            await Promise.all([api.waitUntil('chatBoxesFetched')]);
            initBookmarks();
        });
    }
});
