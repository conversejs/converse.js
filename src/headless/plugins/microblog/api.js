/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { Strophe } from 'strophe.js';
import log from '@converse/log';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import { publishFollow, readFollowing, retractFollow } from './following.js';
import { MICROBLOG_NODE, SOCIAL_FEED_FEATURE } from './constants.js';

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
         * feed (`urn:xmpp:pubsub-social-feed:1`). Backed by cached entity
         * caps/disco, so it's cheap for the UI to call per roster contact.
         *
         * Entity-caps features are advertised per *resource*, so a contact's
         * bare-JID disco entity carries no features; resolving the feature
         * against the bare JID always returns false. We therefore also check the
         * contact's available resources (full JIDs) and return true if any of
         * them advertises the feature.
         * @method _converse.api.microblog.canFollow
         * @param {string} jid
         * @returns {Promise<boolean>}
         */
        async canFollow(jid) {
            const bare_jid = _converse.session.get('bare_jid');
            const contact_jid = Strophe.getBareJidFromJid(jid);
            if (contact_jid === bare_jid) return false;

            // Handles the case where `jid` is already a full JID (or the bare
            // entity happens to carry the feature).
            if (await api.disco.supports(SOCIAL_FEED_FEATURE, jid)) return true;

            const presence = _converse.state.presences?.get(contact_jid);
            const full_jids = presence?.resources?.map((r) => `${contact_jid}/${r.get('name')}`) ?? [];
            for (const full_jid of full_jids) {
                if (await api.disco.supports(SOCIAL_FEED_FEATURE, full_jid)) return true;
            }
            return false;
        },

        /**
         * Follow a contact's social feed: record it in the durable XEP-0330 list,
         * subscribe for live delivery (XEP-0472: explicit subscription is the
         * delivery path), and create + backfill the feed.
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
