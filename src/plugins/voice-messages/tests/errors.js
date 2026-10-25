import { vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import {
    answerSlotRequest,
    fakeUploads,
    installFakeMedia,
    openChat,
    openRecorder,
    settings,
    startRecording,
} from './utils.js';

const { u } = converse.env;

function slotRequests(_converse) {
    return _converse.api.connection
        .get()
        .IQ_stanzas.filter((iq) => iq.querySelector('iq[to="upload.montague.tld"] request'));
}

async function recordAndFailUpload(_converse, view) {
    const media = installFakeMedia();
    await startRecording(view);
    media.recorder.emitData('hello');
    view.querySelector('converse-audio-recorder .btn-stop').click();
    fakeUploads(500);
    await answerSlotRequest(_converse);
    await u.waitUntil(() => view.querySelector('converse-audio-recorder .audio-recorder--error'));
    return media;
}

describe('The voice message recorder', function () {
    afterEach(() => vi.unstubAllGlobals());

    for (const [error, message] of [
        ['NotAllowedError', 'Microphone permission denied. Please enable microphone access in browser settings.'],
        ['NotFoundError', 'No microphone found. Please connect a microphone and try again.'],
    ]) {
        it(
            `explains a ${error} from the browser and sends nothing`,
            mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
                installFakeMedia({ error });
                const view = await openChat(_converse);
                await openRecorder(view);

                const el = await u.waitUntil(() =>
                    view.querySelector('converse-audio-recorder .audio-recorder--error'),
                );
                expect(el.querySelector('.error-message').textContent).toBe(message);
                expect(el.querySelector('.recorder-error').getAttribute('role')).toBe('alert');
                expect(el.querySelector('.btn-retry')).toBe(null);
                await u.waitUntil(() => document.activeElement === el.querySelector('.composer-panel__close'));

                // Keys pressed elsewhere aren't intercepted
                for (const key of ['Escape', 'Enter', ' ']) {
                    const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
                    document.body.dispatchEvent(ev);
                    expect(ev.defaultPrevented).toBe(false);
                }

                el.querySelector('.composer-panel__close').click();
                await u.waitUntil(() => !view.querySelector('converse-audio-recorder .audio-recorder'));
                expect(slotRequests(_converse).length).toBe(0);
            }),
        );
    }

    it(
        'keeps the recording when the upload fails, so that it can be sent again',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const view = await openChat(_converse);
            const media = await recordAndFailUpload(_converse, view);

            const el = view.querySelector('converse-audio-recorder');
            expect(el.querySelector('.error-message').textContent).toBe(
                'Sorry, could not successfully upload your file.',
            );
            expect(media.tracks.every((t) => t.stopped)).toBe(true);

            fakeUploads(201);
            el.querySelector('.btn-retry').click();
            const iq = await answerSlotRequest(_converse);
            expect(iq.querySelector('request').getAttribute('size')).toBe('5');
            await u.waitUntil(() => view.querySelector('.chat-content converse-audio-player'));
            await u.waitUntil(() => !view.querySelector('converse-audio-recorder .audio-recorder'));
        }),
    );

    it(
        'can discard the recording when the upload fails',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const view = await openChat(_converse);
            await recordAndFailUpload(_converse, view);

            view.querySelector('converse-audio-recorder .composer-panel__close').click();
            await u.waitUntil(() => !view.querySelector('converse-audio-recorder .audio-recorder'));
            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(slotRequests(_converse).length).toBe(0);
        }),
    );

    it(
        'can ask for the microphone again after permission was denied',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const media = installFakeMedia({ error: 'NotAllowedError' });
            const view = await openChat(_converse);
            await openRecorder(view);
            await u.waitUntil(() => view.querySelector('converse-audio-recorder .audio-recorder--error'));

            media.getUserMedia.mockRestore();
            installFakeMedia();
            await openRecorder(view);
            await u.waitUntil(() => view.querySelector('converse-audio-recorder .audio-recorder--recording'));
        }),
    );

    it(
        "doesn't send the recording by itself when the microphone goes away",
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const media = installFakeMedia();
            const view = await openChat(_converse);
            await startRecording(view);
            media.recorder.emitData('hello');

            // The browser stops the recorder when its track ends
            media.recorder.state = 'inactive';
            media.recorder.emitStop();

            const el = await u.waitUntil(() => view.querySelector('converse-audio-recorder .audio-recorder--error'));
            expect(el.querySelector('.error-message').textContent).toBe(
                'Recording stopped unexpectedly. Your microphone may have been disconnected.',
            );
            expect(media.tracks.every((t) => t.stopped)).toBe(true);
            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(slotRequests(_converse).length).toBe(0);

            const send = el.querySelector('.btn-retry');
            expect(send.textContent.trim()).toBe('Send');
            fakeUploads(201);
            send.click();
            await answerSlotRequest(_converse);
            await u.waitUntil(() => view.querySelector('.chat-content converse-audio-player'));
            await u.waitUntil(() => !view.querySelector('converse-audio-recorder .audio-recorder'));
        }),
    );

    it(
        'can be closed while uploading, leaving the upload to the chat',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const media = installFakeMedia();
            const view = await openChat(_converse);
            await startRecording(view);
            media.recorder.emitData('hello');
            view.querySelector('converse-audio-recorder .btn-stop').click();
            const el = await u.waitUntil(() => view.querySelector('converse-audio-recorder .audio-recorder--uploading'));
            expect(el.querySelector('.composer-panel__close').getAttribute('aria-label')).toBe('Close');

            const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
            el.querySelector('.composer-panel').dispatchEvent(ev);
            expect(ev.defaultPrevented).toBe(true);
            await u.waitUntil(() => !view.querySelector('converse-audio-recorder .audio-recorder'));

            fakeUploads(201);
            await answerSlotRequest(_converse);
            await u.waitUntil(() => view.querySelector('.chat-content converse-audio-player'));
            expect(view.querySelector('converse-audio-recorder .audio-recorder')).toBe(null);
        }),
    );

    it(
        'shows an error when a plugin fails after the upload',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            _converse.api.listen.on('afterFileUploaded', () => {
                throw new Error('Nope');
            });
            const media = installFakeMedia();
            const view = await openChat(_converse);
            await startRecording(view);
            media.recorder.emitData('hello');
            view.querySelector('converse-audio-recorder .btn-stop').click();
            fakeUploads(201);
            await answerSlotRequest(_converse);

            const el = await u.waitUntil(() => view.querySelector('converse-audio-recorder .audio-recorder--error'));
            expect(el.querySelector('.error-message').textContent).toBe(
                'Sorry, could not successfully upload your file.',
            );
            expect(el.querySelector('.btn-retry').textContent.trim()).toBe('Retry');
        }),
    );

    it(
        "isn't affected by an earlier upload which finishes after it was closed",
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const media = installFakeMedia();
            const view = await openChat(_converse);

            await startRecording(view);
            media.recorder.emitData('first');
            view.querySelector('converse-audio-recorder .btn-stop').click();
            const first = await u.waitUntil(() => slotRequests(_converse)[0]);
            view.querySelector('converse-audio-recorder .audio-recorder--uploading .composer-panel__close').click();
            await u.waitUntil(() => !view.querySelector('converse-audio-recorder .audio-recorder'));

            await startRecording(view);
            media.recorder.emitData('second');
            view.querySelector('converse-audio-recorder .btn-stop').click();
            await u.waitUntil(() => slotRequests(_converse).length === 2);
            await u.waitUntil(() => view.querySelector('converse-audio-recorder .audio-recorder--uploading'));

            // The first upload fails, which is reported in the chat but not in the recorder
            const failing = fakeUploads(500);
            await answerSlotRequest(_converse, 'https://upload.montague.tld/first.weba', first);
            await u.waitUntil(() => view.model.messages.models.some((m) => m.get('upload') === 'failure'));
            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(view.querySelector('converse-audio-recorder .audio-recorder--uploading')).not.toBe(null);
            failing.mockRestore();

            fakeUploads(201);
            await answerSlotRequest(_converse);
            await u.waitUntil(() => !view.querySelector('converse-audio-recorder .audio-recorder'));
        }),
    );

    it(
        'explains when the recording is too large for the server',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const media = installFakeMedia();
            const view = await openChat(_converse, { max_file_size: 3 });
            await startRecording(view);
            media.recorder.emitData('hello');
            view.querySelector('converse-audio-recorder .btn-stop').click();

            const el = await u.waitUntil(() => view.querySelector('converse-audio-recorder .audio-recorder--error'));
            const text = el.querySelector('.error-message').textContent;
            expect(text).toMatch(/^The size of your file, voice-message-\d+\.weba, exceeds the maximum allowed/);
            expect(text).toMatch(/by your server, which is 3 B\.$/);
            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(slotRequests(_converse).length).toBe(0);
        }),
    );

    it(
        "doesn't send a recording without any audio",
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            installFakeMedia();
            const view = await openChat(_converse);
            await startRecording(view);
            view.querySelector('converse-audio-recorder .btn-stop').click();

            const el = await u.waitUntil(() => view.querySelector('converse-audio-recorder .audio-recorder--error'));
            expect(el.querySelector('.error-message').textContent).toBe(
                'Nothing was recorded. Please check that your microphone is working.',
            );
            expect(el.querySelector('.btn-retry')).toBe(null);
            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(slotRequests(_converse).length).toBe(0);

            el.querySelector('.composer-panel__close').click();
            await u.waitUntil(() => !view.querySelector('converse-audio-recorder .audio-recorder'));
        }),
    );
});
