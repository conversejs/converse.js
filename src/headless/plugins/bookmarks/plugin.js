/**
 * @copyright 2025, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import Bookmark from './model.js';
import Bookmarks from './collection.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { initBookmarks, getNicknameFromBookmark, handleBookmarksPush } from './utils.js';
import '../../plugins/muc/index.js';
import log from '../../log';
import bookmarks_api from './api.js';

const { Strophe } = converse.env;

Strophe.addNamespace('BOOKMARKS', 'storage:bookmarks');
Strophe.addNamespace('BOOKMARKS2', 'urn:xmpp:bookmarks:1');

converse.plugins.add('converse-bookmarks', {
    dependencies: ['converse-chatboxes', 'converse-muc'],

    initialize() {
        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        api.settings.extend({
            allow_bookmarks: true,
            allow_public_bookmarks: false,
            muc_respect_autojoin: true,
        });

        api.promises.add('bookmarksInitialized');

        Object.assign(api, bookmarks_api);

        const exports = { Bookmark, Bookmarks };
        Object.assign(_converse, exports); // TODO: DEPRECATED
        Object.assign(_converse.exports, exports);

        api.listen.on(
            'getNicknameForMUC',
            /**
             * @param {import('../muc/muc').default} muc
             * @param {string|null} nick
             * @returns {string}
             */
            (muc, nick) => {
                return nick || getNicknameFromBookmark(muc.get('jid'));
            }
        );

        api.listen.on(
            'parseMUCPresence',
            /**
             * @param {Element} _stanza
             * @param {import('../muc/types').MUCPresenceAttributes} attrs
             */
            (_stanza, attrs) => {
                if (attrs.is_self && attrs.codes.includes('303')) {
                    api.bookmarks.get(attrs.muc_jid).then(
                        /** @param {Bookmark} bookmark */ (bookmark) => {
                            if (!bookmark) log.warn('parseMUCPresence: no bookmark returned');

                            const { nick, muc_jid: jid } = attrs;
                            api.bookmarks.set({
                                jid,
                                nick,
                                autojoin: bookmark?.get('autojoin') ?? true,
                                password: bookmark?.get('password') ?? '',
                                name: bookmark?.get('name') ?? '',
                                extensions: bookmark?.get('extensions') ?? [],
                            });
                        }
                    );
                }
                return attrs;
            }
        );

        api.listen.on(
            'enteredNewRoom',
            /** @param {import('../muc/muc').default} muc */
            async ({ attributes }) => {
                const { jid, nick, password, name } = /** @type {import("../muc/types").MUCAttributes} */ (attributes);
                await api.bookmarks.set({
                    jid,
                    autojoin: true,
                    nick,
                    ...(password ? { password } : {}),
                    ...(name ? { name } : {}),
                });
            }
        );

        api.listen.on(
            'leaveRoom',
            /** @param {import('../muc/muc').default} muc */
            async ({ attributes }) => {
                const { jid } = /** @type {import("../muc/types").MUCAttributes} */ (attributes);
                await api.bookmarks.set(
                    {
                        jid,
                        autojoin: false,
                    },
                    false
                );
            }
        );

        api.listen.on('addClientFeatures', () => {
            if (api.settings.get('allow_bookmarks')) {
                api.disco.own.features.add(Strophe.NS.BOOKMARKS + '+notify');
            }
        });

        api.listen.on('clearSession', () => {
            const { state } = _converse;
            if (state.bookmarks) {
                state.bookmarks.clearStore({ 'silent': true });
                window.sessionStorage.removeItem(state.bookmarks.fetched_flag);
                delete state.bookmarks;
            }
        });

        api.listen.on('connected', async () => {
            // Add a handler for bookmarks pushed from other connected clients
            const bare_jid = _converse.session.get('bare_jid');
            const connection = api.connection.get();
            connection.addHandler(handleBookmarksPush, Strophe.NS.BOOKMARKS, 'message', 'headline', null, bare_jid);
            connection.addHandler(handleBookmarksPush, Strophe.NS.BOOKMARKS2, 'message', 'headline', null, bare_jid);
            await Promise.all([api.waitUntil('chatBoxesFetched')]);
            initBookmarks();
        });
    },
});
