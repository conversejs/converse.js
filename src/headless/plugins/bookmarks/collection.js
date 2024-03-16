import "../../plugins/muc/index.js";
import Bookmark from './model.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from "../../log.js";
import { Collection } from "@converse/skeletor";
import { getOpenPromise } from '@converse/openpromise';
import { initStorage } from '../../utils/storage.js';

const { Strophe, $iq, sizzle } = converse.env;


class Bookmarks extends Collection {

    constructor () {
        super([], { comparator: (/** @type {Bookmark} */b) => b.get('name').toLowerCase() });
        this.model = Bookmark;
    }

    async initialize () {
        this.on('add', bm => this.openBookmarkedRoom(bm)
            .then(bm => this.markRoomAsBookmarked(bm))
            .catch(e => log.fatal(e))
        );

        this.on('remove', this.markRoomAsUnbookmarked, this);
        this.on('remove', this.sendBookmarkStanza, this);

        const { session } = _converse;
        const cache_key = `converse.room-bookmarks${session.get('bare_jid')}`;
        this.fetched_flag = cache_key+'fetched';
        initStorage(this, cache_key);

        await this.fetchBookmarks();

        /**
         * Triggered once the _converse.Bookmarks collection
         * has been created and cached bookmarks have been fetched.
         * @event _converse#bookmarksInitialized
         * @type { Bookmarks }
         * @example _converse.api.listen.on('bookmarksInitialized', (bookmarks) => { ... });
         */
        api.trigger('bookmarksInitialized', this);
    }

    /**
     * @param {Bookmark} bookmark
     */
    async openBookmarkedRoom (bookmark) {
        if ( api.settings.get('muc_respect_autojoin') && bookmark.get('autojoin')) {
            const groupchat = await api.rooms.create(
                bookmark.get('jid'),
                {'nick': bookmark.get('nick')}
            );
            groupchat.maybeShow();
        }
        return bookmark;
    }

    fetchBookmarks () {
        const deferred = getOpenPromise();
        if (window.sessionStorage.getItem(this.fetched_flag)) {
            this.fetch({
                'success': () => deferred.resolve(),
                'error': () => deferred.resolve()
            });
        } else {
            this.fetchBookmarksFromServer(deferred);
        }
        return deferred;
    }

    createBookmark (options) {
        this.create(options);
        this.sendBookmarkStanza().catch(iq => this.onBookmarkError(iq, options));
    }

    sendBookmarkStanza () {
        const stanza = $iq({
                'type': 'set',
                'from': api.connection.get().jid,
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
    }

    onBookmarkError (iq, options) {
        const { __ } = _converse;
        log.error("Error while trying to add bookmark");
        log.error(iq);
        api.alert(
            'error', __('Error'), [__("Sorry, something went wrong while trying to save your bookmark.")]
        );
        this.get(options.jid)?.destroy();
    }

    fetchBookmarksFromServer (deferred) {
        const stanza = $iq({
            'from': api.connection.get().jid,
            'type': 'get',
        }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
            .c('items', {'node': Strophe.NS.BOOKMARKS});
        api.sendIQ(stanza)
            .then(iq => this.onBookmarksReceived(deferred, iq))
            .catch(iq => this.onBookmarksReceivedError(deferred, iq)
        );
    }

    /**
     * @param {Bookmark} bookmark
     */
    markRoomAsBookmarked (bookmark) {
        const { chatboxes } = _converse.state;
        const groupchat = chatboxes.get(bookmark.get('jid'));
        groupchat?.save('bookmarked', true);
    }

    /**
     * @param {Bookmark} bookmark
     */
    markRoomAsUnbookmarked (bookmark) {
        const { chatboxes } = _converse.state;
        const groupchat = chatboxes.get(bookmark.get('jid'));
        groupchat?.save('bookmarked', false);
    }

    /**
     * @param {Element} stanza
     */
    createBookmarksFromStanza (stanza) {
        const xmlns = Strophe.NS.BOOKMARKS;
        const sel = `items[node="${xmlns}"] item storage[xmlns="${xmlns}"] conference`;
        sizzle(sel, stanza).forEach(/** @type {Element} */(el) => {
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
    }

    onBookmarksReceived (deferred, iq) {
        this.createBookmarksFromStanza(iq);
        window.sessionStorage.setItem(this.fetched_flag, 'true');
        if (deferred !== undefined) {
            return deferred.resolve();
        }
    }

    onBookmarksReceivedError (deferred, iq) {
        const { __ } = _converse;
        if (iq === null) {
            log.error('Error: timeout while fetching bookmarks');
            api.alert('error', __('Timeout Error'),
                [__("The server did not return your bookmarks within the allowed time. "+
                    "You can reload the page to request them again.")]
            );
        } else if (deferred) {
            if (iq.querySelector('error[type="cancel"] item-not-found')) {
                // Not an exception, the user simply doesn't have any bookmarks.
                window.sessionStorage.setItem(this.fetched_flag, 'true');
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
    }

    async getUnopenedBookmarks () {
        await api.waitUntil('bookmarksInitialized')
        await api.waitUntil('chatBoxesFetched')
        const { chatboxes } = _converse.state;
        return this.filter(b => !chatboxes.get(b.get('jid')));
    }
}

export default Bookmarks;
