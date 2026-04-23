import { Hsluv } from 'hsluv';

const cache = new Map();

/**
 * Computes an RGB color as specified in XEP-0392
 * https://xmpp.org/extensions/xep-0392.html
 *
 * @param {string} s JID or nickname to colorize
 * @returns {Promise<string>}
 */
export async function colorize(s) {
    // We cache results in `cache`, to avoid unnecessary computing (as it can be called very often)
    const v = cache.get(s);
    if (v) return v;

    // Run the input through SHA-1 (only available in secure context/HTTPS)
    let angle;
    if (window.isSecureContext) {
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s))));
        // Treat the output as little endian and extract the least-significant 16 bits.
        angle = ((digest[0] + digest[1] * 256) / 65536.0) * 360;
    } else {
        // Fallback for non-HTTPS contexts: use a simple hash based on string characters
        let hash = 0;
        for (let i = 0; i < s.length; i++) {
            hash = ((hash << 5) - hash) + s.charCodeAt(i);
            hash = hash & hash; // Convert to 32bit integer
        }
        angle = Math.abs(hash % 360);
    }

    // Convert HSLuv angle to RGB Hex notation
    const hsluv = new Hsluv();
    hsluv.hsluv_h = angle;
    hsluv.hsluv_s = 100;
    hsluv.hsluv_l = 50;
    hsluv.hsluvToHex();

    cache.set(s, hsluv.hex);
    return hsluv.hex;
}
