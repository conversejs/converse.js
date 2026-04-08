import log from '@converse/log';
import { getOpenPromise } from '@converse/openpromise';
import { Model } from '@converse/skeletor';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import _converse from '../../shared/_converse.js';
import { debounce } from '../../utils/promise.js';
import { emojiToCodepointKey } from './utils.js';
import { PUBLISH_DEBOUNCE_MILLIS, SHORTNAME_RE } from './constants.js';

const { Strophe, sizzle, stx, u } = converse.env;

class PopularEmojis extends Model {
    defaults() {
        return {
            // Format: { 'unicode_emoji': 'ISO8601-timestamp', ... }
            timestamps: {},
        };
    }

    initialize() {
        super.initialize();
        const { session } = _converse;
        const storage_key = `converse.popular_emojis_frequencies.${session.get('bare_jid')}`;
        const fetched_flag_key = `${storage_key}-fetched`;

        this.fetched_flag = fetched_flag_key;
        this.debouncedPublish = debounce(() => this.publish(), PUBLISH_DEBOUNCE_MILLIS);
        u.initStorage(this, storage_key);
        this.fetchPopularEmojis();
    }

    async fetchPopularEmojis() {
        if (_converse.state.session.get(this.fetched_flag)) {
            const deferred = getOpenPromise();
            this.fetch({
                success: () => deferred.resolve(),
                error: () => deferred.resolve(),
            });
            return deferred;
        } else {
            await this.fetchPopularEmojisFromServer();
        }
    }

    /**
     * Fetch the user's stored popular emojis from their PEP node and apply them.
     * If no item is stored, the default `popular_emojis` setting is left unchanged.
     */
    async fetchPopularEmojisFromServer() {
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
            this.applyPopularEmojisFromStanza(iq);
        } catch (e) {
            // item-not-found is expected when the user has never saved a custom list
            if (e?.querySelector?.('item-not-found')) return;
            log.warn('fetchPopularEmojisFromServer: could not fetch popular emojis from PubSub');
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
    applyPopularEmojisFromStanza(stanza) {
        const item = sizzle(`items[node="${Strophe.NS.REACTIONS_POPULAR}"] item`, stanza).pop();
        if (!item) return;

        const popular_el = item.getElementsByTagNameNS(Strophe.NS.REACTIONS_POPULAR, 'popular-reactions')[0];
        if (!popular_el) return;

        const reactions = Array.from(popular_el.querySelectorAll('reaction'))
            .map((el) => ({ emoji: el.textContent?.trim(), stamp: el.getAttribute('stamp') }))
            .filter(({ emoji, stamp }) => emoji && stamp);

        if (!reactions.length) return;

        const local_timestamps = { ...(this.get('timestamps') || {}) };

        for (const { emoji, stamp } of reactions) {
            const remote_ms = new Date(stamp).getTime();
            if (isNaN(remote_ms)) continue;

            // Normalise to UTC ISO string so stored values are always comparable
            // as strings, regardless of the timezone used by the sending device.
            const normalised_stamp = new Date(remote_ms).toISOString();

            const local_stamp = local_timestamps[emoji];
            const local_ms = local_stamp ? new Date(local_stamp).getTime() : 0;

            // Keep whichever timestamp is more recent (last-write-wins per emoji)
            if (remote_ms > local_ms) {
                local_timestamps[emoji] = normalised_stamp;
            }
        }

        this.save({ timestamps: local_timestamps });
    }

    /**
     * Record that an emoji was just used, setting its timestamp to now.
     * Accepts unicode emoji or shortnames. Shortnames are converted to unicode
     * before storage to prevent duplicates. Unicode is stored as-is (preserving
     * variation selectors like U+FE0F).
     *
     * @param {string[]} emojis - An array of unicode emojis and/or shortnames
     */
    recordUsage(emojis) {
        const timestamps = { ...(this.get('timestamps') || {}) };
        const by_sn = converse.emojis.by_sn || {};

        emojis.forEach((emoji) => {
            let unicode;
            if (SHORTNAME_RE.test(emoji)) {
                const emoji_data = by_sn[emoji];
                if (emoji_data?.cp) {
                    unicode = u.emojis.convert(emoji_data.cp);
                } else {
                    return;
                }
            } else {
                unicode = emoji;
            }
            timestamps[unicode] = new Date().toISOString();
        });
        this.save({ timestamps });
        this.debouncedPublish();
    }

    /**
     * Get emojis sorted by most recently used first.
     * @param {number} [maxLength=5] - Maximum number of emojis to return
     * @returns {string[]} - Array of unicode emoji keys sorted by timestamp descending
     */
    getSortedEmojis(maxLength = 5) {
        const timestamps = this.get('timestamps') || {};
        return Object.entries(timestamps)
            .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime() || a[0].localeCompare(b[0]))
            .map((entry) => entry[0])
            .slice(0, maxLength);
    }

    /**
     * @returns {Promise<import('./types').EmojiDataByUnicode>} Map from unicode emoji to data
     */
    async getPopularEmojis() {
        await api.emojis.initialize();

        const result = /** @type{import('./types').EmojiDataByUnicode} */ ({});

        const default_setting = api.settings.get('popular_emojis') ?? [];
        const max = default_setting.length || 5;
        const sorted = this.getSortedEmojis(max);
        const by_cp = u.emojis.getEmojisByAttribute('cp');

        for (const key of sorted) {
            const emoji_data = by_cp[emojiToCodepointKey(key)];
            if (!emoji_data) continue;

            result[key] = emoji_data;
        }

        if (Object.keys(result).length < max) {
            const by_sn = converse.emojis.by_sn || {};
            for (const sn of default_setting) {
                if (Object.keys(result).length >= max) break;
                const data = by_sn[sn];
                const unicode = data?.cp ? u.emojis.convert(data.cp) : null;
                if (unicode && !result[unicode]) {
                    const emoji_data = by_cp[emojiToCodepointKey(unicode)];
                    if (emoji_data) result[unicode] = emoji_data;
                }
            }
        }

        return result;
    }

    async publish() {
        await api.emojis.initialize();

        const default_setting = api.settings.get('popular_emojis') ?? [];
        const max = default_setting.length || 5;
        const sorted = this.getSortedEmojis(max);
        const timestamps = this.get('timestamps') || {};

        const item = stx`
            <item id="current">
                <popular-reactions xmlns="${Strophe.NS.REACTIONS_POPULAR}">
                    ${sorted.map((e) => stx`<reaction stamp="${timestamps[e]}">${e}</reaction>`)}
                </popular-reactions>
            </item>`;

        try {
            await api.pubsub.publish(null, Strophe.NS.REACTIONS_POPULAR, item, {
                persist_items: 'true',
                access_model: 'whitelist',
            });
        } catch (e) {
            log.warn('PopularEmojis#publish: failed to update popular emojis');
            log.error(e);
        }
    }
}

export default PopularEmojis;
