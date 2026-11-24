import { vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import { answerSlotRequest, fakeUploads, installFakeMedia, openChat, settings, startRecording } from './utils.js';

const { u } = converse.env;

describe('A voice message', function () {
    afterEach(() => vi.unstubAllGlobals());

    it(
        'is recorded, uploaded and sent in a one-to-one chat',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const media = installFakeMedia();
            const view = await openChat(_converse);
            await startRecording(view);

            const { recorder } = media;
            expect(recorder.options).toEqual({ audioBitsPerSecond: 32000, mimeType: 'audio/mp4' });
            recorder.emitData('first chunk');
            recorder.emitData('second');
            view.querySelector('converse-audio-recorder .btn-stop').click();

            fakeUploads(201);
            const iq = await answerSlotRequest(_converse);
            const request = iq.querySelector('request');
            expect(request.getAttribute('content-type')).toBe('audio/mp4');
            expect(request.getAttribute('size')).toBe(String('first chunk'.length + 'second'.length));
            expect(request.getAttribute('filename')).toMatch(/^voice-message-\d+\.m4a$/);

            const player = await u.waitUntil(() => view.querySelector('.chat-content converse-audio-player'));
            expect(player.getAttribute('src')).toBe('https://upload.montague.tld/voice.m4a');
            await u.waitUntil(() => !view.querySelector('converse-audio-recorder .audio-recorder'));
            expect(media.tracks.every((t) => t.stopped)).toBe(true);
            expect(view.model.ui.get('voice_recorder')).toBe(false);
        }),
    );
});
