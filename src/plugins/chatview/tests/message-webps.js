import { vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

const fixtures = `${location.origin}/base/src/shared/webp/tests/fixtures`;
const animated_url = `${fixtures}/animated.webp`;
const static_url = `${fixtures}/static.webp`;
const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';

/**
 * @param {any} _converse
 * @param {string} body
 */
async function sendAndGetMessage(_converse, body) {
    await mock.waitForRoster(_converse, 'current');
    await mock.openChatBoxFor(_converse, contact_jid);
    const view = _converse.chatboxviews.get(contact_jid);
    await mock.sendMessage(_converse, view, body);
    return u.waitUntil(() => view.querySelector('.chat-content .chat-msg:last-child .chat-msg__text'));
}

describe('A Chat Message containing a WebP URL', function () {
    it(
        'renders an animated WebP in a player, drawing each frame in place of the previous one',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const msg = await sendAndGetMessage(_converse, animated_url);
            const el = await u.waitUntil(() => msg.querySelector('converse-webp'));
            await u.waitUntil(() => el.supergif?.frames.length === 2);
            expect(el.getAttribute('src')).toBe(animated_url);
            expect(msg.querySelector('a').getAttribute('href')).toBe(animated_url);

            el.supergif.pause();
            el.supergif.frame_idx = 1;
            el.supergif.renderImage(false);
            const ctx = el.querySelector('canvas.gif-canvas').getContext('2d');
            // Frame 0 is red on the left half, frame 1 is blue on the right half,
            // so nothing of frame 0 may show through frame 1's transparent left half.
            expect([...ctx.getImageData(1, 4, 1, 1).data]).toEqual([0, 0, 0, 0]);
            expect([...ctx.getImageData(6, 4, 1, 1).data]).toEqual([0, 0, 255, 255]);
        }),
    );

    it(
        'pauses and resumes an animated WebP when clicked',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const msg = await sendAndGetMessage(_converse, animated_url);
            const el = await u.waitUntil(() => msg.querySelector('converse-webp'));
            await u.waitUntil(() => el.supergif?.frames.length === 2);
            expect(el.supergif.playing).toBe(true);

            const canvas = el.querySelector('canvas.gif-canvas');
            canvas.click();
            expect(el.supergif.playing).toBe(false);
            canvas.click();
            expect(el.supergif.playing).toBe(true);
        }),
    );

    it(
        'renders a static WebP as a regular image',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const msg = await sendAndGetMessage(_converse, static_url);
            const el = await u.waitUntil(() => msg.querySelector('converse-webp'));
            const img = await u.waitUntil(() => el.querySelector('img.chat-image'));
            expect(img.getAttribute('src')).toBe(static_url);
            expect(el.querySelector('canvas')).toBeNull();

            // Its header shows it isn't animated, so no player is created for it.
            await u.waitUntil(() => el.probed);
            expect(el.is_animated).toBe(false);
            expect(el.supergif).toBeFalsy();
            expect(el.querySelector('canvas')).toBeNull();
        }),
    );

    it(
        'opens a static WebP in the image modal when clicked, like other images',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const msg = await sendAndGetMessage(_converse, static_url);
            const loaded = new Promise((resolve) => msg.addEventListener('imageLoaded', resolve, { once: true }));
            const img = await u.waitUntil(() => msg.querySelector('converse-webp img.chat-image'));
            await loaded;

            const show = vi.spyOn(_converse.api.modal, 'show').mockReturnValue(undefined);
            img.click();
            expect(show).toHaveBeenCalledWith('converse-image-modal', expect.objectContaining({ src: static_url }), expect.anything());
        }),
    );

    it(
        'is shown only as a link when the image cannot be loaded',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const missing_url = `${fixtures}/missing.webp`;
            const msg = await sendAndGetMessage(_converse, missing_url);
            const el = await u.waitUntil(() => msg.querySelector('converse-webp'));
            await u.waitUntil(() => el.img_error);
            await el.updateComplete;
            expect(el.querySelector('img, canvas')).toBeNull();
            expect(msg.querySelector('a').getAttribute('href')).toBe(missing_url);
        }),
    );

    it(
        'renders the new source when the src of a static WebP changes',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const msg = await sendAndGetMessage(_converse, static_url);
            const el = await u.waitUntil(() => msg.querySelector('converse-webp'));
            await u.waitUntil(() => el.querySelector('img.chat-image'));

            el.src = animated_url;
            await u.waitUntil(() => el.supergif?.frames.length === 2);
            expect(el.querySelector('canvas.gif-canvas')).not.toBeNull();
            expect(el.querySelector('img.chat-image')).toBeNull();
        }),
    );

    it(
        'frees the decoded frames when removed, and decodes them again when reattached',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const msg = await sendAndGetMessage(_converse, animated_url);
            const el = await u.waitUntil(() => msg.querySelector('converse-webp'));
            await u.waitUntil(() => el.supergif?.frames.length === 2);
            const old_player = el.supergif;
            const bitmaps = old_player.frames.map((f) => f.bitmap);

            const parent = el.parentElement;
            el.remove();
            expect(el.supergif).toBeNull();
            expect(old_player.playing).toBe(false);
            expect(old_player.frames).toHaveLength(0);
            // A closed ImageBitmap reports a size of zero.
            expect(bitmaps.map((b) => b.width)).toEqual([0, 0]);

            parent.prepend(el);
            await u.waitUntil(() => el.supergif?.frames.length === 2);
            expect(el.supergif).not.toBe(old_player);
        }),
    );

    it(
        'falls back to a regular image when the browser cannot decode it',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            vi.stubGlobal('ImageDecoder', undefined);
            try {
                const msg = await sendAndGetMessage(_converse, animated_url);
                const el = await u.waitUntil(() => msg.querySelector('converse-webp'));
                const img = await u.waitUntil(() => el.querySelector('img.chat-image'));
                expect(img.getAttribute('src')).toBe(animated_url);
                expect(el.querySelector('canvas')).toBeNull();
            } finally {
                vi.unstubAllGlobals();
            }
        }),
    );

    it(
        'is shown only as a link when media rendering is disabled',
        mock.initConverse(converse, ['chatBoxesFetched'], { render_media: false }, async function (_converse) {
            const msg = await sendAndGetMessage(_converse, animated_url);
            await u.waitUntil(() => msg.querySelector('a'));
            expect(msg.querySelector('a').getAttribute('href')).toBe(animated_url);
            expect(msg.querySelector('converse-webp')).toBeNull();
        }),
    );

    it(
        'is not turned into a link when it uses an unapproved protocol',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const script_url = 'javascript://%0aalert(1)//x.webp'; // eslint-disable-line no-script-url
            // The static WebP renders once the message's media URLs have been processed.
            const msg = await sendAndGetMessage(_converse, `${script_url} ${static_url}`);
            await u.waitUntil(() => msg.querySelector(`converse-webp[src="${static_url}"]`));
            expect(msg.querySelector('a[href^="javascript"]')).toBeNull();
            expect(msg.textContent).toContain(script_url);
        }),
    );
});
