/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * XEP-0330 (Pubsub Subscription): a portable, server-side list of the PubSub
 * nodes the user follows, published to their own `urn:xmpp:pubsub:subscription`
 * PEP node. Unlike `+notify` caps (an ephemeral, presence-derived delivery
 * filter), this list is queryable, countable, and syncs across a user's devices
 * and clients.
 */
import { Collection, Model } from '@converse/skeletor';
import _converse from '../../shared/_converse.js';
import { createStore } from '../../utils/storage.js';
import { MICROBLOG_NODE } from './constants.js';

/**
 * One entry in the durable XEP-0330 follow list: a PubSub node the user follows
 * (a contact's `urn:xmpp:microblog:0`, or any `server`/`node` pair).
 * @extends {Model}
 */
export class FollowedFeed extends Model {
    get idAttribute() {
        return 'id';
    }

    defaults() {
        return { node: MICROBLOG_NODE };
    }
}

/**
 * A local, persisted mirror of the durable XEP-0330 follow list.
 * The source of truth for whom the user follows. Registered as `_converse.state.following`.
 *
 * Consulted by {@link _converse.api.microblog.isFollowing}, so "do we follow this
 * author" is decoupled from "do we happen to have a feed loaded for them" (a
 * browse-only profile feed exists without a follow). Kept in sync two ways:
 * {@link Following#track}/{@link Following#untrack} on this device's own
 * follow/unfollow, and {@link Following#reconcile}, which reconciles the whole
 * mirror against the server list read on `initFollowing` (catching
 * follows/unfollows made on another device or client, e.g. Movim).
 *
 * Mirrors the {@link import('./feeds.js').default} persistence pattern.
 * @extends {Collection<FollowedFeed>}
 */
class Following extends Collection {
    get model() {
        return FollowedFeed;
    }

    get autoSync() {
        return true;
    }

    initialize() {
        const bare_jid = _converse.session.get('bare_jid');
        this.storage = createStore(`converse.microblog-following-${bare_jid}`);
    }

    /**
     * The canonical entry id for a follow: `server/node`, matching a feed's id.
     * @param {string} server
     * @param {string} node
     * @returns {string}
     */
    static getId(server, node) {
        return `${server}/${node}`;
    }

    /**
     * Whether the given node is in the follow list.
     * @param {string} server
     * @param {string} [node=MICROBLOG_NODE]
     * @returns {boolean}
     */
    isFollowing(server, node = MICROBLOG_NODE) {
        return !!this.get(Following.getId(server, node));
    }

    /**
     * Record (add or update the title of) a follow.
     * @param {{ server: string, node?: string, title?: string }} attrs
     * @returns {FollowedFeed|Promise<FollowedFeed|void>}
     */
    track({ server, node = MICROBLOG_NODE, title }) {
        const id = Following.getId(server, node);
        const entry = this.get(id);
        if (entry) {
            if (title !== undefined && title !== entry.get('title')) entry.save({ title });
            return entry;
        }
        return this.create({ id, server, node, title });
    }

    /**
     * Drop a follow from the mirror.
     * @param {string} server
     * @param {string} [node=MICROBLOG_NODE]
     */
    untrack(server, node = MICROBLOG_NODE) {
        this.get(Following.getId(server, node))?.destroy();
    }

    /**
     * Reconcile the mirror against the authoritative XEP-0330 list read from the
     * server: upsert every entry present and drop any local entry no longer in the list.
     * @param {Array<{ server: string, node: string, title?: string }>} entries
     * @returns {Promise<void>}
     */
    async reconcile(entries) {
        await this.hydrated;
        const seen = new Set();
        for (const entry of entries) {
            this.track(entry);
            seen.add(Following.getId(entry.server, entry.node));
        }
        for (const model of [...this.models]) {
            if (!seen.has(model.id)) model.destroy();
        }
    }
}

export default Following;
