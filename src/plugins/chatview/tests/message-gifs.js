import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { sizzle, u } = converse.env;

describe('A Chat Message', function () {
    it(
        'will render gifs from their URLs',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const gif_url = 'https://media.giphy.com/media/Byana3FscAMGQ/giphy.gif';
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            spyOn(view.model, 'sendMessage').and.callThrough();
            await mock.sendMessage(_converse, view, gif_url);
            await u.waitUntil(() => view.querySelectorAll('.chat-content canvas').length);
            expect(view.model.sendMessage).toHaveBeenCalled();
            const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
            const html =
                `<converse-gif autoplay="" noloop="" fallback="empty" src="${gif_url}">` +
                `<canvas class="gif-canvas"><img class="gif" src="${gif_url}"></canvas></converse-gif>` +
                `<a target="_blank" rel="noopener" href="${gif_url}">${gif_url}</a>`;
            await u.waitUntil(() => msg.innerHTML.replace(/<!-.*?->/g, '').trim() === html, 1000);
        }),
    );

    it(
        'plays an animated GIF frame by frame, and pauses and resumes it when clicked',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const gif_url = `${location.origin}/base/src/shared/gif/tests/fixtures/animated.gif`;
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            await mock.sendMessage(_converse, view, gif_url);
            const el = await u.waitUntil(() => view.querySelector('.chat-content converse-gif'));
            await u.waitUntil(() => el.supergif?.frames.length === 2);
            expect(el.supergif.playing).toBe(true);

            const canvas = el.querySelector('canvas.gif-canvas');
            canvas.click();
            expect(el.supergif.playing).toBe(false);

            // Frame 0 is red, frame 1 is blue.
            const ctx = canvas.getContext('2d');
            el.supergif.frame_idx = 0;
            el.supergif.renderImage(false);
            expect([...ctx.getImageData(4, 4, 1, 1).data]).toEqual([255, 0, 0, 255]);
            el.supergif.frame_idx = 1;
            el.supergif.renderImage(false);
            expect([...ctx.getImageData(4, 4, 1, 1).data]).toEqual([0, 0, 255, 255]);

            canvas.click();
            expect(el.supergif.playing).toBe(true);
        }),
    );
});
