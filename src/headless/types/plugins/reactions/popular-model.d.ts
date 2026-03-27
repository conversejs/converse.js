export default PopularReactions;
/**
 * Model for storing popular reaction frequencies.
 * Tracks how often each emoji is used for reactions.
 */
declare class PopularReactions extends Model<import("@converse/skeletor").ModelAttributes> {
    constructor(attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
    defaults(): {
        frequencies: {};
    };
    /**
     * Increment the usage count for a specific emoji
     * @param {string} shortname - The emoji shortname (e.g., ':thumbsup:')
     */
    incrementFrequency(shortname: string): void;
    /**
     * Get the current frequencies
     * @returns {Object} - Map of shortname to count
     */
    getFrequencies(): any;
    /**
     * Get emojis sorted by frequency (most frequent first)
     * @param {number} [maxLength=5] - Maximum number of emojis to return
     * @returns {string[]} - Array of shortnames sorted by frequency
     */
    getSortedEmojis(maxLength?: number): string[];
    /**
     * Set frequencies from an external source (e.g., from another device)
     * @param {Object} frequencies - Map of shortname to count
     */
    setFrequencies(frequencies: any): void;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=popular-model.d.ts.map