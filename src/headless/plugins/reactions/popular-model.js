import log from '@converse/log';
import { getOpenPromise } from '@converse/openpromise';
import { Model } from '@converse/skeletor';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import _converse from '../../shared/_converse.js';
import { emojiToCodepointKey, getStorageKeys } from './utils.js';

const { Strophe, sizzle, stx, u } = converse.env;

/**
 * Model for storing popular reactions with timestamps.
 * Tracks when each emoji was last used for a reaction.
 */
class PopularReactions extends Model {
    defaults() {
        return {
            // Format: { 'emoji_shortname': 'ISO8601-timestamp', ... }
            timestamps: {},
        };
    }

    async initialize() {
        super.initialize();
        const { storage_key, fetched_flag_key } = getStorageKeys();
        this.fetched_flag = fetched_flag_key;
        u.initStorage(this, storage_key);
        await this.fetchPopularReactions();
    }

    async fetchPopularReactions() {
        if (_converse.state.session.get(this.fetched_flag)) {
            const deferred = getOpenPromise();
            this.fetch({
                success: () => deferred.resolve(),
                error: () => deferred.resolve(),
            });
            return deferred;
        } else {
            await this.fetchPopularReactionsFromServer();
        }
    }

    /**
     * Fetch the user's stored popular reactions from their PEP node and apply them.
     * If no item is stored, the default `popular_reactions` setting is left unchanged.
     */
    async fetchPopularReactionsFromServer() {
        const bare_jid = _converse.state.session.get('bare_jid');
        let iq;
        try {
            iq = await api.sendIQ(
                stx`<iq type="get" from="${bare_jid}" to="${bare_jid}" xmlns="jabber:client">
                    <pubsub xmlns="${Strophe.NS.PUBSUB}">
                        <items node="${Strophe.NS.REACTIONS_POPULAR}" max_items="1"/>
                    </pubsub>
                </iq>`,
            );
            await this.applyPopularReactionsFromStanza(iq);
        } catch (e) {
            // item-not-found is expected when the user has never saved a custom list
            if (e?.querySelector?.('item-not-found')) return;
            log.warn('fetchPopularReactionsFromServer: could not fetch popular reactions from PubSub');
            log.error(e);
            return;
        }
    }

    /**
     * Parse a list of unicode emoji from a popular-reactions PubSub item and
     * merge the received timestamps with local ones, keeping the most recent
     * timestamp per emoji (last-write-wins per slot).
     *
     * @param {Element} stanza - An IQ result or headline message containing the pubsub item
     */
    async applyPopularReactionsFromStanza(stanza) {
        const item = sizzle(`items[node="${Strophe.NS.REACTIONS_POPULAR}"] item`, stanza).pop();
        if (!item) return;

        const popular_el = item.getElementsByTagNameNS(Strophe.NS.REACTIONS_POPULAR, 'popular-reactions')[0];
        if (!popular_el) return;

        const reactions = Array.from(popular_el.querySelectorAll('reaction'))
            .map((el) => ({ emoji: el.textContent?.trim(), stamp: el.getAttribute('stamp') }))
            .filter(({ emoji, stamp }) => emoji && stamp);

        if (!reactions.length) return;

        await api.emojis.initialize();

        const by_cp = u.getEmojisByAttribute('cp');
        const local_timestamps = { ...(this.get('timestamps') || {}) };

        for (const { emoji, stamp } of reactions) {
            const cp = emojiToCodepointKey(emoji);
            const shortname = by_cp[cp]?.sn ?? emoji;
            const remote_ms = new Date(stamp).getTime();
            if (isNaN(remote_ms)) continue;

            // Normalise to UTC ISO string so stored values are always comparable
            // as strings, regardless of the timezone used by the sending device.
            const normalised_stamp = new Date(remote_ms).toISOString();

            const local_stamp = local_timestamps[shortname];
            const local_ms = local_stamp ? new Date(local_stamp).getTime() : 0;

            // Keep whichever timestamp is more recent (last-write-wins per emoji)
            if (remote_ms > local_ms) {
                local_timestamps[shortname] = normalised_stamp;
            }
        }

        this.save({ timestamps: local_timestamps });
    }

    /**
     * Record that an emoji was just used, setting its timestamp to now.
     * @param {string} shortname - The emoji shortname (e.g., ':thumbsup:')
     */
    recordUsage(shortname) {
        const timestamps = { ...(this.get('timestamps') || {}) };
        timestamps[shortname] = new Date().toISOString();
        this.save({ timestamps });
    }

    /**
     * Get emojis sorted by most recently used first.
     * @param {number} [maxLength=5] - Maximum number of emojis to return
     * @returns {string[]} - Array of shortnames sorted by timestamp descending
     */
    getSortedEmojis(maxLength = 5) {
        const timestamps = this.get('timestamps') || {};
        return Object.entries(timestamps)
            .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime() || a[0].localeCompare(b[0]))
            .map((entry) => entry[0])
            .slice(0, maxLength);
    }
}

export default PopularReactions;
