import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { sizzle, u } = converse.env;

describe('A Chat Message', function () {
    it(
        'will render webps from their URLs',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            spyOn(view.model, 'sendMessage').and.callThrough();

            for (const webp_url of [
                'https://www.gstatic.com/webp/gallery/1.webp',
                'https://www.gstatic.com/webp/animated/1.webp',
            ]) {
                await mock.sendMessage(_converse, view, webp_url);
                await u.waitUntil(() => view.querySelectorAll('.chat-content canvas').length);
                expect(view.model.sendMessage).toHaveBeenCalled();

                const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
                await u.waitUntil(() => msg.querySelector('converse-webp'), 1000);
                const webp_el = msg.querySelector('converse-webp');
                expect(webp_el?.getAttribute('src')).toBe(webp_url);
                expect(webp_el?.getAttribute('fallback')).toBe('empty');
                expect(webp_el.querySelector('canvas.gif-canvas')).not.toBeNull();
                expect(webp_el.querySelector('img.gif')?.getAttribute('src')).toBe(webp_url);
            }
        }),
    );

    it(
        'will not pause or play on click when the webp is a single static frame',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');

            const webp_url = 'https://www.gstatic.com/webp/gallery/1.webp';
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';

            await mock.openChatBoxFor(_converse, contact_jid);

            const view = _converse.chatboxviews.get(contact_jid);
            await mock.sendMessage(_converse, view, webp_url);

            await u.waitUntil(() => view.querySelector('.chat-content converse-webp')?.supergif, 2000);
            const webp_el = view.querySelector('.chat-content converse-webp');
            webp_el.supergif.frames = [{}];
            webp_el.supergif.playing = true;

            spyOn(webp_el.supergif, 'pause').and.callThrough();
            spyOn(webp_el.supergif, 'play').and.callThrough();
            webp_el.onControlsClicked(new MouseEvent('click'));

            expect(webp_el.supergif.pause).not.toHaveBeenCalled();
            expect(webp_el.supergif.play).not.toHaveBeenCalled();
            expect(webp_el.supergif.playing).toBeTrue();
        }),
    );

    it(
        'will pause and resume an animated webp when clicked',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');

            const webp_url = 'https://www.gstatic.com/webp/animated/1.webp';
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';

            await mock.openChatBoxFor(_converse, contact_jid);

            const view = _converse.chatboxviews.get(contact_jid);
            await mock.sendMessage(_converse, view, webp_url);

            await u.waitUntil(() => view.querySelector('.chat-content converse-webp')?.supergif, 2000);
            const webp_el = view.querySelector('.chat-content converse-webp');
            webp_el.supergif.frames = [{}, {}];
            webp_el.supergif.playing = true;

            spyOn(webp_el.supergif, 'pause').and.callThrough();
            spyOn(webp_el.supergif, 'play').and.callThrough();
            expect(webp_el.supergif.playing).toBeTrue();
            webp_el.onControlsClicked(new MouseEvent('click'));
            expect(webp_el.supergif.pause).toHaveBeenCalled();
            expect(webp_el.supergif.playing).toBeFalse();
            webp_el.onControlsClicked(new MouseEvent('click'));
            expect(webp_el.supergif.play).toHaveBeenCalled();
            expect(webp_el.supergif.playing).toBeTrue();
        }),
    );

});
