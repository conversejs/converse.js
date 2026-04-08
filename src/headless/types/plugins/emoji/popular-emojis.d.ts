export default PopularEmojis;
declare class PopularEmojis extends Model<import("@converse/skeletor").ModelAttributes> {
    constructor(attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
    defaults(): {
        timestamps: {};
    };
    initialize(): void;
    fetched_flag: string;
    debouncedPublish: {
        (...args: any[]): void;
        flush(): void;
    };
    fetchPopularEmojis(): Promise<any>;
    /**
     * Fetch the user's stored popular emojis from their PEP node and apply them.
     * If no item is stored, the default `popular_emojis` setting is left unchanged.
     */
    fetchPopularEmojisFromServer(): Promise<void>;
    /**
     * Parse a list of unicode emoji from a popular-reactions PubSub item and
     * merge the received timestamps with local ones, keeping the most recent
     * timestamp per emoji (last-write-wins per slot).
     *
     * @param {Element} stanza - An IQ result or headline message containing the pubsub item
     */
    applyPopularEmojisFromStanza(stanza: Element): void;
    /**
     * Record that an emoji was just used, setting its timestamp to now.
     * Accepts unicode emoji or shortnames. Shortnames are converted to unicode
     * before storage to prevent duplicates. Unicode is stored as-is (preserving
     * variation selectors like U+FE0F).
     *
     * @param {string[]} emojis - An array of unicode emojis and/or shortnames
     */
    recordUsage(emojis: string[]): void;
    /**
     * Get emojis sorted by most recently used first.
     * @param {number} [maxLength=5] - Maximum number of emojis to return
     * @returns {string[]} - Array of unicode emoji keys sorted by timestamp descending
     */
    getSortedEmojis(maxLength?: number): string[];
    /**
     * @returns {Promise<import('./types').EmojiDataByUnicode>} Map from unicode emoji to data
     */
    getPopularEmojis(): Promise<import("./types").EmojiDataByUnicode>;
    publish(): Promise<void>;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=popular-emojis.d.ts.map