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
import { MICROBLOG_NODE, MICROBLOG_PUBLISH_OPTIONS } from './constants.js';

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
     * Parse incoming PubSub `<item>` elements into posts, add/merge them into the
     * feed, and persist them to the offline cache. Used both for retrieve-items
     * backfill and live PEP events.
     * @param {Element[]} items
     * @returns {Promise<import('./message').default[]>}
     */
    async addItems(items) {
        await this.messages.hydrated;

        const from = this.get('jid');
        const node = this.get('node');

        const saves = [];
        const added = items
            .map((item) => {
                try {
                    const attrs = parseAtomEntry(item, { from, node });
                    const existing = this.messages.get(attrs.id);
                    const message = /** @type {import('./message').default} */ (
                        this.messages.add(attrs, { merge: true })
                    );
                    // Persist new posts and real updates; skip unchanged re-fetches.
                    if (message && (!existing || message.hasChanged())) {
                        saves.push(message.save(null, { promise: true }));
                    }
                    return message;
                } catch (e) {
                    log.error(e);
                    return null;
                }
            })
            .filter(Boolean);
        await Promise.all(saves);
        return added;
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
        await this.addItems(result.items);
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
     * Tear the feed down (when unfollowing): clear its cached posts and remove
     * the feed itself from the feeds collection / offline cache.
     * @returns {Promise<void>}
     */
    async close() {
        this.messages.clearStore?.({ silent: true });
        await this.destroy();
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
        // Publish with the XEP-0472 Base-profile node config so our node stays a
        // well-formed social feed that contacts can subscribe to. Non-strict:
        // if the server can't honour the publish-options precondition we still
        // publish the post.
        await api.pubsub.publish(this.get('jid'), this.get('node'), item, MICROBLOG_PUBLISH_OPTIONS, false);

        // Optimistically render our own post; the PEP echo (if any) will merge
        // by id rather than duplicate.
        await this.addItems([item.tree()]);
    }
}

export default PubSubFeed;
