import { Model } from "@converse/skeletor";

/**
 * @class BOB
 * Represents a single Bits of Binary (XEP-0231) cache entry
 */
class BOB extends Model {
    get idAttribute() {
        return "cid";
    }

    /**
     * Check if this BOB entry has expired based on max_age
     * @returns {boolean}
     */
    isExpired() {
        const max_age = this.get("max_age");
        if (!max_age) return false;
        if (max_age === 0) return true;

        const timestamp = this.get("timestamp");
        const age = (Date.now() - timestamp) / 1000;
        return age > max_age;
    }

    /**
     * Get the BOB data as a Blob URL
     * @returns {string|null}
     */
    getBlobURL() {
        const data = this.get("data");
        const type = this.get("type");

        if (!data || !type) return null;

        try {
            const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
            const blob = new Blob([bytes], { type });
            return URL.createObjectURL(blob);
        } catch (e) {
            return null;
        }
    }
}

export default BOB;
