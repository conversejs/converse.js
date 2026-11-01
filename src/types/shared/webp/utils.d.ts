/**
 * Whether the start of a WebP file declares it as animated, i.e. it's in the
 * extended ("VP8X") format and has the animation flag set.
 * @param {Uint8Array} bytes
 * @returns {boolean}
 */
export function isAnimatedWebPHeader(bytes: Uint8Array): boolean;
/**
 * Fetches a WebP file, but stops after its header unless it's animated,
 * since static images are left to the browser to render.
 * @param {string} url
 * @param {AbortSignal} signal
 * @returns {Promise<ArrayBuffer|null>} The file's data if it's animated, otherwise `null`.
 */
export function fetchAnimatedWebP(url: string, signal: AbortSignal): Promise<ArrayBuffer | null>;
/**
 * Decodes the frames of an animated WebP. The frames are fully composited,
 * so each one can be drawn on its own.
 *
 * Throws if the image can't be decoded, is larger than `max_pixels` (summed
 * over all frames) or `signal` is aborted. Frames decoded until then are freed.
 *
 * @param {ArrayBuffer} data
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {number} [options.max_pixels]
 * @returns {Promise<import('./types').WebPFrames>}
 */
export function decodeWebP(data: ArrayBuffer, { signal, max_pixels }?: {
    signal?: AbortSignal;
    max_pixels?: number;
}): Promise<import("./types").WebPFrames>;
export const MAX_DECODED_PIXELS: 50000000;
//# sourceMappingURL=utils.d.ts.map