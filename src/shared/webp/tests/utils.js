import { vi } from 'vitest';
import { decodeWebP, fetchAnimatedWebP, isAnimatedWebPHeader } from 'shared/webp/utils.js';

const fixtures = `${location.origin}/base/src/shared/webp/tests/fixtures`;

/**
 * @param {string} name
 * @returns {Promise<ArrayBuffer>}
 */
async function getFixture(name) {
    return (await fetch(`${fixtures}/${name}`)).arrayBuffer();
}

describe('isAnimatedWebPHeader', function () {
    it('is true for an animated WebP', async function () {
        expect(isAnimatedWebPHeader(new Uint8Array(await getFixture('animated.webp')))).toBe(true);
    });

    it('is false for a static WebP in the simple format', async function () {
        expect(isAnimatedWebPHeader(new Uint8Array(await getFixture('static.webp')))).toBe(false);
    });

    it('is false for a static WebP in the extended format', async function () {
        // Extended ("VP8X") because it has an alpha channel, but without the animation flag
        expect(isAnimatedWebPHeader(new Uint8Array(await getFixture('static-alpha.webp')))).toBe(false);
    });

    it('is false for data that is too short or not a WebP', async function () {
        const animated = new Uint8Array(await getFixture('animated.webp'));
        expect(isAnimatedWebPHeader(animated.subarray(0, 20))).toBe(false);
        expect(isAnimatedWebPHeader(new TextEncoder().encode('GIF89a and some more bytes'))).toBe(false);
    });
});

describe('fetchAnimatedWebP', function () {
    it('returns the whole file for an animated WebP', async function () {
        const data = await fetchAnimatedWebP(`${fixtures}/animated.webp`, new AbortController().signal);
        expect(data.byteLength).toBe((await getFixture('animated.webp')).byteLength);
    });

    it('returns null for a static WebP', async function () {
        const { signal } = new AbortController();
        expect(await fetchAnimatedWebP(`${fixtures}/static.webp`, signal)).toBeNull();
        expect(await fetchAnimatedWebP(`${fixtures}/static-alpha.webp`, signal)).toBeNull();
    });

    it('returns null when the file is missing', async function () {
        vi.stubGlobal('fetch', () => Promise.resolve(new Response('Not Found', { status: 404 })));
        try {
            expect(await fetchAnimatedWebP(`${fixtures}/missing.webp`, new AbortController().signal)).toBeNull();
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

describe('decodeWebP', function () {
    it('decodes each frame of an animated WebP', async function () {
        const { frames, is_static } = await decodeWebP(await getFixture('animated.webp'));
        expect(is_static).toBe(false);
        expect(frames).toHaveLength(2);
        for (const frame of frames) {
            expect(frame.bitmap.width).toBe(8);
            expect(frame.dims).toEqual({ width: 8, height: 8, left: 0, top: 0 });
            expect(frame.delay).toBeGreaterThan(0);
            frame.bitmap.close();
        }
    });

    it("doesn't decode a static WebP", async function () {
        expect(await decodeWebP(await getFixture('static.webp'))).toEqual({ frames: [], is_static: true });
    });

    it('refuses an image with more pixels, summed over all frames, than allowed', async function () {
        const data = await getFixture('animated.webp');
        // Two frames of 8x8 pixels
        await expect(decodeWebP(data, { max_pixels: 2 * 8 * 8 - 1 })).rejects.toThrow('Too large to decode');
        const { frames } = await decodeWebP(data, { max_pixels: 2 * 8 * 8 });
        expect(frames).toHaveLength(2);
        frames.forEach((frame) => frame.bitmap.close());
    });

    it('stops, and frees the decoded frames, when aborted', async function () {
        const controller = new AbortController();
        const bitmaps = [];
        const createImageBitmap = globalThis.createImageBitmap;
        vi.stubGlobal('createImageBitmap', async (/** @type {VideoFrame} */ image) => {
            const bitmap = await createImageBitmap(image);
            bitmaps.push(bitmap);
            controller.abort();
            return bitmap;
        });
        try {
            await expect(decodeWebP(await getFixture('animated.webp'), { signal: controller.signal })).rejects.toThrow();
        } finally {
            vi.unstubAllGlobals();
        }
        // Aborted after the first frame, which was then freed
        expect(bitmaps).toHaveLength(1);
        expect(bitmaps[0].width).toBe(0);
    });

    it('throws when the browser has no ImageDecoder', async function () {
        vi.stubGlobal('ImageDecoder', undefined);
        try {
            await expect(decodeWebP(await getFixture('animated.webp'))).rejects.toThrow('ImageDecoder is not supported');
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
