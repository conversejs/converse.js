/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
/**
 * Re-encode a recording as Opus in an MP4 file with its index at the front.
 *
 * Browsers record MP4 as a fragmented file, which Android's media player can't
 * seek in, so a voice message would play but its position couldn't be moved.
 *
 * @param {Blob} blob - The recording, in any format the browser can decode.
 * @param {number} bitrate - In bits per second.
 * @returns {Promise<Blob|null>} `null` when the browser can't encode Opus or can't
 *  read the recording.
 */
export function encodeOpus(blob: Blob, bitrate: number): Promise<Blob | null>;
//# sourceMappingURL=encode.d.ts.map