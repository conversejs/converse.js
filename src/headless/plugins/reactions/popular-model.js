import { Model } from '@converse/skeletor';

/**
 * Model for storing popular reaction frequencies.
 * Tracks how often each emoji is used for reactions.
 */
class PopularReactions extends Model {
    defaults() {
        return {
            // Format: { 'emoji_shortname': count, ... }
            'frequencies': {},
        };
    }

    /**
     * Increment the usage count for a specific emoji
     * @param {string} shortname - The emoji shortname (e.g., ':thumbsup:')
     */
    incrementFrequency(shortname) {
        const frequencies = this.get('frequencies') || {};
        frequencies[shortname] = (frequencies[shortname] || 0) + 1;
        this.save({ 'frequencies': frequencies });
    }

    /**
     * Get the current frequencies
     * @returns {Object} - Map of shortname to count
     */
    getFrequencies() {
        return this.get('frequencies') || {};
    }

    /**
     * Get emojis sorted by frequency (most frequent first)
     * @param {number} [maxLength=5] - Maximum number of emojis to return
     * @returns {string[]} - Array of shortnames sorted by frequency
     */
    getSortedEmojis(maxLength = 5) {
        const frequencies = this.getFrequencies();
        return Object.entries(frequencies)
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map((entry) => entry[0])
            .slice(0, maxLength);
    }

    /**
     * Set frequencies from an external source (e.g., from another device)
     * @param {Object} frequencies - Map of shortname to count
     */
    setFrequencies(frequencies) {
        this.save({ 'frequencies': frequencies });
    }
}

export default PopularReactions;
