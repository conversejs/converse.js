/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { Collection } from '@converse/skeletor';
import _converse from '../../shared/_converse.js';
import { createStore } from '../../utils/storage.js';
import PubSubFeed from './feed.js';
import { MICROBLOG_NODE } from './constants.js';

/**
 * The set of PubSub feeds the user is reading — their own microblog plus any
 * contacts'/communities' nodes. Registered as `_converse.state.pubsubfeeds`.
 *
 * @extends {Collection<PubSubFeed>}
 */
class PubSubFeeds extends Collection {
    get model() {
        return PubSubFeed;
    }

    get autoSync() {
        return true;
    }

    initialize() {
        const bare_jid = _converse.session.get('bare_jid');
        this.storage = createStore(`converse.pubsub-feeds-${bare_jid}`);
    }

    /**
     * Build the canonical feed id for a JID + node pair.
     * @param {string} jid
     * @param {string} node
     * @returns {string}
     */
    static getFeedId(jid, node) {
        return `${jid}/${node}`;
    }

    /**
     * Get an existing feed, or create and add it.
     * @param {string} jid - The feed's JID (bare JID for the user's own PEP feed).
     * @param {string} [node=MICROBLOG_NODE]
     * @param {boolean} [create=true]
     * @returns {PubSubFeed|undefined|Promise<PubSubFeed|void>}
     */
    getFeed(jid, node = MICROBLOG_NODE, create = true) {
        const id = PubSubFeeds.getFeedId(jid, node);
        const existing = this.get(id);
        if (existing || !create) return existing;

        return this.create({ id, jid, node });
    }
}

export default PubSubFeeds;
