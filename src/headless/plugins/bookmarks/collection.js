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
import log from '@converse/log';
import { initStorage } from '../../utils/storage.js';
import { parseStanzaForBookmarks } from './parsers.js';
import '../../plugins/muc/index.js';
import { getStorageKeys } from './utils.js';

const { Strophe, stx } = converse.env;

/**
 * The `<pinned/>` extension element (XEP-0469), serialized as a string.
 * Wrapped in a function so the namespace (registered in the plugin) is only
 * read at call time, not at module load.
 * @returns {string}
 */
const getPinnedExtension = () => `<pinned xmlns="${Strophe.NS.BOOKMARKS_PINNING}"/>`;

/**
 * @extends {Collection<Bookmark>}
 */
class Bookmarks extends Collection {
    get idAttribute() {
        return 'jid';
    }

    constructor() {
        super([], { comparator: (/** @type {Bookmark} */ b) => b.getDisplayName().toLowerCase() });
        this.model = Bookmark;
    }

    async initialize() {
        const { chatboxes } = _converse.state;

        this.on('add', (bm) =>
            this.openBookmarkedRoom(bm)
                .then((bm) => this.linkRoom(bm.get('jid')))
                .catch((e) => log.fatal(e)),
        );
        this.on('change:autojoin', this.onAutoJoinChanged, this);
        this.on(
            'remove',
            /** @param {Bookmark} bookmark */ (bookmark) => {
                chatboxes.get(bookmark.get('jid'))?.setBookmark?.(null);
                this.sendRemoveBookmarkStanza(bookmark);
                this.leaveRoom(bookmark);
            },
        );

        // A room may be opened *after* its bookmark already exists (e.g. a
        // non-autojoin bookmark that the user opens manually), so we link on
        // chatbox-add as well as on bookmark-add.
        this.listenTo(chatboxes, 'add', /** @param {MUC} cb */ (cb) => this.linkRoom(cb.get('jid')));

        const { storage_key, fetched_flag_key } = getStorageKeys();
        this.fetched_flag = fetched_flag_key;
        initStorage(this, storage_key);

        await this.fetchBookmarks();

        // Reconcile any rooms that were already open before the bookmarks
        // finished loading.
        chatboxes.forEach(/** @param {MUC} cb */ (cb) => this.linkRoom(cb.get('jid')));

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
     * @param {import('@converse/skeletor').FetchOrCreateOptions} [options]
     */
    async setBookmark(attrs, create = true, options = {}) {
        if (!attrs.jid) return log.warn('No JID provided for setBookmark');

        let send_stanza = false;

        let bookmark = this.get(attrs.jid);
        if (bookmark) {
            // Check if any attrs changed
            const has_changed = Object.keys(attrs).reduce((result, k) => {
                return result || (attrs[k] ?? '') !== (bookmark.attributes[k] ?? '');
            }, false);
            if (has_changed) {
                bookmark.save(attrs, options);
                send_stanza = true;
            }
        } else if (create) {
            bookmark = await this.create(attrs, options);
            send_stanza = true;
        }

        if (bookmark && send_stanza) {
            this.sendBookmarkStanza(bookmark).catch((iq) => this.onBookmarkError(iq));
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
            const stanza = stx`
                <iq from="${bare_jid}"
                    to="${bare_jid}"
                    type="set"
                    xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <retract node="${node}" notify="true">
                        <item id="${bookmark.get('jid')}"/>
                    </retract>
                </pubsub>
                </iq>`;
            return api.sendIQ(stanza);
        }

        return this.sendBookmarkStanza().catch((iq) => this.onBookmarkError(iq));
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
     * @param {Element} iq
     */
    onBookmarkError(iq) {
        log.error('Error while trying to update bookmarks');
        log.error(iq);
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
     * Associate an open room with its bookmark, if both exist. Safe to call
     * repeatedly (see {@link ModelWithBookmark#setBookmark}) and for any chatbox
     * type — non-MUC boxes simply have no `setBookmark` method.
     * @param {string} jid
     */
    linkRoom(jid) {
        const { chatboxes } = _converse.state;
        chatboxes.get(jid)?.setBookmark?.(this.get(jid) ?? null);
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
            const { __ } = _converse;
            log.error('Error: timeout while fetching bookmarks');
            api.alert('error', __('Timeout Error'), [
                __(
                    'The server did not return your bookmarks within the allowed time. ' +
                        'You can reload the page to request them again.',
                ),
            ]);
            deferred?.reject(new Error('Could not fetch bookmarks'));
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
     * Pin a bookmark to the top of the lists (XEP-0469) by adding a `<pinned/>`
     * element to its extensions. The `pinned` attribute is derived from the
     * extensions by {@link Bookmark}, so we only need to update the latter.
     * @param {Bookmark} bookmark
     * @returns {Promise<void|Element>}
     */
    pinBookmark(bookmark) {
        if (bookmark.get('pinned')) return Promise.resolve();
        const extensions = [...(bookmark.get('extensions') ?? []), getPinnedExtension()];
        return api.bookmarks.set({ jid: bookmark.get('jid'), extensions });
    }

    /**
     * Pin a room to the top of the lists (XEP-0469). Pinning is an extension on
     * a bookmark, so if the room isn't bookmarked yet we bookmark it first
     * (with autojoin enabled, so the pin survives a reload) and include the
     * `<pinned/>` extension in the same publish.
     * @param {string} jid
     * @returns {Promise<void|Element>}
     */
    pinRoom(jid) {
        const bookmark = this.get(jid);
        if (bookmark) return this.pinBookmark(bookmark);

        const room = _converse.state.chatboxes.get(jid);
        return api.bookmarks.set({
            jid,
            name: room?.get('name'),
            nick: room?.get('nick'),
            password: room?.get('password'),
            autojoin: true,
            extensions: [getPinnedExtension()],
        });
    }

    /**
     * Unpin a bookmark (XEP-0469) by removing its `<pinned/>` extension.
     * @param {Bookmark} bookmark
     * @returns {Promise<void|Element>}
     */
    unpinBookmark(bookmark) {
        const ns = Strophe.NS.BOOKMARKS_PINNING;
        const extensions = (bookmark.get('extensions') ?? []).filter(
            /** @param {string} e */ (e) => !(e.includes('<pinned') && e.includes(ns)),
        );
        return api.bookmarks.set({ jid: bookmark.get('jid'), extensions });
    }
}

export default Bookmarks;
