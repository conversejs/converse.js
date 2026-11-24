import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import { encodeOpus } from '../encode.js';

/**
 * A mono 16-bit WAV file holding a sine tone.
 * @param {number} seconds
 * @param {number} sampleRate
 * @returns {Blob}
 */
function toneWav(seconds, sampleRate) {
    const samples = Math.round(seconds * sampleRate);
    const view = new DataView(new ArrayBuffer(44 + samples * 2));
    const write = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    write(0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
    write(8, 'WAVEfmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, 'data');
    view.setUint32(40, samples * 2, true);
    for (let i = 0; i < samples; i++) {
        view.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 16000), true);
    }
    return new Blob([view.buffer], { type: 'audio/wav' });
}

describe('A voice message encoder', function () {
    it('re-encodes a recording as Opus in an MP4 with its index up front', async function () {
        const encoded = await encodeOpus(toneWav(0.5, 48000), 32000);
        expect(encoded).not.toBe(null);

        const bytes = new Uint8Array(await encoded.arrayBuffer());
        const text = new TextDecoder('latin1').decode(bytes);
        expect(text).toContain('moov');
        expect(text).not.toContain('moof');

        const input = new Input({ source: new BlobSource(encoded), formats: ALL_FORMATS });
        const track = await input.getPrimaryAudioTrack();
        expect(await track.getCodec()).toBe('opus');
        expect(await input.computeDuration()).toBeCloseTo(0.5, 1);
    });
});
