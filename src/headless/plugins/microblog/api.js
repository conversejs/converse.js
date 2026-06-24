/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { Strophe } from 'strophe.js';
import log from '@converse/log';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import { publishFollow, readFollowing, retractFollow } from './following.js';
import { MICROBLOG_NODE } from './constants.js';

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
                return api.microblog.feeds.get();
            },
        },

        /**
         * Follow a contact's microblog: record it in the durable XEP-0330 list,
         * best-effort subscribe for live delivery, and create + backfill the feed.
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
                // Many servers don't honour cross-account PEP subscriptions; the
                // XEP-0330 list is the durable record and +notify / pull cover delivery.
                log.debug(`api.microblog.follow: explicit subscribe to ${jid} failed (non-fatal): ${e}`);
            }
            const feed = await api.microblog.feeds.get(jid, node, true);
            feed?.fetchPosts();
            return feed;
        },

        /**
         * Unfollow a contact's microblog: retract the XEP-0330 item, best-effort
         * unsubscribe, and drop the local feed and its cached posts.
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
            return readFollowing();
        },

        /**
         * Materialise the feeds the user reads and backfill them — the own feed
         * plus a feed for every entry in the durable XEP-0330 follow list (which
         * also picks up follows made on other devices). Idempotent, so the Social
         * UI can call it whenever it opens.
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
