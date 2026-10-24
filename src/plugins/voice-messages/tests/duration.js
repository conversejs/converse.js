import { vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import {
    FakeMediaRecorder,
    answerSlotRequest,
    fakeUploads,
    installFakeMedia,
    openChat,
    settings,
} from './utils.js';

const { u } = converse.env;

/**
 * Click the microphone button with the clock under the test's control.
 */
async function startRecordingWithFakeClock(view) {
    const button = await u.waitUntil(() => view.querySelector('.toggle-voice-message'));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(view.querySelector('converse-audio-recorder .audio-recorder--recording')).not.toBe(null);
}

/** @param {number} ms */
async function advance(ms) {
    await vi.advanceTimersByTimeAsync(ms);
}

function shown(view, selector) {
    return view.querySelector(`converse-audio-recorder ${selector}`)?.textContent.trim();
}

describe('The voice message recorder', function () {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it(
        "doesn't count paused time",
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const media = installFakeMedia();
            const view = await openChat(_converse);
            await startRecordingWithFakeClock(view);
            media.recorder.emitData('hello');

            await advance(3000);
            expect(shown(view, '.recording-duration')).toBe('0:03');

            view.querySelector('converse-audio-recorder .btn-pause').click();
            await advance(0);
            expect(view.querySelector('converse-audio-recorder .audio-recorder--paused')).not.toBe(null);
            await advance(10000);
            expect(shown(view, '.recording-duration')).toBe('0:03');

            view.querySelector('converse-audio-recorder .btn-resume').click();
            await advance(2000);
            expect(shown(view, '.recording-duration')).toBe('0:05');

            view.querySelector('converse-audio-recorder .btn-stop').click();
            await advance(0);
            expect(view.querySelector('converse-audio-recorder .audio-recorder--uploading')).not.toBe(null);
        }),
    );

    it(
        'shows the time left near the limit and sends the recording when it is reached',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { ...settings, max_voice_message_duration: 60 },
            async function (_converse) {
                const media = installFakeMedia();
                const view = await openChat(_converse);
                await startRecordingWithFakeClock(view);
                media.recorder.emitData('hello');

                await advance(29000);
                expect(shown(view, '.recording-remaining')).toBe(undefined);
                await advance(1000);
                expect(shown(view, '.recording-remaining')).toBe('0:30 left');
                expect(view.querySelector('converse-audio-recorder [aria-live]').textContent).toBe('30 seconds left');
                await advance(1000);
                // Set once, so that it is only read out once
                expect(view.querySelector('converse-audio-recorder [aria-live]').textContent).toBe('30 seconds left');

                await advance(29000);
                expect(media.recorder.state).toBe('inactive');
                vi.useRealTimers();

                fakeUploads(201);
                await answerSlotRequest(_converse);
                await u.waitUntil(() => view.querySelector('.chat-content converse-audio-player'));
                await u.waitUntil(() => !view.querySelector('converse-audio-recorder .audio-recorder'));
                expect(media.tracks.every((t) => t.stopped)).toBe(true);
            },
        ),
    );

    it(
        "doesn't limit the duration by default",
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const media = installFakeMedia();
            const view = await openChat(_converse);
            await startRecordingWithFakeClock(view);
            await advance(65000);
            expect(media.recorder.state).toBe('recording');
            expect(shown(view, '.recording-duration')).toBe('1:05');
            expect(shown(view, '.recording-remaining')).toBe(undefined);
        }),
    );

    it(
        "stops before the recording outgrows the upload service's file size limit, whatever the configured duration",
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { ...settings, max_voice_message_duration: 300 },
            async function (_converse) {
                const media = installFakeMedia();
                // 320000 bytes at the default 32 kbps, with an eighth kept in hand, is 70 seconds.
                const view = await openChat(_converse, { max_file_size: 320000 });
                await startRecordingWithFakeClock(view);
                media.recorder.emitData('hello');

                await advance(39000);
                expect(shown(view, '.recording-remaining')).toBe(undefined);
                await advance(1000);
                expect(shown(view, '.recording-remaining')).toBe('0:30 left');
                await advance(30000);
                expect(media.recorder.state).toBe('inactive');
            },
        ),
    );

    it(
        'keeps a configured duration limit that is shorter than what the upload service allows',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { ...settings, max_voice_message_duration: 60 },
            async function (_converse) {
                const media = installFakeMedia();
                const view = await openChat(_converse, { max_file_size: 320000 });
                await startRecordingWithFakeClock(view);
                media.recorder.emitData('hello');

                await advance(59000);
                expect(media.recorder.state).toBe('recording');
                await advance(1000);
                expect(media.recorder.state).toBe('inactive');
            },
        ),
    );

    it(
        'can have its limit lowered while recording',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const media = installFakeMedia();
            const view = await openChat(_converse);
            await startRecordingWithFakeClock(view);
            media.recorder.emitData('hello');

            await advance(10000);
            view.querySelector('converse-audio-recorder').session.limitTo(15);
            await advance(4000);
            expect(media.recorder.state).toBe('recording');
            expect(shown(view, '.recording-remaining')).toBe('0:01 left');
            await advance(1000);
            expect(media.recorder.state).toBe('inactive');
        }),
    );

    for (const max_voice_message_duration of [0, null, Infinity]) {
        it(
            `doesn't limit the duration when max_voice_message_duration is ${max_voice_message_duration}`,
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                { ...settings, max_voice_message_duration },
                async function (_converse) {
                    const media = installFakeMedia();
                    const view = await openChat(_converse);
                    await startRecordingWithFakeClock(view);
                    await advance(65000);
                    expect(media.recorder.state).toBe('recording');
                    expect(shown(view, '.recording-duration')).toBe('1:05');
                    expect(shown(view, '.recording-remaining')).toBe(undefined);
                },
            ),
        );
    }

    it(
        'can limit the duration to longer than the browser can time in one go',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            // 2^31 ms is about 24.9 days
            { ...settings, max_voice_message_duration: 30 * 24 * 3600 },
            async function (_converse) {
                const media = installFakeMedia();
                const view = await openChat(_converse);
                await startRecordingWithFakeClock(view);
                await advance(1000);
                expect(media.recorder.state).toBe('recording');
            },
        ),
    );

    it(
        'records with the configured bitrate and format',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { ...settings, voice_message_bitrate: 48000, voice_message_mime_type: 'audio/ogg;codecs=opus' },
            async function (_converse) {
                const media = installFakeMedia();
                const view = await openChat(_converse);
                (await u.waitUntil(() => view.querySelector('.toggle-voice-message'))).click();
                await u.waitUntil(() => view.querySelector('converse-audio-recorder .btn-stop'));
                expect(media.recorder.options).toEqual({
                    audioBitsPerSecond: 48000,
                    mimeType: 'audio/ogg;codecs=opus',
                });
                media.recorder.emitData('hello');
                view.querySelector('converse-audio-recorder .btn-stop').click();

                fakeUploads(201);
                const request = (await answerSlotRequest(_converse)).querySelector('request');
                expect(request.getAttribute('content-type')).toBe('audio/ogg');
                expect(request.getAttribute('filename')).toMatch(/^voice-message-\d+\.ogg$/);
                await u.waitUntil(() => !view.querySelector('converse-audio-recorder .audio-recorder'));
            },
        ),
    );

    it(
        'falls back to a supported format',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { ...settings, voice_message_mime_type: 'audio/x-unsupported' },
            async function (_converse) {
                const media = installFakeMedia();
                FakeMediaRecorder.supported = ['audio/mp4'];
                try {
                    const view = await openChat(_converse);
                    (await u.waitUntil(() => view.querySelector('.toggle-voice-message'))).click();
                    await u.waitUntil(() => view.querySelector('converse-audio-recorder .btn-stop'));
                    expect(media.recorder.options.mimeType).toBe('audio/mp4');
                    media.recorder.emitData('hello');
                    view.querySelector('converse-audio-recorder .btn-stop').click();

                    fakeUploads(201);
                    const request = (await answerSlotRequest(_converse)).querySelector('request');
                    expect(request.getAttribute('content-type')).toBe('audio/mp4');
                    expect(request.getAttribute('filename')).toMatch(/^voice-message-\d+\.m4a$/);
                    await u.waitUntil(() => !view.querySelector('converse-audio-recorder .audio-recorder'));
                } finally {
                    FakeMediaRecorder.supported = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];
                }
            },
        ),
    );
});
