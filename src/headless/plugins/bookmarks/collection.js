/**
 * @typedef {import('../muc/muc.js').default} MUC
 */
import { Stanza } from 'strophe.js';
import { Collection } from '@converse/skeletor';
import { getOpenPromise } from '@converse/openpromise';
import Bookmark from './model.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from '../../log.js';
import { initStorage } from '../../utils/storage.js';
import { parseStanzaForBookmarks } from './parsers.js';
import '../../plugins/muc/index.js';

const { Strophe, stx } = converse.env;

class Bookmarks extends Collection {
    get idAttribute() {
        return 'jid';
    }

    async initialize() {
        this.on('add', (bm) =>
            this.openBookmarkedRoom(bm)
                .then((bm) => this.markRoomAsBookmarked(bm))
                .catch((e) => log.fatal(e))
        );
        this.on('remove', this.leaveRoom, this);
        this.on('change:autojoin', this.onAutoJoinChanged, this);
        this.on('remove', this.sendBookmarkStanza, this);

        const { session } = _converse;
        const cache_key = `converse.room-bookmarks${session.get('bare_jid')}`;
        this.fetched_flag = cache_key + 'fetched';
        initStorage(this, cache_key);

        await this.fetchBookmarks();

        /**
         * Triggered once the {@link Bookmarks} collection
         * has been created and cached bookmarks have been fetched.
         * @event _converse#bookmarksInitialized
         * @type {Bookmarks}
         * @example _converse.api.listen.on('bookmarksInitialized', (bookmarks) => { ... });
         */
        api.trigger('bookmarksInitialized', this);
    }

    static async checkBookmarksSupport() {
        const bare_jid = _converse.session.get('bare_jid');
        if (!bare_jid) return false;

        const identity = await api.disco.getIdentity('pubsub', 'pep', bare_jid);
        if (api.settings.get('allow_public_bookmarks')) {
            return !!identity;
        } else {
            return api.disco.supports(Strophe.NS.PUBSUB + '#publish-options', bare_jid);
        }
    }

    constructor() {
        super([], { comparator: (/** @type {Bookmark} */ b) => b.get('name').toLowerCase() });
        this.model = Bookmark;
    }

    /**
     * @param {Bookmark} bookmark
     */
    async openBookmarkedRoom(bookmark) {
        if (api.settings.get('muc_respect_autojoin') && bookmark.get('autojoin')) {
            const groupchat = await api.rooms.create(bookmark.get('jid'), {
                nick: bookmark.get('nick'),
                password: bookmark.get('password'),
            });
            groupchat.maybeShow();
        }
        return bookmark;
    }

    fetchBookmarks() {
        const deferred = getOpenPromise();
        if (window.sessionStorage.getItem(this.fetched_flag)) {
            this.fetch({
                success: () => deferred.resolve(),
                error: () => deferred.resolve(),
            });
        } else {
            this.fetchBookmarksFromServer(deferred);
        }
        return deferred;
    }

    /**
     * @param {import('./types').BookmarkAttrs} attrs
     */
    setBookmark(attrs, create=true) {
        if (!attrs.jid) return log.warn('No JID provided for setBookmark');

        let send_stanza = false;

        const existing = this.get(attrs.jid);
        if (existing) {
            // Check if any attrs changed
            const has_changed = Object.keys(attrs).reduce((result, k) => {
                return result || (attrs[k] ?? '') !== (existing.attributes[k] ?? '');
            }, false);
            if (has_changed) {
                existing.save(attrs);
                send_stanza = true;
            }
        } else if (create) {
            this.create(attrs);
            send_stanza = true;
        }
        if (send_stanza) {
            this.sendBookmarkStanza().catch((iq) => this.onBookmarkError(iq, attrs));
        }
    }

    /**
     * @param {'urn:xmpp:bookmarks:1'|'storage:bookmarks'} node
     * @returns {Stanza|Stanza[]}
     */
    getPublishedItems(node) {
        if (node === Strophe.NS.BOOKMARKS2) {
            return this.map(
                /** @param {MUC} model */ (model) => {
                    const extensions = model.get('extensions') ?? [];
                    return stx`<item id="${model.get('jid')}">
                    <conference xmlns="${Strophe.NS.BOOKMARKS2}"
                                name="${model.get('name')}"
                                autojoin="${model.get('autojoin')}">
                            ${model.get('nick') ? stx`<nick>${model.get('nick')}</nick>` : ''}
                            ${model.get('password') ? stx`<password>${model.get('password')}</password>` : ''}
                        ${
                            extensions.length
                                ? stx`<extensions>${extensions.map((e) => Stanza.unsafeXML(e))}</extensions>`
                                : ''
                        };
                        </conference>
                    </item>`;
                }
            );
        } else {
            return stx`<item id="current">
                <storage xmlns="${Strophe.NS.BOOKMARKS}">
                ${this.map(
                    /** @param {MUC} model */ (model) =>
                        stx`<conference name="${model.get('name')}" autojoin="${model.get('autojoin')}"
                        jid="${model.get('jid')}">
                        ${model.get('nick') ? stx`<nick>${model.get('nick')}</nick>` : ''}
                        ${model.get('password') ? stx`<password>${model.get('password')}</password>` : ''}
                    </conference>`
                )}
                </storage>
            </item>`;
        }
    }

    /**
     * @returns {Promise<void|Element>}
     */
    async sendBookmarkStanza() {
        const bare_jid = _converse.session.get('bare_jid');
        const node = (await api.disco.supports(`${Strophe.NS.BOOKMARKS2}#compat`, bare_jid))
            ? Strophe.NS.BOOKMARKS2
            : Strophe.NS.BOOKMARKS;
        return api.pubsub.publish(null, node, this.getPublishedItems(node), {
            persist_items: true,
            max_items: 'max',
            send_last_published_item: 'never',
            access_model: 'whitelist',
        });
    }

    /**
     * @param {Element} iq
     * @param {import('./types').BookmarkAttrs} attrs
     */
    onBookmarkError(iq, attrs) {
        const { __ } = _converse;
        log.error('Error while trying to add bookmark');
        log.error(iq);
        api.alert('error', __('Error'), [__('Sorry, something went wrong while trying to save your bookmark.')]);
        this.get(attrs.jid)?.destroy();
    }

    /**
     * @param {Promise} deferred
     */
    async fetchBookmarksFromServer(deferred) {
        const bare_jid = _converse.session.get('bare_jid');
        const ns = (await api.disco.supports(`${Strophe.NS.BOOKMARKS2}#compat`, bare_jid))
            ? Strophe.NS.BOOKMARKS2
            : Strophe.NS.BOOKMARKS;

        const stanza = stx`
            <iq type="get" from="${api.connection.get().jid}" xmlns="jabber:client">
                <pubsub xmlns="${Strophe.NS.PUBSUB}">
                    <items node="${ns}"/>
                </pubsub>
            </iq>`;
        api.sendIQ(stanza)
            .then(/** @param {Element} iq */ (iq) => this.onBookmarksReceived(deferred, iq))
            .catch(/** @param {Element} iq */ (iq) => this.onBookmarksReceivedError(deferred, iq));
    }

    /**
     * @param {Bookmark} bookmark
     */
    markRoomAsBookmarked(bookmark) {
        const { chatboxes } = _converse.state;
        const groupchat = chatboxes.get(bookmark.get('jid'));
        groupchat?.save('bookmarked', true);
    }

    /**
     * @param {Bookmark} bookmark
     */
    onAutoJoinChanged(bookmark) {
        if (bookmark.get('autojoin')) {
            this.openBookmarkedRoom(bookmark);
        } else {
            this.leaveRoom(bookmark);
        }
    }

    /**
     * @param {Bookmark} bookmark
     */
    async leaveRoom(bookmark) {
        const groupchat = await api.rooms.get(bookmark.get('jid'));
        groupchat?.close();
    }

    /**
     * @param {Element} stanza
     */
    async setBookmarksFromStanza(stanza) {
        const bookmarks = await parseStanzaForBookmarks(stanza);
        bookmarks.forEach(
            /** @param {import('./types.js').BookmarkAttrs} attrs */
            (attrs) => {
                const bookmark = this.get(attrs.jid);
                bookmark ? bookmark.save(attrs) : this.create(attrs);
            }
        );
    }

    /**
     * @param {Object} deferred
     * @param {Element} iq
     */
    async onBookmarksReceived(deferred, iq) {
        await this.setBookmarksFromStanza(iq);
        window.sessionStorage.setItem(this.fetched_flag, 'true');
        if (deferred !== undefined) {
            return deferred.resolve();
        }
    }

    /**
     * @param {Object} deferred
     * @param {Element} iq
     */
    onBookmarksReceivedError(deferred, iq) {
        const { __ } = _converse;
        if (iq === null) {
            log.error('Error: timeout while fetching bookmarks');
            api.alert('error', __('Timeout Error'), [
                __(
                    'The server did not return your bookmarks within the allowed time. ' +
                        'You can reload the page to request them again.'
                ),
            ]);
        } else if (deferred) {
            if (iq.querySelector('error[type="cancel"] item-not-found')) {
                // Not an exception, the user simply doesn't have any bookmarks.
                window.sessionStorage.setItem(this.fetched_flag, 'true');
                return deferred.resolve();
            } else {
                log.error('Error while fetching bookmarks');
                log.error(iq);
                return deferred.reject(new Error('Could not fetch bookmarks'));
            }
        } else {
            log.error('Error while fetching bookmarks');
            log.error(iq);
        }
    }

    async getUnopenedBookmarks() {
        await api.waitUntil('bookmarksInitialized');
        await api.waitUntil('chatBoxesFetched');
        const { chatboxes } = _converse.state;
        return this.filter((b) => !chatboxes.get(b.get('jid')));
    }
}

export default Bookmarks;
