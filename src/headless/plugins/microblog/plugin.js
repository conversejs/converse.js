/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * Headless plugin implementing XEP-0277 (Microblogging over XMPP) on top of the
 * generic PubSub plugin. Exposes feeds/posts as Skeletor models and routes
 * incoming PEP events; the "Social" UI app renders on top of this.
 */
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from '@converse/log';
import PubSubFeed from './feed.js';
import PubSubFeeds from './feeds.js';
import CommentFeed from './comment-feed.js';
import CommentFeeds from './comment-feeds.js';
import PubSubMessage from './message.js';
import PubSubMessages from './messages.js';
import PostComment from './post-comment.js';
import PostComments from './post-comments.js';
import FollowableCache from './followable.js';
import Following from './following.js';
import MicroblogProfile from './profile.js';
import microblog_api from './api.js';
import { comment_summary_queue } from './comment-summary.js';
import { registerMicroblogHandler } from './utils.js';
import {
    FOLLOWING_NODE,
    MICROBLOG_NODE,
    NS_ATOM,
    NS_AVATAR_METADATA,
    NS_THREAD,
    SOCIAL_FEED_FEATURE,
} from './constants.js';
import '../pubsub/index.js';
import PubsubPlaceholderMessage from './placeholder.js';

const { Strophe } = converse.env;

Strophe.addNamespace('ATOM', NS_ATOM);
Strophe.addNamespace('THREAD', NS_THREAD);
Strophe.addNamespace('AVATAR_METADATA', NS_AVATAR_METADATA);

converse.plugins.add('converse-microblog', {
    dependencies: ['converse-pubsub', 'converse-disco'],

    initialize() {
        api.promises.add('pubsubFeedsInitialized');

        api.settings.extend({
            // Cap on the *number* of retained comment threads stored on posts.
            'social_max_comment_threads': 200,
            // Cap on subscriptions to pinned (e.g. our own) comment threads.
            // Past the cap the least-recently-pinned are unsubscribed + evicted
            'social_max_pinned_threads': 50,
        });

        const exports = {
            CommentFeed,
            CommentFeeds,
            FollowableCache,
            Following,
            MicroblogProfile,
            PostComment,
            PostComments,
            PubSubFeed,
            PubSubFeeds,
            PubSubMessage,
            PubSubMessages,
            PubsubPlaceholderMessage,
        };
        Object.assign(_converse.exports, exports);
        Object.assign(api, microblog_api);

        api.listen.on('addClientFeatures', () => {
            // Advertise that we understand the PubSub Social Feed (XEP-0472)
            // and the microblog node.
            api.disco.own.features.add(SOCIAL_FEED_FEATURE);
            api.disco.own.features.add(MICROBLOG_NODE);
            // Ask the server to push changes to our own XEP-0330 follow list to
            // all our online resources (`+notify`), so a follow/unfollow on one
            // device syncs live to the others. Unlike the microblog node (curated
            // content, delivered by explicit subscription) the follow list is
            // presence-broadcast profile state, so `+notify` is the right fit.
            api.disco.own.features.add(`${FOLLOWING_NODE}+notify`);
        });

        api.listen.on('clearSession', () => {
            // Drop the in-memory summary-fetch dedupe state so a fresh login
            // re-fetches counts (the persisted post attrs still show meanwhile).
            comment_summary_queue.reset();

            // Drop cached author profiles (and their vCard listeners).
            MicroblogProfile.clearProfiles();

            // Drop the session's detached browse feeds (unfollowed authors' feeds).
            PubSubFeed.clearBrowseFeeds();

            const { state } = _converse;
            if (state.pubsubfeeds) {
                state.pubsubfeeds.clearStore?.({ silent: true });
                delete state.pubsubfeeds;
            }
            if (state.commentfeeds) {
                state.commentfeeds.clearStore?.({ silent: true });
                delete state.commentfeeds;
            }
            if (state.followablecache) {
                state.followablecache.clearStore?.({ silent: true });
                delete state.followablecache;
            }
            if (state.following) {
                state.following.clearStore?.({ silent: true });
                delete state.following;
            }
        });

        api.listen.on('connected', onConnected);
        api.listen.on('reconnected', onConnected);
    },
});

async function onConnected() {
    try {
        registerMicroblogHandler();
        const feeds = new _converse.exports.PubSubFeeds();
        _converse.state.pubsubfeeds = feeds;

        // Comment threads live in their own persisted collection so they never
        // enter the aggregated timeline; growth is bounded by a thread LRU.
        const commentfeeds = new _converse.exports.CommentFeeds();
        _converse.state.commentfeeds = commentfeeds;

        const followablecache = new _converse.exports.FollowableCache();
        _converse.state.followablecache = followablecache;

        // A local, persisted mirror of the durable XEP-0330 follow list
        const following = new _converse.exports.Following();
        _converse.state.following = following;

        await Promise.all([feeds.hydrated, commentfeeds.hydrated, followablecache.hydrated, following.hydrated]);

        // A prior session may have hydrated more threads than the current cap.
        commentfeeds.pruneThreads();
    } catch (e) {
        log.error(e);
    }
    /**
     * Triggered once the microblog feeds collection has been created and
     * hydrated from the offline cache.
     * @event _converse#pubsubFeedsInitialized
     */
    api.trigger('pubsubFeedsInitialized');
}
