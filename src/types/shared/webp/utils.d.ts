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
//# sourceMappingURL=utils.d.ts.map