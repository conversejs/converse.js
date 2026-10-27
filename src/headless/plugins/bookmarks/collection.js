/**
 * @typedef {import('../muc/muc.js').default} MUC
 */
import { nothing } from 'lit';
import { Stanza } from 'strophe.js';
import { Collection } from '@converse/skeletor';
import { getOpenPromise } from '@converse/openpromise';
import Bookmark from './model.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { parseErrorStanza } from '../../shared/parsers.js';
import { CodedError, StanzaError } from '../../shared/errors.js';
import log from '@converse/log';
import { initStorage } from '../../utils/storage.js';
import { isErrorStanza } from '../../utils/stanza.js';
import { parseStanzaForBookmarks } from './parsers.js';
import '../../plugins/muc/index.js';
import { getStorageKeys, isPinnedExtension } from './utils.js';

const { Strophe, stx } = converse.env;

/**
 * The `<pinned/>` extension element (XEP-0469), serialized as a string.
 * Wrapped in a function so the namespace (registered in the plugin) is only
 * read at call time, not at module load.
 * @returns {string}
 */
const getPinnedExtension = () => `<pinned xmlns="${Strophe.NS.BOOKMARKS_PINNING}"/>`;

/**
 * Returns a copy of an extensions list with any XEP-0469 `<pinned/>` element(s)
 * removed. Other (unknown) extensions are kept, as XEP-0402 requires.
 * @param {string[]} [extensions]
 * @returns {string[]}
 */
const withoutPinnedExtension = (extensions) => (extensions ?? []).filter((e) => !isPinnedExtension(e));

/**
 * @extends {Collection<Bookmark>}
 */
class Bookmarks extends Collection {
    #supports_pinning = false;

    get idAttribute() {
        return 'jid';
    }

    constructor() {
        super([], { comparator: (/** @type {Bookmark} */ b) => b.getDisplayName().toLowerCase() });
        this.model = Bookmark;
    }

    async initialize() {
        this.on('add', (bm) => this.openBookmarkedRoom(bm).catch((e) => log.fatal(e)));
        this.on('change:autojoin', this.onAutoJoinChanged, this);
        this.on(
            'remove',
            /**
             * @param {Bookmark} bookmark
             * @param {Bookmarks} _collection
             * @param {{ rollback?: boolean }} [options]
             */
            (bookmark, _collection, options) => {
                // A rolled back bookmark never reached the server, so there's
                // nothing to retract, and its room must stay open.
                if (options?.rollback) return;

                this.sendRemoveBookmarkStanza(bookmark);
                this.leaveRoom(bookmark);
            },
        );

        const { storage_key, fetched_flag_key } = getStorageKeys();
        this.fetched_flag = fetched_flag_key;
        initStorage(this, storage_key);

        const bare_jid = _converse.session.get('bare_jid');
        this.#supports_pinning = await api.disco.supports(`${Strophe.NS.BOOKMARKS2}#compat`, bare_jid);
        try {
            await this.fetchBookmarks();
        } catch (e) {
            if (/** @type {{code?: string}} */ (e).code !== 'bookmarks-timeout') throw e;
            /**
             * Triggered when the server did not return the bookmarks in time.
             * The error's `code` is `bookmarks-timeout`, which the client maps to its own text.
             * @event _converse#bookmarksFetchFailed
             * @type {Error}
             * @example _converse.api.listen.on('bookmarksFetchFailed', (e) => { ... });
             */
            api.trigger('bookmarksFetchFailed', e);
            return;
        }

        /**
         * Triggered once the {@link Bookmarks} collection
         * has been created and cached bookmarks have been fetched.
         * @event _converse#bookmarksInitialized
         * @type {Bookmarks}
         * @example _converse.api.listen.on('bookmarksInitialized', (bookmarks) => { ... });
         */
        api.trigger('bookmarksInitialized', this);
    }

    /** @returns {boolean} Whether the server supports native bookmarks and their extensions. */
    supportsPinning() {
        return this.#supports_pinning;
    }

    #assertPinningSupported() {
        if (!this.supportsPinning()) {
            throw new Error('Pinning requires native bookmarks');
        }
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
        if (_converse.state.session.get(this.fetched_flag)) {
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
     * @param {boolean} [create=true]
     * @param {import('./types').SetBookmarkOptions} [options]
     * @returns {Promise<Bookmark|undefined>}
     */
    async setBookmark(attrs, create = true, options = {}) {
        if (!attrs.jid) {
            log.warn('No JID provided for setBookmark');
            return;
        }

        const persistence_options = { ...options, promise: true };
        let send_stanza = false;
        let bookmark = this.get(attrs.jid);
        // The changed attributes' previous values, or `null` for a new bookmark
        let previous = null;

        try {
            if (bookmark) {
                // Check if any attrs changed
                const has_changed = Object.keys(attrs).reduce((result, k) => {
                    return result || (attrs[k] ?? '') !== (bookmark.attributes[k] ?? '');
                }, false);
                if (has_changed) {
                    previous = Object.fromEntries(Object.keys(attrs).map((k) => [k, bookmark.get(k)]));
                    await bookmark.save(attrs, persistence_options);
                    send_stanza = true;
                }
            } else if (create) {
                bookmark = await this.create(attrs, persistence_options);
                send_stanza = true;
            }

            if (bookmark && send_stanza) {
                try {
                    await this.sendBookmarkStanza(bookmark);
                } catch (error) {
                    // Only a refusal tells us the server doesn't have the
                    // change. After a timeout it might, so we keep it.
                    const refused = isErrorStanza(error) || error instanceof StanzaError;
                    if (refused && !options.keep_on_error) {
                        await this.#rollBack(bookmark, previous, options);
                    }
                    throw error;
                }
            }
            return bookmark;
        } catch (error) {
            this.onBookmarkError(error);
            throw error;
        }
    }

    /**
     * Undoes a local bookmark change that the server didn't accept, so that
     * our bookmarks don't claim something the server doesn't have.
     * @param {Bookmark} bookmark
     * @param {Object|null} previous - The changed attributes' previous values,
     *  or `null` if the bookmark was newly created.
     * @param {import('./types').SetBookmarkOptions} options
     */
    async #rollBack(bookmark, previous, options) {
        try {
            if (previous) {
                await bookmark.save(previous, /** @type {Object} */ ({ ...options, rollback: true, promise: true }));
            } else {
                await new Promise((success, error) =>
                    bookmark.destroy(/** @type {Object} */ ({ rollback: true, success, error })),
                );
            }
        } catch (e) {
            log.error('Could not roll back a bookmark that failed to publish');
            log.error(e);
        }
    }

    /**
     * @param {Bookmark} bookmark
     * @returns {Promise<void|Element>}
     */
    async sendRemoveBookmarkStanza(bookmark) {
        const bare_jid = _converse.session.get('bare_jid');
        const node = (await api.disco.supports(`${Strophe.NS.BOOKMARKS2}#compat`, bare_jid))
            ? Strophe.NS.BOOKMARKS2
            : Strophe.NS.BOOKMARKS;

        if (node === Strophe.NS.BOOKMARKS2) {
            return api.pubsub.retract(bare_jid, node, bookmark.get('jid'), { notify: true });
        } else {
            return this.sendBookmarkStanza().catch((iq) => this.onBookmarkError(iq));
        }
    }

    /**
     * @param {'urn:xmpp:bookmarks:1'|'storage:bookmarks'} node
     * @param {Bookmark} [bookmark]
     * @returns {Stanza|Stanza[]}
     */
    getPublishedItems(node, bookmark) {
        if (node === Strophe.NS.BOOKMARKS2) {
            if (!bookmark) throw new Error('getPublishedItems: missing bookmark');

            // Parse each extension defensively
            const extensions = (bookmark.get('extensions') ?? [])
                .map(
                    /** @param {string} e */ (e) => {
                        try {
                            return Stanza.fromString(e);
                        } catch (err) {
                            log.error(`Ignoring invalid bookmark extension: ${e}`);
                            log.error(err);
                            return null;
                        }
                    },
                )
                .filter(Boolean);
            return stx`<item id="${bookmark.get('jid')}">
                        <conference xmlns="${Strophe.NS.BOOKMARKS2}"
                                name="${bookmark.get('name') || nothing}"
                                autojoin="${bookmark.get('autojoin')}">
                            ${bookmark.get('nick') ? stx`<nick>${bookmark.get('nick')}</nick>` : ''}
                            ${bookmark.get('password') ? stx`<password>${bookmark.get('password')}</password>` : ''}
                        ${extensions.length ? stx`<extensions>${extensions}</extensions>` : ''}
                        </conference>
                    </item>`;
        } else {
            return stx`<item id="current">
                <storage xmlns="${Strophe.NS.BOOKMARKS}">
                ${this.map(
                    /** @param {MUC} model */ (model) =>
                        stx`<conference name="${model.get('name')}" autojoin="${model.get('autojoin')}"
                        jid="${model.get('jid')}">
                        ${model.get('nick') ? stx`<nick>${model.get('nick')}</nick>` : ''}
                        ${model.get('password') ? stx`<password>${model.get('password')}</password>` : ''}
                    </conference>`,
                )}
                </storage>
            </item>`;
        }
    }

    /**
     * @param {Bookmark} [bookmark]
     * @returns {Promise<void|Element>}
     */
    async sendBookmarkStanza(bookmark) {
        const bare_jid = _converse.session.get('bare_jid');
        const node = (await api.disco.supports(`${Strophe.NS.BOOKMARKS2}#compat`, bare_jid))
            ? Strophe.NS.BOOKMARKS2
            : Strophe.NS.BOOKMARKS;
        const supports_max = await api.disco.supports(`${Strophe.NS.PUBSUB}#config-node-max`, bare_jid);
        return api.pubsub.publish(null, node, this.getPublishedItems(node, bookmark), {
            persist_items: true,
            max_items: supports_max ? 'max' : 9999,
            send_last_published_item: 'never',
            access_model: 'whitelist',
        });
    }

    /**
     * @param {Element|Error} error
     */
    onBookmarkError(error) {
        log.error('Error while trying to update bookmarks');
        log.error(error);
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
     * @param {boolean} _autojoin
     * @param {{ rollback?: boolean }} [options]
     */
    onAutoJoinChanged(bookmark, _autojoin, options) {
        // A rolled back change never reached the server, so the room should
        // stay as the user left it.
        if (options?.rollback) return;

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
            },
        );
    }

    /**
     * @param {Object} deferred
     * @param {Element} iq
     */
    async onBookmarksReceived(deferred, iq) {
        await this.setBookmarksFromStanza(iq);
        _converse.state.session.set(this.fetched_flag, true);
        if (deferred !== undefined) {
            return deferred.resolve();
        }
    }

    /**
     * @param {Object} deferred
     * @param {Element} iq
     */
    async onBookmarksReceivedError(deferred, iq) {
        if (iq === null) {
            log.error('Error: timeout while fetching bookmarks');
            deferred?.reject(new CodedError('bookmarks-timeout', 'Timeout while fetching bookmarks'));
        } else {
            const { errors } = converse.env;
            const e = await parseErrorStanza(iq);
            if (e instanceof errors.ItemNotFoundError) {
                // Not an exception, the user simply doesn't have any bookmarks.
                _converse.state.session.set(this.fetched_flag, true);
                deferred?.resolve();
            } else {
                log.error('Error while fetching bookmarks');
                if (iq) log.error(iq);
                deferred?.reject(new Error('Could not fetch bookmarks'));
            }
        }
    }

    async getUnopenedBookmarks() {
        await api.waitUntil('bookmarksInitialized');
        await api.waitUntil('chatBoxesFetched');
        const { chatboxes } = _converse.state;
        return this.filter((b) => !chatboxes.get(b.get('jid')));
    }

    /**
     * Pin a bookmark to the top of the lists (XEP-0469) by ensuring exactly one
     * `<pinned/>` element is present in its extensions. We always (re)publish,
     * even when the bookmark already looks pinned locally: the operation is
     * idempotent (any existing `<pinned/>` is stripped before re-adding a single
     * one, so it can't accumulate duplicates) and self-healing if our local
     * state and the server's have diverged. The `pinned` attribute is derived
     * from the extensions by {@link Bookmark}.
     * @param {Bookmark} bookmark
     * @returns {Promise<Bookmark|undefined>}
     */
    async pinBookmark(bookmark) {
        this.#assertPinningSupported();
        const extensions = [...withoutPinnedExtension(bookmark.get('extensions')), getPinnedExtension()];
        return await api.bookmarks.set({ jid: bookmark.get('jid'), extensions });
    }

    /**
     * Pin a room to the top of the lists (XEP-0469). Pinning is an extension on
     * a bookmark, so if the room isn't bookmarked yet we bookmark it first
     * (with autojoin enabled, so the pin survives a reload) and include the
     * `<pinned/>` extension in the same publish.
     * @param {string} jid
     * @returns {Promise<Bookmark|undefined>}
     */
    async pinRoom(jid) {
        this.#assertPinningSupported();
        const bookmark = this.get(jid);
        if (bookmark) return await this.pinBookmark(bookmark);

        const room = _converse.state.chatboxes.get(jid);
        return await api.bookmarks.set({
            jid,
            name: room?.get('name'),
            nick: room?.get('nick'),
            password: room?.get('password'),
            autojoin: true,
            extensions: [getPinnedExtension()],
        });
    }

    /**
     * Unpin a room by its JID (XEP-0469). A no-op if the room isn't bookmarked
     * (you can only unpin something that was pinned, which requires a bookmark).
     * @param {string} jid
     * @returns {Promise<Bookmark|undefined>}
     */
    async unpinRoom(jid) {
        this.#assertPinningSupported();
        const bookmark = this.get(jid);
        if (bookmark) return await this.unpinBookmark(bookmark);
    }

    /**
     * Unpin a bookmark (XEP-0469) by removing its `<pinned/>` extension.
     * Idempotent and self-healing for the same reasons as {@link pinBookmark}.
     * @param {Bookmark} bookmark
     * @returns {Promise<Bookmark|undefined>}
     */
    async unpinBookmark(bookmark) {
        this.#assertPinningSupported();
        const extensions = withoutPinnedExtension(bookmark.get('extensions'));
        return await api.bookmarks.set({ jid: bookmark.get('jid'), extensions });
    }
}

export default Bookmarks;
