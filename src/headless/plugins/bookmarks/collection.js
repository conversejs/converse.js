import "@converse/headless/plugins/muc/index.js";
import Bookmark from './model.js';
import log from "@converse/headless/log.js";
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";

const { Strophe, $iq, sizzle } = converse.env;
const u = converse.env.utils;


const Bookmarks = {

    model: Bookmark,
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
}

export default Bookmarks;
