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
import CommentFeeds from './comment-feeds';
import PubSubMessage from './message.js';
import PubSubMessages from './messages.js';
import FollowableCache from './followable.js';
import microblog_api from './api.js';
import { registerMicroblogHandler } from './utils.js';
import { MICROBLOG_NODE, NS_ATOM, NS_THREAD, SOCIAL_FEED_FEATURE } from './constants.js';
import '../pubsub/index.js';
import PubsubPlaceholderMessage from './placeholder.js';

const { Strophe } = converse.env;

Strophe.addNamespace('ATOM', NS_ATOM);
Strophe.addNamespace('THREAD', NS_THREAD);

converse.plugins.add('converse-microblog', {
    dependencies: ['converse-pubsub', 'converse-disco'],

    initialize() {
        api.promises.add('pubsubFeedsInitialized');

        const exports = {
            CommentFeed,
            CommentFeeds,
            FollowableCache,
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
        });

        api.listen.on('clearSession', () => {
            const { state } = _converse;
            if (state.pubsubfeeds) {
                state.pubsubfeeds.clearStore?.({ silent: true });
                delete state.pubsubfeeds;
            }
            if (state.commentfeeds) {
                // In-memory only (no store); just drop the reference.
                delete state.commentfeeds;
            }
            if (state.followablecache) {
                state.followablecache.clearStore?.({ silent: true });
                delete state.followablecache;
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
        // Open comment threads live in their own in-memory collection so they
        // never enter the aggregated timeline.
        _converse.state.commentfeeds = new _converse.exports.CommentFeeds();
        const followablecache = new _converse.exports.FollowableCache();
        _converse.state.followablecache = followablecache;
        await Promise.all([feeds.hydrated, followablecache.hydrated]);
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
