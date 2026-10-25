import { vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import {
    answerSlotRequest,
    contact_jid,
    fakeUploads,
    installFakeMedia,
    openChat,
    settings,
    startRecording,
    waitForUploadService,
} from './utils.js';

const { u } = converse.env;

const muc_jid = 'lounge@montague.lit';

async function openMUC(_converse, features = [], role = 'participant') {
    await waitForUploadService(_converse);
    await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features, [], true, {}, 'member', role);
    return _converse.chatboxviews.get(muc_jid);
}

const VOICE_ITEM = '.attachment-menu__item[data-name="voice-message"]';
const FILE_ITEM = '.attachment-menu__item[data-name="file"]';

describe('The voice message attachment', function () {
    afterEach(() => vi.unstubAllGlobals());

    it(
        'is listed last in the attachment menu',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { ...settings, visible_toolbar_buttons: { location: true } },
            async function (_converse) {
                installFakeMedia();
                const view = await openChat(_converse);
                await mock.openAttachmentMenu(view);
                expect(mock.attachmentMenuItems(view)).toEqual([
                    'Send a file',
                    'Send an image',
                    'Share your location',
                    'Record a voice message',
                ]);
                expect(view.querySelector(`${VOICE_ITEM} converse-icon`).getAttribute('class')).toBe(
                    'fa fa-microphone',
                );
            },
        ),
    );

    it(
        "isn't listed when the plugin isn't loaded",
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { blacklisted_plugins: ['converse-voice-messages'] },
            async function (_converse) {
                installFakeMedia();
                const view = await openChat(_converse);
                await u.waitUntil(() => view.querySelector(FILE_ITEM));
                expect(view.querySelector(VOICE_ITEM)).toBe(null);
                expect(view.querySelector('converse-audio-recorder')).toBe(null);
            },
        ),
    );

    it(
        "isn't listed when the browser can't record",
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            vi.stubGlobal('MediaRecorder', undefined);
            const view = await openChat(_converse);
            await u.waitUntil(() => view.querySelector(FILE_ITEM));
            expect(view.querySelector(VOICE_ITEM)).toBe(null);
        }),
    );

    it(
        "isn't listed when the server doesn't support HTTP File Upload, so there is no paperclip",
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            installFakeMedia();
            await mock.waitUntilDiscoConfirmed(
                _converse,
                _converse.domain,
                [{ category: 'server', type: 'IM' }],
                ['http://jabber.org/protocol/disco#items'],
                [],
                'info',
            );
            await mock.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], [], 'items');
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            const menu = await u.waitUntil(() => view.querySelector('.chat-toolbar converse-attachment-menu'));
            await menu.initialized;
            await menu.updateComplete;
            expect(view.querySelector(VOICE_ITEM)).toBe(null);
            expect(view.querySelector('.chat-toolbar .toggle-attachment-menu')).toBe(null);
        }),
    );

    it(
        "isn't listed when hidden through visible_toolbar_buttons",
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { ...settings, visible_toolbar_buttons: { voice_message: false } },
            async function (_converse) {
                installFakeMedia();
                const view = await openChat(_converse);
                await u.waitUntil(() => view.querySelector(FILE_ITEM));
                expect(view.querySelector(VOICE_ITEM)).toBe(null);
            },
        ),
    );

    it(
        "isn't offered to a visitor in a moderated groupchat",
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            installFakeMedia();
            const view = await openMUC(_converse, ['moderated'], 'visitor');
            await u.waitUntil(() => view.querySelector('.muc-bottom-panel--muted'));
            expect(view.querySelector('converse-attachment-menu')).toBe(null);
            expect(view.querySelector('converse-audio-recorder')).toBe(null);
        }),
    );
});

describe('A voice message', function () {
    afterEach(() => vi.unstubAllGlobals());

    it(
        'can be recorded and sent in a groupchat',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const media = installFakeMedia();
            const view = await openMUC(_converse);
            await startRecording(view);
            media.recorder.emitData('hello');
            view.querySelector('converse-audio-recorder .btn-stop').click();

            fakeUploads(201);
            const iq = await answerSlotRequest(_converse);
            expect(iq.querySelector('request').getAttribute('content-type')).toBe('audio/webm');

            const player = await u.waitUntil(() => view.querySelector('.chat-content converse-audio-player'));
            expect(player.getAttribute('src')).toBe('https://upload.montague.tld/voice.weba');
            await u.waitUntil(() => !view.querySelector('converse-audio-recorder .audio-recorder'));
            expect(media.tracks.every((t) => t.stopped)).toBe(true);
        }),
    );

    it(
        'is discarded when the user loses voice in a groupchat while recording',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const media = installFakeMedia();
            const view = await openMUC(_converse);
            await startRecording(view);

            view.model.features.set('moderated', true);
            view.model.getOwnOccupant().set('role', 'visitor');
            await u.waitUntil(() => media.tracks.every((t) => t.stopped));
            expect(media.recorder.state).toBe('inactive');
            expect(view.model.ui.get('voice_recorder')).toBe(false);
        }),
    );

    it(
        'is recorded in only one chat at a time',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const media = installFakeMedia();
            const chat_view = await openChat(_converse);
            await startRecording(chat_view);
            const first_recorder = media.recorder;

            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const muc_view = _converse.chatboxviews.get(muc_jid);
            await startRecording(muc_view);

            expect(media.tracks.length).toBe(2);
            expect(media.tracks[0].stopped).toBe(true);
            expect(media.tracks[1].stopped).toBe(false);
            expect(first_recorder.state).toBe('inactive');
            expect(chat_view.querySelector('converse-audio-recorder .audio-recorder')).toBe(null);
            expect(muc_view.querySelector('converse-audio-recorder .audio-recorder--recording')).not.toBe(null);
        }),
    );
});
