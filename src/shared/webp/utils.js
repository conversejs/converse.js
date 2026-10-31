// Enough bytes to cover the RIFF header and the flags of a VP8X chunk.
const HEADER_LENGTH = 21;

// The animation flag in a VP8X chunk's flags byte.
const ANIMATION_FLAG = 0x02;

/**
 * Whether the start of a WebP file declares it as animated, i.e. it's in the
 * extended ("VP8X") format and has the animation flag set.
 * @param {Uint8Array} bytes
 * @returns {boolean}
 */
export function isAnimatedWebPHeader(bytes) {
    const fourcc = (/** @type {number} */ offset) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
    return (
        bytes.length >= HEADER_LENGTH &&
        fourcc(0) === 'RIFF' &&
        fourcc(8) === 'WEBP' &&
        fourcc(12) === 'VP8X' &&
        (bytes[20] & ANIMATION_FLAG) !== 0
    );
}

/**
 * @param {Uint8Array[]} chunks
 * @param {number} length - The total length of the chunks
 * @returns {Uint8Array<ArrayBuffer>}
 */
function concat(chunks, length) {
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }
    return bytes;
}

/**
 * Fetches a WebP file, but stops after its header unless it's animated,
 * since static images are left to the browser to render.
 * @param {string} url
 * @param {AbortSignal} signal
 * @returns {Promise<ArrayBuffer|null>} The file's data if it's animated, otherwise `null`.
 */
export async function fetchAnimatedWebP(url, signal) {
    const response = await fetch(url, { signal });
    if (!response.ok || !response.body) return null;

    const reader = response.body.getReader();
    /** @type {Uint8Array[]} */
    const chunks = [];
    let length = 0;
    let checked = false;
    for (let result = await reader.read(); !result.done; result = await reader.read()) {
        chunks.push(result.value);
        length += result.value.length;
        if (!checked && length >= HEADER_LENGTH) {
            checked = true;
            if (!isAnimatedWebPHeader(concat(chunks, length))) {
                await reader.cancel();
                return null;
            }
        }
    }
    return checked ? concat(chunks, length).buffer : null;
}
