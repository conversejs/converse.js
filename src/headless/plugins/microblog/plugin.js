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
import PubSubMessage from './message.js';
import PubSubMessages from './messages.js';
import microblog_api from './api.js';
import { registerMicroblogHandler } from './utils.js';
import { MICROBLOG_NODE, NS_ATOM, NS_THREAD } from './constants.js';
import '../pubsub/index.js';

const { Strophe } = converse.env;

Strophe.addNamespace('ATOM', NS_ATOM);
Strophe.addNamespace('THREAD', NS_THREAD);

converse.plugins.add('converse-microblog', {
    dependencies: ['converse-pubsub', 'converse-disco'],

    initialize() {
        api.promises.add('pubsubFeedsInitialized');

        const exports = { PubSubFeed, PubSubFeeds, PubSubMessage, PubSubMessages };
        Object.assign(_converse.exports, exports);
        Object.assign(api, microblog_api);

        api.listen.on('addClientFeatures', () => {
            // Advertise interest so the server delivers microblog items via PEP.
            // This is a *delivery* mechanism only; the durable follow-list lives
            // in the XEP-0330 node (added in M3), not in these caps. The
            // `urn:xmpp:pubsub-social-feed:1` (XEP-0472) capability claim is
            // deferred until those semantics are actually implemented.
            api.disco.own.features.add(MICROBLOG_NODE + '+notify');
        });

        api.listen.on('clearSession', () => {
            const { state } = _converse;
            if (state.pubsubfeeds) {
                state.pubsubfeeds.clearStore?.({ silent: true });
                delete state.pubsubfeeds;
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
        await feeds.hydrated;
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
