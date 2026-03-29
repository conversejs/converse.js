export default PopularReactions;
/**
 * Model for storing popular reactions with timestamps.
 * Tracks when each emoji was last used for a reaction.
 */
declare class PopularReactions extends Model<import("@converse/skeletor").ModelAttributes> {
    constructor(attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
    defaults(): {
        timestamps: {};
    };
    initialize(): Promise<void>;
    fetched_flag: string;
    fetchPopularReactions(): Promise<any>;
    /**
     * Fetch the user's stored popular reactions from their PEP node and apply them.
     * If no item is stored, the default `popular_reactions` setting is left unchanged.
     */
    fetchPopularReactionsFromServer(): Promise<void>;
    /**
     * Parse a list of unicode emoji from a popular-reactions PubSub item and
     * merge the received timestamps with local ones, keeping the most recent
     * timestamp per emoji (last-write-wins per slot).
     *
     * @param {Element} stanza - An IQ result or headline message containing the pubsub item
     */
    applyPopularReactionsFromStanza(stanza: Element): Promise<void>;
    /**
     * Record that an emoji was just used, setting its timestamp to now.
     * @param {string} shortname - The emoji shortname (e.g., ':thumbsup:')
     */
    recordUsage(shortname: string): void;
    /**
     * Get emojis sorted by most recently used first.
     * @param {number} [maxLength=5] - Maximum number of emojis to return
     * @returns {string[]} - Array of shortnames sorted by timestamp descending
     */
    getSortedEmojis(maxLength?: number): string[];
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=popular-model.d.ts.map