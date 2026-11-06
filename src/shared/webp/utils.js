// Enough bytes to cover the RIFF header and the flags of a VP8X chunk.
const HEADER_LENGTH = 21;

// Beyond this many decoded pixels (summed over all frames) we don't keep the
// frames in memory, and instead leave the image for the browser to render.
export const MAX_DECODED_PIXELS = 50_000_000;

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
export async function decodeWebP(data, { signal, max_pixels = MAX_DECODED_PIXELS } = {}) {
    if (!globalThis.ImageDecoder) {
        throw new Error('ImageDecoder is not supported by this browser');
    }

    /** @type {import('./types').WebPFrame[]} */
    const frames = [];
    const decoder = new ImageDecoder({ data, type: 'image/webp' });
    try {
        await decoder.tracks.ready;
        const frame_count = decoder.tracks.selectedTrack.frameCount;
        if (!frame_count) throw new Error('No frames found');

        if (frame_count === 1) {
            return { frames, is_static: true };
        }

        for (let i = 0; i < frame_count; i++) {
            const { image } = await decoder.decode({ frameIndex: i });
            try {
                signal?.throwIfAborted();
                // All frames have the full image's size, so the first one
                // tells us the total for all of them.
                const width = image.displayWidth;
                const height = image.displayHeight;
                if (i === 0 && width * height * frame_count > max_pixels) {
                    throw new Error('Too large to decode');
                }
                frames.push({
                    bitmap: await createImageBitmap(image),
                    dims: { width, height, left: 0, top: 0 },
                    delay: (image.duration ?? 0) / 1000, // microseconds to milliseconds
                });
            } finally {
                image.close();
            }
        }
        signal?.throwIfAborted();
        return { frames, is_static: false };
    } catch (e) {
        frames.forEach((frame) => frame.bitmap.close());
        throw e;
    } finally {
        decoder.close();
    }
}
