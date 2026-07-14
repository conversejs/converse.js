/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import sizzle from 'sizzle';
import { Strophe } from 'strophe.js';
import log from '@converse/log';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import { RSM } from '../../shared/rsm.js';
import { publishFollow, readFollowing, retractFollow } from './utils/following.js';
import { parseFeedAddress as parseAddress } from './utils.js';
import { comment_summary_queue, syncCommentSummary } from './comment-summary.js';
import MicroblogProfile from './profile.js';
import PubSubFeed from './feed.js';
import PubSubFeeds from './feeds.js';
import { parseAtomEntry } from './parsers.js';
import { getUniqueId } from '../../utils/index.js';
import { safeSave } from '../../utils/init.js';
import {
    BROWSE_PAGE_SIZE,
    COMMENTS_NODE_PREFIX,
    FOLLOWABLE_PROBE_TIMEOUT,
    FOLLOWABLE_SCAN_CONCURRENCY,
    LIKE_MARKER,
    MICROBLOG_NODE,
    NS_ATOM,
    SOCIAL_FEED_FEATURE,
} from './constants.js';

/**
 * Probe a JID's PubSub node to learn whether it holds a followable feed. Resolves
 * to a verdict, used by the followable cache and by {@link followByAddress}. A
 * node that returns at least one item is followable (and yields a preview
 * timestamp); an empty node, a missing node, or an access error is not.
 * @param {string} jid - The feed's JID (a contact's bare JID, or a pubsub service).
 * @param {string} [node=MICROBLOG_NODE] - The node to probe.
 * @returns {Promise<{ followable: boolean, latest?: string|null }>}
 */
async function probeFeed(jid, node = MICROBLOG_NODE) {
    try {
        const result = await api.pubsub.items.get(jid, node, {
            max_items: 1,
            timeout: FOLLOWABLE_PROBE_TIMEOUT,
        });
        const item = result?.items?.[0];
        if (!item) return { followable: false };
        let latest = null;
        try {
            latest = parseAtomEntry(item, { from: jid, node })?.time ?? null;
        } catch (e) {
            // The preview timestamp is best-effort; ignore a parse failure.
            log.debug(`probeFeed: could not parse latest item for ${jid} (${node}): ${e}`);
        }
        return { followable: true, latest };
    } catch (e) {
        log.debug(`probeFeed: ${jid} has no readable feed at ${node}: ${e}`);
        return { followable: false };
    }
}

/**
 * Fetch one pubsub node's disco#info and distil the XEP-0060 § 5.4 metadata form
 * into the fields the browse UI needs. Best-effort: a node that doesn't answer,
 * or carries no metadata form, resolves to `is_feed: false`.
 * @param {string} jid - The pubsub service JID.
 * @param {string} node - The node id to inspect.
 * @returns {Promise<Partial<import('./types').BrowsableFeed>>}
 */
async function probeNodeMeta(jid, node) {
    try {
        const stanza = await api.disco.info(jid, node, { timeout: FOLLOWABLE_PROBE_TIMEOUT });
        const field = /** @param {string} name */ (name) =>
            sizzle(`x[type="result"] field[var="${name}"] value`, stanza)[0]?.textContent || undefined;
        const node_type = sizzle(`identity[category="pubsub"]`, stanza)[0]?.getAttribute('type') || undefined;
        const type = field('pubsub#type');
        const subs = field('pubsub#num_subscribers');
        const num_subscribers = subs !== undefined && subs !== '' ? Number(subs) : undefined;
        return {
            title: field('pubsub#title'),
            description: field('pubsub#description'),
            type,
            node_type,
            num_subscribers,
            // A leaf node carrying Atom payloads is a social/microblog feed. Nodes
            // that omit `pubsub#type` (or are collections) fall under "show all".
            is_feed: type === NS_ATOM,
        };
    } catch (e) {
        log.debug(`browseFeeds: could not read node meta for ${jid} (${node}): ${e}`);
        return { is_feed: false };
    }
}

export default {
    /**
     * The "microblog" namespace groups methods relevant to XEP-0277
     * Microblogging.
     *
     * @namespace _converse.api.microblog
     * @memberOf _converse.api
     */
    microblog: {
        feeds: {
            /**
             * Get (creating if necessary) a microblog feed for a JID + node.
             * @method _converse.api.microblog.feeds.get
             * @param {string} [jid] - The feed's JID. Defaults to the logged-in
             *      user's bare JID (their own microblog).
             * @param {string} [node='urn:xmpp:microblog:0']
             * @param {boolean} [create=true]
             * @returns {Promise<import('./feed').default|undefined>}
             */
            async get(jid, node = MICROBLOG_NODE, create = true) {
                await api.waitUntil('pubsubFeedsInitialized');
                const bare_jid = _converse.session.get('bare_jid');
                return _converse.state.pubsubfeeds.getFeed(jid || bare_jid, node, create);
            },

            /**
             * Get the logged-in user's own microblog feed.
             * @method _converse.api.microblog.feeds.own
             * @returns {Promise<import('./feed').default>}
             */
            async own() {
                return await api.microblog.feeds.get();
            },
        },

        profile: {
            /**
             * Get (creating + caching if necessary) the profile model for an
             * author's JID. The person behind a feed (avatar, display name,
             * colour), resolved from the vCard cache like a post's author is.
             * Backs the Social app's profile view and works for non-contacts too.
             * @method _converse.api.microblog.profile.get
             * @param {string} jid - The author's (bare) JID.
             * @returns {import('./profile').default}
             */
            get(jid) {
                return MicroblogProfile.getProfile(jid);
            },

            /**
             * Get a feed suitable for an author's profile view.
             *
             * When we follow the author (or it's our own), this is the *shared* feed
             * from {@link _converse.state.pubsubfeeds}. When we don't follow them,
             * it's a **detached**, browse-only feed that is deliberately *not* added
             * to that collection (it stays in-memory only). Either way the caller
             * should {@link PubSubFeed.fetchPosts} to backfill it.
             * @method _converse.api.microblog.profile.feed
             * @param {string} jid - The author's (bare) JID.
             * @param {string} [node=MICROBLOG_NODE]
             * @returns {Promise<import('./feed').default>}
             */
            async getFeed(jid, node = MICROBLOG_NODE) {
                await api.waitUntil('pubsubFeedsInitialized');
                const bare_jid = _converse.session.get('bare_jid');
                const shared = _converse.state.pubsubfeeds?.getFeed(jid || bare_jid, node, false);
                return shared || new PubSubFeed({ jid, node, in_memory: true });
            },
        },

        /**
         * Whether a JID can be followed, i.e. it advertises a XEP-0472 social
         * feed (`urn:xmpp:pubsub-social-feed:1`).
         *
         * A social feed is advertised in a client's per-resource XEP-0115 entity
         * caps, not on the bare-JID account disco#info, so we resolve the feature
         * against the contact's resources (full JIDs).
         *
         * @method _converse.api.microblog.canFollow
         * @param {string} jid
         * @returns {Promise<boolean>}
         */
        async canFollow(jid) {
            const bare_jid = _converse.session.get('bare_jid');
            const contact_jid = Strophe.getBareJidFromJid(jid);
            if (contact_jid === bare_jid) return false;

            const full_jids = Strophe.getResourceFromJid(jid)
                ? [jid]
                : (_converse.state.presences
                      ?.get(contact_jid)
                      ?.resources?.map((r) => `${contact_jid}/${r.get('name')}`) ?? []);

            for (const full_jid of full_jids) {
                if (await api.disco.supports(SOCIAL_FEED_FEATURE, full_jid)) return true;
            }
            return false;
        },

        /**
         * Discover roster contacts that can be followed but aren't yet — the
         * union of two sources, minus contacts already followed or snoozed:
         *  1. the cheap online path: contacts whose live resources advertise a
         *     XEP-0472 social feed ({@link canFollow}); and
         *  2. verdicts learned by the manual {@link scanFollowable} sweep, read
         *     from the persistent followable cache (covers offline contacts).
         *
         * No network is used here: (1) reads cached entity caps and (2) reads
         * the local cache, so it's safe to recompute on roster/presence/cache
         * changes. The explicit sweep is what issues the probes.
         * @method _converse.api.microblog.discoverFollowable
         * @returns {Promise<string[]>} The bare JIDs of followable contacts.
         */
        async discoverFollowable() {
            const roster = _converse.state.roster;
            if (!roster) return [];
            const cache = _converse.state.followablecache;

            const candidates = roster.filter((c) => !c.isUnsaved() && !c.get('requesting'));
            const online = await Promise.all(
                candidates.map(async (contact) => {
                    const jid = contact.get('jid');
                    if (api.microblog.isFollowing(jid)) return null;
                    return (await api.microblog.canFollow(jid)) ? jid : null;
                }),
            );

            const cached = cache?.candidates() ?? [];
            const jids = [...new Set([...online.filter(Boolean), ...cached])];
            return jids.filter((jid) => !api.microblog.isFollowing(jid) && !cache?.isSnoozed(jid));
        },

        /**
         * Probe roster contacts' microblog nodes to discover followable feeds,
         * including OFFLINE contacts that {@link discoverFollowable}'s cheap path
         * can't see (it only reads online resources' caps). An explicit,
         * user-initiated sweep: it targets every saved, not-yet-followed contact
         * without a fresh cached verdict, probes each `urn:xmpp:microblog:0` node
         * with bounded concurrency, and caches each verdict so re-scans are cheap.
         * (A contact whose node isn't readable simply caches as not-followable.)
         *
         * @method _converse.api.microblog.scanFollowable
         * @param {object} [opts]
         * @param {(p: {scanned: number, total: number, found: number}) => void} [opts.onProgress]
         * @param {AbortSignal} [opts.signal] - Abort to stop launching further probes.
         * @returns {Promise<string[]>} The bare JIDs found followable in this sweep.
         */
        async scanFollowable({ onProgress, signal } = {}) {
            const roster = _converse.state.roster;
            const cache = _converse.state.followablecache;
            if (!roster) return [];

            // Re-probe every saved contact we don't already follow. The sweep is
            // an explicit user action, so it deliberately re-checks contacts seen
            // before — a previously-empty node may now have posts, and the user
            // expects the button to actually do something each time.
            const targets = roster
                .filter((c) => !c.isUnsaved() && !c.get('requesting'))
                .map((c) => c.get('jid'))
                .filter((jid) => !api.microblog.isFollowing(jid));

            const found = [];
            const total = targets.length;
            let scanned = 0;
            onProgress?.({ scanned, total, found: 0 });

            // A streaming worker pool (rather than fixed batches): each worker pulls
            // the next contact as soon as its probe settles, so one slow/timing-out
            // probe never holds up the others. Probes carry a short timeout, so a
            // dead server frees its worker in seconds, not the default 60s.
            const queue = [...targets];
            const worker = async () => {
                while (queue.length && !signal?.aborted) {
                    const jid = queue.shift();
                    const verdict = await probeFeed(jid);
                    cache?.record(jid, verdict);
                    if (verdict.followable) found.push(jid);
                    scanned++;
                    onProgress?.({ scanned, total, found: found.length });
                }
            };
            const pool = Array.from({ length: Math.min(FOLLOWABLE_SCAN_CONCURRENCY, total) }, () => worker());
            await Promise.all(pool);
            return found;
        },

        /**
         * Follow a a social feed and record it in the durable XEP-0330 list.
         * Subscribe for live delivery (XEP-0472) and create + backfill the feed.
         *
         * @method _converse.api.microblog.follow
         * @param {string} jid - The followed entity's JID (a contact's bare JID).
         * @param {object} [options]
         * @param {string} [options.title] - A human-readable label for the follow.
         * @param {string} [options.node=MICROBLOG_NODE] - The node to follow.
         * @returns {Promise<import('./feed').default|undefined>}
         */
        async follow(jid, { title, node = MICROBLOG_NODE } = {}) {
            await publishFollow(jid, node, title);
            // Mirror the durable follow locally so isFollowing reflects it at once.
            _converse.state.following?.track({ server: jid, node, title });
            try {
                await api.pubsub.subscribe(jid, node);
            } catch (e) {
                // Explicit subscription is the live-delivery path. If a server
                // doesn't honour cross-account PEP subscriptions this is
                // non-fatal: the XEP-0330 list is the durable record of the
                // follow, and the items.get backfill below still populates the
                // feed (and is the source of history regardless, since the node
                // config is send_last_published_item=never).
                log.debug(`api.microblog.follow: explicit subscribe to ${jid} failed (non-fatal): ${e}`);
            }
            const feed = await api.microblog.feeds.get(jid, node, true);
            feed?.fetchPosts();
            return feed;
        },

        /**
         * Follow several feeds in sequence (see {@link follow}). Sequential
         * rather than parallel so we don't fire N publish+subscribe+backfill
         * bursts at the server at once. Never rejects: each entry's outcome is
         * reported in the returned array, so one failure doesn't abort the rest.
         *
         * @method _converse.api.microblog.followMany
         * @param {string[]} jids - The bare JIDs to follow.
         * @returns {Promise<Array<{ jid: string, ok: boolean, error?: Error }>>}
         */
        async followMany(jids) {
            const results = [];
            for (const jid of jids ?? []) {
                try {
                    await api.microblog.follow(jid);
                    results.push({ jid, ok: true });
                } catch (error) {
                    log.error(error);
                    results.push({ jid, ok: false, error });
                }
            }
            return results;
        },

        /**
         * Parse a feed address into a `{ jid, node }` pair, or null if it isn't a
         * usable address. Accepts a bare JID (a user or a pubsub service, which
         * defaults to the PEP microblog node) or an XMPP pubsub URI carrying an
         * explicit node (`xmpp:pubsub.example.org?;node=news`). Exposed so the
         * "Follow a feed" UI can validate and preview input as it's typed.
         * @method _converse.api.microblog.parseFeedAddress
         * @param {string} address
         * @returns {{ jid: string, node: string }|null}
         */
        parseFeedAddress(address) {
            return parseAddress(address);
        },

        /**
         * Follow a feed given a free-form address (a bare JID or an XMPP pubsub
         * node URI), probing it first so an unreadable or missing node fails loudly
         * rather than adding an empty feed. This is the entry point for following
         * feeds that aren't roster contacts, e.g. a community or news node on a
         * pubsub service.
         *
         * @method _converse.api.microblog.followByAddress
         * @param {string} address - A bare JID or `xmpp:` pubsub URI.
         * @param {object} [options]
         * @param {string} [options.node] - Overrides the node parsed from the address.
         * @param {string} [options.title] - A human-readable label for the follow.
         * @returns {Promise<import('./feed').default|undefined>}
         * @throws {Error} named `InvalidFeedAddress` if the address can't be parsed,
         *      or `FeedNotFound` if the node has no readable feed.
         */
        async followByAddress(address, { node, title } = {}) {
            const parsed = parseAddress(address);
            if (!parsed) {
                throw Object.assign(new Error(`Not a valid feed address: ${address}`), {
                    name: 'InvalidFeedAddress',
                });
            }
            const target_node = node || parsed.node;
            const { followable } = await probeFeed(parsed.jid, target_node);
            if (!followable) {
                throw Object.assign(new Error(`No readable feed at ${parsed.jid} (${target_node})`), {
                    name: 'FeedNotFound',
                });
            }
            return api.microblog.follow(parsed.jid, { node: target_node, title });
        },

        /**
         * Browse one page of the feed nodes hosted on a PubSub service. Sends
         * disco#items to list the service's nodes (XEP-0060 § 5.5 Discover Nodes),
         * then probes each node's disco#info (§ 5.4 meta-data) with bounded
         * concurrency to learn its title, description, payload type and subscriber
         * count.
         *
         * A busy service returns its nodes one page at a time via XEP-0059 RSM, so
         * this fetches a single page and returns the server's `<last>` cursor plus
         * `has_more`; the caller pages by calling again with `after: cursor`. RSM is
         * the only standard way to bound a disco#items query, so a service without
         * it just returns its nodes in one unpaged batch (no cursor, `has_more`
         * false).
         *
         * @method _converse.api.microblog.browseFeeds
         * @param {string} service_jid - A pubsub service JID (or any JID that
         *      answers disco#items with a node list).
         * @param {object} [opts]
         * @param {string} [opts.after] - RSM cursor from a previous page's `cursor`
         *      (omit for the first page).
         * @param {number} [opts.max=BROWSE_PAGE_SIZE] - Page size (RSM `max`).
         * @param {(p: {probed: number, total: number}) => void} [opts.onProgress]
         * @param {AbortSignal} [opts.signal] - Abort to stop probing further nodes.
         * @returns {Promise<import('./types.ts').BrowseFeedsResult>}
         * @throws {Error} named `InvalidFeedAddress` if `service_jid` isn't usable.
         */
        async browseFeeds(service_jid, { after, max = BROWSE_PAGE_SIZE, onProgress, signal } = {}) {
            const jid = Strophe.getBareJidFromJid(service_jid?.trim() || '') || service_jid?.trim();
            const domain = Strophe.getDomainFromJid(jid || '');
            if (!jid || !domain?.includes('.')) {
                throw Object.assign(new Error(`Not a valid service address: ${service_jid}`), {
                    name: 'InvalidFeedAddress',
                });
            }

            // 1. List one page of the service's nodes (XEP-0060 § 5.5) via RSM. Only
            //    items carrying a `node` attribute are pubsub nodes (a bare-JID item
            //    is a child entity, not a feed).
            const items_iq = await api.disco.items(jid, undefined, {
                rsm: { max, ...(after ? { after } : {}) },
                timeout: FOLLOWABLE_PROBE_TIMEOUT,
            });
            const page = sizzle(`query[xmlns="${Strophe.NS.DISCO_ITEMS}"] item`, items_iq)
                .filter((el) => el.getAttribute('node'))
                .map((el) => ({
                    jid: el.getAttribute('jid') || jid,
                    node: el.getAttribute('node'),
                    name: el.getAttribute('name') || undefined,
                }));

            // A full page plus a cursor means there are more pages.
            // A short page is the end of the set.
            const set = sizzle(`set[xmlns="${Strophe.NS.RSM}"]`, items_iq)[0];
            const cursor = (set ? RSM.parseXMLResult(set).last : undefined) ?? null;
            const full = page.length >= max;
            const has_more = full && cursor !== null && cursor !== after;

            // Drop XEP-0277 per-post comment threads
            const nodes = page.filter((n) => !n.node.startsWith(COMMENTS_NODE_PREFIX));
            const dropped = page.length - nodes.length;
            if (dropped) log.debug(`browseFeeds: ${jid} — hid ${dropped} comment node(s) from the page`);

            // `title` holds pubsub#title only (filled in by the info probe); the
            // display label falls back to `name` then `node` in the UI.
            /** @type {import('./types').BrowsableFeed[]} */
            const feeds = nodes.map((n) => ({ ...n, is_feed: false, probed: false }));

            const total = feeds.length;
            let probed = 0;
            onProgress?.({ probed, total });

            // 2. Probe each node's disco#info with a streaming worker pool + short
            //    timeout (same shape as scanFollowable): one slow node never holds
            //    up the rest, and an aborted browse stops launching further probes.
            const queue = Array.from({ length: total }, (_, i) => i);
            const worker = async () => {
                while (queue.length && !signal?.aborted) {
                    const idx = queue.shift();
                    const meta = await probeNodeMeta(jid, feeds[idx].node);
                    Object.assign(feeds[idx], meta, { probed: true });
                    probed++;
                    onProgress?.({ probed, total });
                }
            };
            const pool = Array.from({ length: Math.min(FOLLOWABLE_SCAN_CONCURRENCY, total) }, () => worker());
            await Promise.all(pool);
            return { feeds, cursor, has_more };
        },

        /**
         * Unfollow a contact's social feed: retract the XEP-0330 item, unsubscribe
         * to stop live delivery and drop the local feed and its cached posts.
         * @method _converse.api.microblog.unfollow
         * @param {string} jid
         * @param {object} [options]
         * @param {string} [options.node=MICROBLOG_NODE]
         * @returns {Promise<void>}
         */
        async unfollow(jid, { node = MICROBLOG_NODE } = {}) {
            await retractFollow(jid, node);
            _converse.state.following?.untrack(jid, node);
            try {
                await api.pubsub.unsubscribe(jid, node);
            } catch (e) {
                log.debug(`api.microblog.unfollow: explicit unsubscribe from ${jid} failed (non-fatal): ${e}`);
            }
            await api.waitUntil('pubsubFeedsInitialized');
            const feed = _converse.state.pubsubfeeds?.getFeed(jid, node, false);
            await feed?.close();
        },

        /**
         * Repeat (repost) a post into the user's own microblog feed (XEP-0277 §
         * Repeating a Post). Published to the user's own node and attributed to
         * the original author, so it renders with a "reposted by you" eyebrow.
         * @method _converse.api.microblog.repost
         * @param {import('./message').default} post - The post to repost.
         * @returns {Promise<void>}
         */
        async repost(post) {
            const feed = await api.microblog.feeds.own();
            await feed.repostPost(post);
        },

        /**
         * Like a post: publish a ♥ comment to the post's comments node.
         *
         * Optimistic: the like state flips immediately so that UI can update.
         * If the publish is refused the state is rolled back and the error
         * re-thrown for the caller to surface. A no-op if we already like it.
         * @method _converse.api.microblog.like
         * @param {import('./message').default} post
         * @returns {Promise<import('./message').default|undefined>} Our ♥ comment.
         */
        async like(post) {
            if (post.get('liked_by_me')) return undefined;

            const feed = await api.microblog.comments.feed(post);
            if (!feed) return undefined;

            // The cached flag can be stale (another device already liked). If the
            // thread we've loaded already holds a ♥ of ours, don't publish a
            // duplicate, just reconcile the denormalised state and bail.
            if (feed.getMyLikes().length) {
                syncCommentSummary(post, feed);
                return undefined;
            }

            const author_jid = _converse.session.get('bare_jid');
            const author_name = _converse.state.profile?.getDisplayName?.() || author_jid;
            const id = getUniqueId();

            // Optimistically reflect the like, keeping a snapshot to revert to.
            const snapshot = {
                like_count: post.get('like_count'),
                liked_by_me: post.get('liked_by_me'),
                my_like_id: post.get('my_like_id'),
            };
            safeSave(post, { liked_by_me: true, my_like_id: id, like_count: (post.get('like_count') || 0) + 1 });

            try {
                const like = await feed.publishComment({ body: LIKE_MARKER, author_jid, author_name, id });
                // Reconcile against the thread now the ♥ has actually landed.
                syncCommentSummary(post, feed);
                return like;
            } catch (e) {
                safeSave(post, snapshot);
                throw e;
            }
        },

        /**
         * Un-like a post: retract *every* ♥ of ours from the post's comments node
         * (duplicates can accrue across devices / cache resets, so one tap clears
         * the post regardless of how many accumulated).
         *
         * Optimistic: the like is removed and the count reverts immediately, then
         * the retracts are sent; if any is refused the like is restored and the
         * error re-thrown for the caller to surface. A no-op if we don't like it.
         * @method _converse.api.microblog.unlike
         * @param {import('./message').default} post
         * @returns {Promise<void>}
         */
        async unlike(post) {
            if (!post.get('liked_by_me') && !post.get('my_like_id')) return;

            const feed = await api.microblog.comments.feed(post);
            if (!feed) return;

            // Every ♥ of ours in the loaded thread, plus the cached id in case the
            // thread isn't loaded (deduped into a set).
            const ids = new Set(feed.getMyLikes().map((m) => m.get('id')));
            if (post.get('my_like_id')) ids.add(post.get('my_like_id'));
            if (!ids.size) return;

            // Optimistically remove the like, keeping a snapshot to revert to.
            const snapshot = {
                like_count: post.get('like_count'),
                liked_by_me: post.get('liked_by_me'),
                my_like_id: post.get('my_like_id'),
            };
            safeSave(post, {
                liked_by_me: false,
                my_like_id: undefined,
                like_count: Math.max(0, (post.get('like_count') || 0) - 1),
            });

            try {
                for (const id of ids) {
                    await api.pubsub.retract(feed.get('jid'), feed.get('node'), id);
                }
            } catch (e) {
                safeSave(post, snapshot);
                throw e;
            }
            // Confirmed: drop our local ♥s and reconcile counts from the thread.
            ids.forEach((id) => feed.messages.get(id)?.destroy());
            syncCommentSummary(post, feed);
        },

        /**
         * The "comments" namespace groups XEP-0277 § Comments methods, which
         * operate on a post's per-post comments node.
         * @namespace _converse.api.microblog.comments
         * @memberOf _converse.api.microblog
         */
        comments: {
            /**
             * Get (creating it locally if necessary) the comments thread for a post.
             * The thread is a {@link CommentFeed} over the post's comments node,
             * kept out of the timeline aggregate.
             * @method _converse.api.microblog.comments.feed
             * @param {import('./message').default} post
             * @returns {Promise<import('./comment-feed').default|undefined>}
             */
            async feed(post) {
                await api.waitUntil('pubsubFeedsInitialized');
                const service = post.getCommentsService();
                const node = post.getCommentsNode();
                if (!service || !node) return undefined;
                return _converse.state.commentfeeds?.getFeed(service, node, true);
            },

            /**
             * Fetch a post's comments into its thread and return the thread.
             * @method _converse.api.microblog.comments.fetch
             * @param {import('./message').default} post
             * @returns {Promise<import('./comment-feed').default|undefined>}
             */
            async fetch(post) {
                const feed = await api.microblog.comments.feed(post);
                await feed?.fetchComments();
                return feed;
            },

            /**
             * Fetch a post's comments and denormalise the resulting counts onto
             * the post (see {@link syncCommentSummary}). This is the source for
             * the timeline's comment/like counts.
             * @method _converse.api.microblog.comments.fetchSummary
             * @param {import('./message').default} post
             * @returns {Promise<void>}
             */
            fetchSummary(post) {
                const service = post?.getCommentsService();
                const node = post?.getCommentsNode();
                if (!service || !node) return Promise.resolve();
                // Key the dedupe on the comments-feed identity (service + node),
                // not the post's bare item id — item ids are only unique within a
                // node, so on an aggregated timeline two authors' posts can share
                // one (e.g. `post-1`) and would otherwise collide into a single fetch.
                const key = PubSubFeeds.getFeedId(service, node);
                return comment_summary_queue.add(key, async () => {
                    const feed = await api.microblog.comments.feed(post);
                    if (!feed) return;
                    await feed.fetchComments();
                    syncCommentSummary(post, feed);
                });
            },

            /**
             * Pin and subscribe to a post's comment thread so live comments/likes
             * route in and bump the post's denormalised counts. Used for our own
             * posts, so we take an explicit bare-JID subscription and
             * materialise (pin) the thread feed since `handleMicroblogEvent` routes a
             * comment event only into an already existing thread (create=false).
             * Idempotent; bounded by `social_max_pinned_threads`.
             * @method _converse.api.microblog.comments.pin
             * @param {import('./message').default} post
             * @returns {Promise<import('./comment-feed').default|undefined>}
             */
            async pin(post) {
                const service = post?.getCommentsService();
                const node = post?.getCommentsNode();
                if (!service || !node) return undefined;
                await api.waitUntil('pubsubFeedsInitialized');
                const feeds = _converse.state.commentfeeds;
                const feed = feeds?.getFeed(service, node, true);
                if (!feed) return undefined;
                if (!feed.get('pinned')) feed.save({ pinned: true });
                try {
                    await api.pubsub.subscribe(service, node);
                } catch (e) {
                    // Non-fatal: without the subscription live comments won't push,
                    // but the thread is still fetched on open / next summary refresh.
                    log.debug(`api.microblog.comments.pin: subscribe to ${node} failed (non-fatal): ${e}`);
                }
                await feeds.enforcePinnedCap();
                return feed;
            },

            /**
             * Pin+subscribe the comment threads of our recent own posts (bounded
             * by `social_max_pinned_threads`) so live comments/likes on them keep
             * the counts current. Called on load; safe to call repeatedly.
             * @method _converse.api.microblog.comments.pinRecentOwn
             * @returns {Promise<void>}
             */
            async pinRecentOwn() {
                await api.waitUntil('pubsubFeedsInitialized');
                const bare_jid = _converse.session.get('bare_jid');
                const own = _converse.state.pubsubfeeds?.getFeed(bare_jid, MICROBLOG_NODE, false);
                if (!own) return;
                const cap = api.settings.get('social_max_pinned_threads') || 0;
                // getPosts() is newest-first, so the newest `cap` posts are pinned.
                for (const post of own.getPosts().slice(0, cap)) {
                    await api.microblog.comments.pin(post);
                }
            },

            /**
             * Add a comment to a post: publish an Atom entry, attributed to us,
             * to the post's comments node.
             * @method _converse.api.microblog.comments.add
             * @param {import('./message').default} post - The post being commented on.
             * @param {string} body - The comment text.
             * @returns {Promise<import('./message').default|undefined>}
             */
            async add(post, body) {
                const text = body?.trim();
                if (!text) return undefined;
                const feed = await api.microblog.comments.feed(post);
                if (!feed) return undefined;
                const author_jid = _converse.session.get('bare_jid');
                const author_name = _converse.state.profile?.getDisplayName?.() || author_jid;
                const comment = await feed.publishComment({ body: text, author_jid, author_name });
                // Reflect our own new comment in the post's denormalised count.
                syncCommentSummary(post, feed);
                return comment;
            },
        },

        /**
         * Read a durable XEP-0330 follow list (the server-side source of truth
         * for who an account follows), e.g. for a Following list/count. Defaults
         * to our own list; pass a JID to read a contact's (their node is
         * presence-access, so it succeeds for contacts and is refused otherwise).
         * @method _converse.api.microblog.following
         * @param {string} [jid=null] - Whose list to read; null/own for our own.
         * @returns {Promise<Array<{ server: string, node: string, title?: string }>>}
         */
        async following(jid = null) {
            return await readFollowing(jid);
        },

        /**
         * Materialise the feeds the user reads and backfill them.
         * Idempotent, so the Social UI can call it whenever it opens.
         *
         * Deliberately *not* run on connect: the headless plugin stays passive so
         * it doesn't issue PEP queries for users who never open the Social app
         * (cached feeds already survive reconnects, so live PEP routing is
         * unaffected). The UI drives this instead.
         * @method _converse.api.microblog.initFollowing
         * @returns {Promise<void>}
         */
        async initFollowing() {
            await api.waitUntil('pubsubFeedsInitialized');
            const feeds = _converse.state.pubsubfeeds;
            if (!feeds) return;

            // Ensure the own feed is present so it's part of the aggregate timeline.
            feeds.getFeed(_converse.session.get('bare_jid'), MICROBLOG_NODE, true);

            let following = null;
            try {
                // Read the durable XEP-0330 follow list
                following = await readFollowing();
            } catch (e) {
                // No follow-list node yet (or it's empty/inaccessible). Leave
                // `following` null so a transient failure never wipes the mirror.
                log.debug(`api.microblog.initFollowing: could not read the follow list: ${e}`);
            }
            if (following) {
                // Reconcile the durable list into the local mirror (the source of
                // truth for isFollowing), catching follows/unfollows made on
                // another device, then materialise each followed feed.
                await _converse.state.following?.reconcile(following);
                for (const { server, node } of following) {
                    feeds.getFeed(server, node, true);
                }
            }
            feeds.forEach(/** @param {import('./feed').default} f */ (f) => f.fetchPosts());

            // Re-establish live comment/like delivery for our recent own posts so
            // their counts keep ticking across reconnects (fire-and-forget; reads
            // the already-hydrated own feed).
            api.microblog.comments.pinRecentOwn().catch((e) => log.error(e));
        },

        /**
         * Re-read the durable XEP-0330 follow list from our own PEP service and
         * bring local state into line with it: reconcile the `following` mirror,
         * materialise and backfill any feed newly followed on another device or
         * client, and drop any feed unfollowed elsewhere. Only the delta is
         * touched (feeds we already follow are left as they are), and every step
         * is idempotent, so re-running it (e.g. on a `+notify` echo of our own
         * change) is a no-op.
         *
         * Driven by the `+notify` push on our follow-list node (see
         * `handleMicroblogEvent`), which is how a follow/unfollow made on one
         * device propagates live to the others.
         * @method _converse.api.microblog.syncFollowing
         * @returns {Promise<void>}
         */
        async syncFollowing() {
            await api.waitUntil('pubsubFeedsInitialized');
            const feeds = _converse.state.pubsubfeeds;
            const mirror = _converse.state.following;
            if (!feeds || !mirror) return;

            let following;
            try {
                following = await readFollowing();
            } catch (e) {
                // A transient read failure must never wipe the mirror; leave
                // local state untouched and wait for the next notification.
                log.debug(`api.microblog.syncFollowing: could not read the follow list: ${e}`);
                return;
            }

            // Snapshot the follows we held *before* reconciling, so we can tell
            // which entries were added or removed on the other device. The mirror
            // id is `server/node`, matching a feed's id.
            const had = new Map(
                mirror.map(
                    /** @param {import('./following').FollowedFeed} m */ (m) => [
                        m.id,
                        { server: m.get('server'), node: m.get('node') },
                    ],
                ),
            );
            await mirror.reconcile(following);

            const desired = new Set(following.map(({ server, node }) => `${server}/${node}`));
            // Materialise + backfill feeds newly followed elsewhere.
            for (const { server, node } of following) {
                if (had.has(`${server}/${node}`)) continue;
                feeds.getFeed(server, node, true)?.fetchPosts();
            }
            // Drop feeds unfollowed elsewhere (mirrors `unfollow`). We don't
            // unsubscribe: the device that unfollowed already did, and the
            // subscription is a durable account-wide (bare-JID) one.
            for (const [id, { server, node }] of had) {
                if (desired.has(id)) continue;
                await feeds.getFeed(server, node, false)?.close();
            }
        },

        /**
         * Whether the user currently follows a JID + node, per the durable
         * XEP-0330 follow list (mirrored in `_converse.state.following`). This is
         * independent of whether a feed happens to be loaded for the JID — a
         * browse-only profile feed exists without a follow.
         * @method _converse.api.microblog.isFollowing
         * @param {string} jid
         * @param {string} [node=MICROBLOG_NODE]
         * @returns {boolean}
         */
        isFollowing(jid, node = MICROBLOG_NODE) {
            const bare_jid = _converse.session.get('bare_jid');
            // The user's own feed isn't a "follow".
            if (Strophe.getBareJidFromJid(jid) === bare_jid) return false;
            return !!_converse.state.following?.isFollowing(jid, node);
        },
    },
};
