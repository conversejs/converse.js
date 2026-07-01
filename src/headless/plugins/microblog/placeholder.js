/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { Model } from '@converse/skeletor';
import { getUniqueId } from '../../utils/index.js';

/**
 * A non-post placeholder that marks a point in a feed's history where more posts
 * can be loaded. Two roles, distinguished only by `stop_at_time`:
 *
 * - **older-frontier** (no `stop_at_time`): sits at a feed's oldest-loaded post and
 *   pages older until the node is exhausted — the per-feed "load older" control.
 * - **gap** (`stop_at_time` set): sits in a newer-than-cache gap and pages the
 *   missing range until it reaches the cached posts.
 *
 * It is positioned in the timeline by `time` (set by whoever creates it) and, when
 * scrolled into view, calls the feed's shared {@link module:feed~PubSubFeed#fetchOlder}
 * primitive. It is never persisted (recreated on load).
 *
 * @extends {Model}
 */
export default class PubsubPlaceholderMessage extends Model {
    defaults() {
        const id = getUniqueId();
        return {
            id,
            msgid: id,
            is_ephemeral: false,
            // `time`, `before_cursor` and (for gaps) `stop_at_time` are supplied by
            // the creator so the placeholder sorts into the right position.
        };
    }

    /**
     * Load one page of older posts into the feed, then remove this placeholder.
     * `fetchOlder` re-seeds a follow-on placeholder if more history remains, which
     * also re-arms the IntersectionObserver (a fresh element).
     * @returns {Promise<void>}
     */
    async fetchMissingMessages() {
        this.set('fetching', true);
        await this.collection.feed.fetchOlder(this);
        this.destroy();
    }
}
