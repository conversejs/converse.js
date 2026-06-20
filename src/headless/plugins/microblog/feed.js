/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { Model } from '@converse/skeletor';
import { Strophe } from 'strophe.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import log from '@converse/log';
import PubSubMessages from './messages.js';
import { buildItem, parseAtomEntry } from './parsers.js';
import { MICROBLOG_NODE } from './constants.js';

/**
 * One PubSub feed: a single node at a single JID (your own
 * `urn:xmpp:microblog:0`, a contact's microblog, or a community node).
 *
 * Rather than the chat-oriented `ModelWithMessages` mixin (which is coupled to
 * `<message>` stanzas, chat states, receipts and HTTP file uploads), the feed
 * owns its `.messages` collection directly — posts are PubSub items, published
 * via `api.pubsub.publish`.
 *
 * @extends {Model}
 */
class PubSubFeed extends Model {
    get idAttribute() {
        return 'id';
    }

    defaults() {
        return {
            node: MICROBLOG_NODE,
        };
    }

    initialize() {
        super.initialize();
        /** @type {PubSubMessages} */
        this.messages = new PubSubMessages(null, { id: this.getMessagesCacheKey() });
        this.messages.feed = this;
    }

    /**
     * @returns {string}
     */
    getMessagesCacheKey() {
        const bare_jid = _converse.session.get('bare_jid');
        return `converse.pubsub-messages-${this.get('jid')}-${this.get('node')}-${bare_jid}`;
    }

    /**
     * Whether this feed is the logged-in user's own microblog (a PEP node).
     * @returns {boolean}
     */
    isOwnFeed() {
        return Strophe.getBareJidFromJid(this.get('jid')) === _converse.session.get('bare_jid');
    }

    /**
     * Parse incoming PubSub `<item>` elements into posts and add/merge them into
     * the feed. Used both for retrieve-items backfill and live PEP events.
     * @param {Element[]} items
     * @returns {import('./message').default[]}
     */
    addItems(items) {
        return items
            .map((item) => {
                try {
                    const attrs = parseAtomEntry(item, { from: this.get('jid'), node: this.get('node') });
                    return /** @type {import('./message').default} */ (this.messages.add(attrs, { merge: true }));
                } catch (e) {
                    log.error(e);
                    return null;
                }
            })
            .filter(Boolean);
    }

    /**
     * Backfill the feed's history from the node (XEP-0060 § 6.5 Retrieve Items).
     * @param {object} [options]
     * @param {number} [options.max_items=20]
     * @returns {Promise<void>}
     */
    async fetchPosts({ max_items = 20 } = {}) {
        let result;
        try {
            result = await api.pubsub.items.get(this.get('jid'), this.get('node'), { max_items });
        } catch (e) {
            log.error(e);
            return;
        }
        this.addItems(result.items);
    }

    /**
     * Remove posts from the feed by id, e.g. in response to a retraction event.
     * @param {string[]} ids
     */
    removeItems(ids) {
        ids.forEach((id) => this.messages.get(id)?.destroy());
    }

    /**
     * Retract (delete) one of our own posts: remove it from the node and drop
     * the locally-cached copy.
     * @param {string} id - The PubSub item id of the post
     * @returns {Promise<void>}
     */
    async retractPost(id) {
        await api.pubsub.retract(this.get('jid'), this.get('node'), id);
        this.messages.get(id)?.destroy();
    }

    /**
     * Publish a new plain-text post to this feed's node.
     * @param {string} body
     * @returns {Promise<void>}
     */
    async publishPost(body) {
        const text = body?.trim();
        if (!text) return;

        const item = buildItem({ body: text, from: this.get('jid') });
        await api.pubsub.publish(this.get('jid'), this.get('node'), item, undefined, false);

        // Optimistically render our own post; the PEP echo (if any) will merge
        // by id rather than duplicate.
        this.addItems([item.tree()]);
    }
}

export default PubSubFeed;
