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
export async function encodeOpus(blob, bitrate) {
    // Loaded on first use, so that visitors who never record don't download it
    const { ALL_FORMATS, BlobSource, BufferTarget, canEncodeAudio, Conversion, Input, Mp4OutputFormat, Output } =
        await import('mediabunny');
    if (!(await canEncodeAudio('opus'))) return null;

    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    const output = new Output({
        format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
        target: new BufferTarget(),
    });
    const conversion = await Conversion.init({
        input,
        output,
        audio: { codec: 'opus', bitrate, forceTranscode: true },
    });
    if (!conversion.isValid) return null;

    await conversion.execute();
    return new Blob([output.target.buffer], { type: 'audio/mp4' });
}
