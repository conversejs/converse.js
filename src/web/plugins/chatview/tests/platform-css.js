import { page, userEvent } from 'vitest/browser';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';

async function openChat(_converse) {
    await mock.waitForRoster(_converse, 'current', 1);
    await mock.openChatBoxFor(_converse, contact_jid);
    return _converse.chatboxviews.get(contact_jid);
}

describe('A fullscreen chat', function () {
    afterEach(() => document.documentElement.style.removeProperty('font-size'));

    it(
        'is as high as the viewport, without a script measuring it',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'fullscreen' }, async function (_converse) {
            const view = await openChat(_converse);
            const flyout = await u.waitUntil(() => view.querySelector('.box-flyout'));
            const root = document.querySelector('converse-root');

            for (const height of [500, 720]) {
                await page.viewport(600, height);
                await u.waitUntil(() => window.innerHeight === height);
                expect(Math.round(flyout.getBoundingClientRect().height)).toBe(height);
                expect(Math.round(root.getBoundingClientRect().height)).toBe(height);
            }
            expect(document.documentElement.style.getPropertyValue('--vh')).toBe('');
        }),
    );

    it(
        'has text that grows with the text size the user chose',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'fullscreen' }, async function (_converse) {
            const view = await openChat(_converse);
            const composer = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            expect(getComputedStyle(composer).fontSize).toBe('14px');

            document.documentElement.style.fontSize = '32px';
            expect(getComputedStyle(composer).fontSize).toBe('28px');
        }),
    );
});

// Not the theme the mocks pick at random: cyberpunk shows a focused input with a
// glow, not an outline
const OUTLINED_THEME = { theme: 'classic', dark_theme: 'classic' };

describe('Keyboard focus', function () {
    it(
        'is visible on the message composer',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const view = await openChat(_converse);
            const composer = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            composer.blur();
            const resting = getComputedStyle(composer).outlineColor;

            composer.focus();
            const style = getComputedStyle(composer);
            expect(style.outlineStyle).toBe('solid');
            expect(style.outlineWidth).toBe('2px');
            expect(style.outlineColor).not.toBe(resting);
            expect(style.outlineColor).not.toBe(style.backgroundColor);
        }),
    );

    it(
        'is visible on the audio player controls, but a click does not show it',
        mock.initConverse(converse, ['chatBoxesFetched'], OUTLINED_THEME, async function (_converse) {
            // A failed load would disable the controls, so load nothing
            vi.spyOn(HTMLMediaElement.prototype, 'src', 'set').mockImplementation(() => {});
            const view = await openChat(_converse);
            await mock.sendMessage(_converse, view, 'https://conversejs.org/logo/audio.mp3');
            const mute = await u.waitUntil(() => view.querySelector('.audio-player__mute-btn'));
            const volume = view.querySelector('.audio-player__volume');

            await userEvent.click(mute);
            expect(document.activeElement).toBe(mute);
            expect(getComputedStyle(mute).outlineStyle).toBe('none');

            await userEvent.keyboard('{Tab}');
            expect(document.activeElement).toBe(volume);
            await u.waitUntil(() => getComputedStyle(volume).outlineStyle === 'solid');

            await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
            expect(document.activeElement).toBe(mute);
            await u.waitUntil(() => getComputedStyle(mute).outlineStyle === 'solid');
        }),
    );
});
