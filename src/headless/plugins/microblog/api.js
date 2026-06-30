/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { Strophe } from 'strophe.js';
import log from '@converse/log';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import { publishFollow, readFollowing, retractFollow } from './following.js';
import { parseAtomEntry } from './parsers.js';
import {
    FOLLOWABLE_PROBE_TIMEOUT,
    FOLLOWABLE_SCAN_CONCURRENCY,
    MICROBLOG_NODE,
    SOCIAL_FEED_FEATURE,
} from './constants.js';

/**
 * Probe one contact's microblog node to learn whether they have a followable
 * feed. Resolves to a verdict for the followable cache. A node that returns at
 * least one item is followable (and yields a preview timestamp); an empty node,
 * a missing node, or an access error is not.
 * @param {string} jid - The contact's bare JID.
 * @returns {Promise<{ followable: boolean, latest?: string|null }>}
 */
async function probeMicroblogFeed(jid) {
    try {
        const result = await api.pubsub.items.get(jid, MICROBLOG_NODE, {
            max_items: 1,
            timeout: FOLLOWABLE_PROBE_TIMEOUT,
        });
        const item = result?.items?.[0];
        if (!item) return { followable: false };
        let latest = null;
        try {
            latest = parseAtomEntry(item, { from: jid, node: MICROBLOG_NODE })?.time ?? null;
        } catch (e) {
            // The preview timestamp is best-effort; ignore a parse failure.
            log.debug(`scanFollowable: could not parse latest item for ${jid}: ${e}`);
        }
        return { followable: true, latest };
    } catch (e) {
        log.debug(`scanFollowable: ${jid} has no readable microblog feed: ${e}`);
        return { followable: false };
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
         * No network is used here — (1) reads cached entity caps and (2) reads
         * the local cache — so it's safe to recompute on roster/presence/cache
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
                    const verdict = await probeMicroblogFeed(jid);
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
         * Read the durable XEP-0330 follow list (the server-side source of truth
         * for who the user follows), e.g. for a Following list/count.
         * @method _converse.api.microblog.following
         * @returns {Promise<Array<{ server: string, node: string, title?: string }>>}
         */
        async following() {
            return await readFollowing();
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

            let following = [];
            try {
                // Read the durable XEP-0330 follow list
                following = await readFollowing();
            } catch (e) {
                // No follow-list node yet (or it's empty/inaccessible).
                log.debug(`api.microblog.initFollowing: could not read the follow list: ${e}`);
            }
            for (const { server, node } of following) {
                feeds.getFeed(server, node, true);
            }
            feeds.forEach((feed) => feed.fetchPosts());
        },

        /**
         * Whether the user currently follows (has a feed for) a JID + node.
         * @method _converse.api.microblog.isFollowing
         * @param {string} jid
         * @param {string} [node=MICROBLOG_NODE]
         * @returns {boolean}
         */
        isFollowing(jid, node = MICROBLOG_NODE) {
            const bare_jid = _converse.session.get('bare_jid');
            // The user's own feed isn't a "follow".
            if (Strophe.getBareJidFromJid(jid) === bare_jid) return false;
            return !!_converse.state.pubsubfeeds?.getFeed(jid, node, false);
        },
    },
};
