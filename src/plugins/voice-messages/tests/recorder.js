import { vi } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import { installFakeMedia, openChat, settings, startRecording } from './utils.js';

const { u } = converse.env;

function slotRequests(_converse) {
    return _converse.api.connection
        .get()
        .IQ_stanzas.filter((iq) => iq.querySelector('iq[to="upload.montague.tld"] request'));
}

describe('The voice message recorder', function () {
    afterEach(() => vi.unstubAllGlobals());

    it(
        'takes focus when it opens',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            installFakeMedia();
            const view = await openChat(_converse);
            await startRecording(view);
            await u.waitUntil(
                () => document.activeElement === view.querySelector('converse-audio-recorder .btn-pause'),
            );
        }),
    );

    it(
        'discards the recording when cancelled, even if the recorder stops afterwards',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const media = installFakeMedia();
            const view = await openChat(_converse);
            await startRecording(view);
            const { recorder } = media;
            recorder.auto_stop = false;
            recorder.emitData('hello');

            view.querySelector('converse-audio-recorder .btn-cancel').click();
            await u.waitUntil(() => !view.querySelector('converse-audio-recorder .audio-recorder'));
            expect(view.model.ui.get('voice_recorder')).toBe(false);
            expect(media.tracks.every((t) => t.stopped)).toBe(true);
            expect(recorder.state).toBe('inactive');
            expect(document.activeElement).toBe(view.querySelector('.chat-textarea'));

            // The browser's late stop event produces neither a recording nor an error
            recorder.emitData('late');
            recorder.emitStop();
            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(slotRequests(_converse).length).toBe(0);
            expect(view.querySelector('converse-audio-recorder .audio-recorder')).toBe(null);
        }),
    );

    it(
        'cancels when Enter is pressed on its focused Cancel button',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const media = installFakeMedia();
            const view = await openChat(_converse);
            await startRecording(view);
            media.recorder.emitData('hello');

            view.querySelector('converse-audio-recorder .btn-cancel').focus();
            await userEvent.keyboard('{Enter}');
            await u.waitUntil(() => !view.querySelector('converse-audio-recorder .audio-recorder'));
            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(slotRequests(_converse).length).toBe(0);
            expect(media.tracks.every((t) => t.stopped)).toBe(true);
        }),
    );

    it(
        'cancels when Escape is pressed inside it',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const media = installFakeMedia();
            const view = await openChat(_converse);
            await startRecording(view);

            await userEvent.keyboard('{Escape}');
            await u.waitUntil(() => !view.querySelector('converse-audio-recorder .audio-recorder'));
            expect(media.tracks.every((t) => t.stopped)).toBe(true);
            expect(slotRequests(_converse).length).toBe(0);
        }),
    );

    it(
        "doesn't intercept keys pressed outside of it",
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            installFakeMedia();
            const view = await openChat(_converse);
            await startRecording(view);

            for (const key of ['Escape', 'Enter', ' ']) {
                const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
                document.body.dispatchEvent(ev);
                expect(ev.defaultPrevented).toBe(false);
            }
            expect(view.querySelector('converse-audio-recorder .audio-recorder--recording')).not.toBe(null);
        }),
    );

    it(
        'releases the microphone when the chat is closed while recording',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const media = installFakeMedia();
            const view = await openChat(_converse);
            await startRecording(view);
            const { recorder } = media;

            await view.close();
            await u.waitUntil(() => media.tracks.every((t) => t.stopped));
            expect(recorder.state).toBe('inactive');
            expect(recorder.ondataavailable).toBe(null);
            expect(recorder.onstop).toBe(null);
            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(slotRequests(_converse).length).toBe(0);
        }),
    );
});
