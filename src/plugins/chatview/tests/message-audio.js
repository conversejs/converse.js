import { vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { sizzle, u } = converse.env;

describe('A Chat Message', function () {
    it(
        'will render audio files from their URLs using the accessible audio player',
        mock.initConverse(converse, ['chatBoxesFetched'], { fetch_url_headers: true }, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const base_url = 'https://conversejs.org';
            const message = base_url + '/logo/audio.mp3';

            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            await mock.sendMessage(_converse, view, message);
            await u.waitUntil(() => view.querySelectorAll('.chat-content converse-audio-player').length, 1000);
            const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
            const audioPlayer = msg.querySelector('converse-audio-player');
            expect(audioPlayer.getAttribute('src')).toEqual(message);
        }),
    );

    it(
        'will render audio streams using the accessible audio player',
        mock.initConverse(converse, ['chatBoxesFetched'], { fetch_url_headers: true }, async function (_converse) {
            spyOn(window, 'fetch').and.callFake(() => {
                return new Response('', {
                    status: 200,
                    headers: {
                        'Content-Type': 'audio/mpeg',
                    },
                });
            });

            await mock.waitForRoster(_converse, 'current', 1);
            const message = 'http://foo.bar/stream';
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            await mock.sendMessage(_converse, view, message);
            await u.waitUntil(() => view.querySelectorAll('.chat-content converse-audio-player').length, 1000);
            const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
            const audioPlayer = msg.querySelector('converse-audio-player');
            expect(audioPlayer.getAttribute('src')).toEqual(message);
        }),
    );

    it(
        'renders an accessible audio player with proper ARIA attributes',
        mock.initConverse(converse, ['chatBoxesFetched'], { fetch_url_headers: true }, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const base_url = 'https://conversejs.org';
            const message = base_url + '/logo/audio.mp3';

            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            await mock.sendMessage(_converse, view, message);
            await u.waitUntil(() => view.querySelectorAll('.chat-content converse-audio-player').length, 1000);

            const audioPlayer = view.querySelector('converse-audio-player');

            // Check that the audio player has the proper structure
            const playBtn = audioPlayer.querySelector('.audio-player__play-btn');
            expect(playBtn).not.toBeNull();
            expect(playBtn.getAttribute('aria-label')).toBeTruthy();
            expect(playBtn.getAttribute('type')).toEqual('button');

            // Check for mute button accessibility
            const muteBtn = audioPlayer.querySelector('.audio-player__mute-btn');
            expect(muteBtn).not.toBeNull();
            expect(muteBtn.getAttribute('aria-label')).toBeTruthy();

            // Check for seek slider accessibility
            const seekSlider = audioPlayer.querySelector('.audio-player__seek');
            expect(seekSlider).not.toBeNull();
            expect(seekSlider.getAttribute('aria-valuemin')).toBeTruthy();
            expect(seekSlider.getAttribute('aria-valuemax')).toBeTruthy();
            expect(seekSlider.getAttribute('aria-valuenow')).toBeTruthy();

            // Check for volume slider accessibility
            const volumeSlider = audioPlayer.querySelector('.audio-player__volume');
            expect(volumeSlider).not.toBeNull();
            expect(volumeSlider.getAttribute('aria-valuemin')).toBeTruthy();
            expect(volumeSlider.getAttribute('aria-valuemax')).toBeTruthy();
            expect(volumeSlider.getAttribute('aria-valuenow')).toBeTruthy();

            // Check for visually hidden labels for screen readers
            const hiddenLabels = audioPlayer.querySelectorAll('.visually-hidden');
            expect(hiddenLabels.length).toBeGreaterThan(0);
        }),
    );

    it(
        'audio player play button has proper accessibility attributes',
        mock.initConverse(converse, ['chatBoxesFetched'], { fetch_url_headers: true }, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const base_url = 'https://conversejs.org';
            const message = base_url + '/logo/audio.mp3';

            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            await mock.sendMessage(_converse, view, message);
            await u.waitUntil(() => view.querySelectorAll('.chat-content converse-audio-player').length, 1000);

            const audioPlayer = view.querySelector('converse-audio-player');
            const playBtn = audioPlayer.querySelector('.audio-player__play-btn');

            // Check that play button has proper attributes for accessibility
            expect(playBtn).not.toBeNull();
            expect(playBtn.getAttribute('type')).toEqual('button');
            expect(playBtn.getAttribute('aria-label')).toBeTruthy();
            expect(playBtn.hasAttribute('aria-pressed')).toBe(true);

            // Check that aria-pressed is initially false (not playing)
            expect(playBtn.getAttribute('aria-pressed')).toEqual('false');
        }),
    );

    it(
        'keeps the audio play button available before the audio has loaded',
        mock.initConverse(converse, ['chatBoxesFetched'], { fetch_url_headers: true }, async function (_converse) {
            // Don't fetch the audio, so that no media events arrive other than the ones dispatched below
            vi.spyOn(HTMLMediaElement.prototype, 'src', 'set').mockImplementation(() => {});

            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            await mock.sendMessage(_converse, view, 'https://conversejs.org/logo/audio.mp3');
            await u.waitUntil(() => view.querySelector('.chat-content converse-audio-player'), 1000);

            const audioPlayer = view.querySelector('converse-audio-player');
            await audioPlayer.updateComplete;
            const { audio } = audioPlayer;
            const playBtn = audioPlayer.querySelector('.audio-player__play-btn');
            const status = audioPlayer.querySelector('[role="status"]');

            expect(playBtn.disabled).toBe(false);
            expect(playBtn.querySelector('.fa-play')).not.toBeNull();
            expect(status.textContent.trim()).toBe('');

            // Without data, play() fires "play" and then "waiting", and the
            // returned promise stays pending until playback starts.
            vi.spyOn(audio, 'play').mockImplementation(() => {
                audio.dispatchEvent(new Event('play'));
                audio.dispatchEvent(new Event('waiting'));
                return new Promise(() => {});
            });
            playBtn.click();
            await audioPlayer.updateComplete;

            expect(audio.play).toHaveBeenCalledOnce();
            expect(playBtn.disabled).toBe(false);
            expect(playBtn.getAttribute('aria-label')).toBe('Pause');
            expect(playBtn.querySelector('.audio-player__spinner')).not.toBeNull();
            expect(status.textContent.trim()).toBe('Loading audio...');

            audio.dispatchEvent(new Event('canplay'));
            await audioPlayer.updateComplete;
            expect(playBtn.querySelector('.fa-pause')).not.toBeNull();
            expect(status.textContent.trim()).toBe('');
        }),
    );

    it(
        'lets the user pause audio that is still loading',
        mock.initConverse(converse, ['chatBoxesFetched'], { fetch_url_headers: true }, async function (_converse) {
            vi.spyOn(HTMLMediaElement.prototype, 'src', 'set').mockImplementation(() => {});

            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            await mock.sendMessage(_converse, view, 'https://conversejs.org/logo/audio.mp3');
            await u.waitUntil(() => view.querySelector('.chat-content converse-audio-player'), 1000);

            const audioPlayer = view.querySelector('converse-audio-player');
            await audioPlayer.updateComplete;
            const { audio } = audioPlayer;
            const playBtn = audioPlayer.querySelector('.audio-player__play-btn');

            // Pausing before playback starts rejects the pending play() with an AbortError
            let rejectPlay;
            vi.spyOn(audio, 'play').mockImplementation(() => {
                audio.dispatchEvent(new Event('play'));
                audio.dispatchEvent(new Event('waiting'));
                return new Promise((_resolve, reject) => (rejectPlay = reject));
            });
            vi.spyOn(audio, 'pause').mockImplementation(() => {
                audio.dispatchEvent(new Event('pause'));
                rejectPlay(new DOMException('The play() request was interrupted by a call to pause().', 'AbortError'));
            });

            playBtn.click();
            await audioPlayer.updateComplete;
            playBtn.click();
            await new Promise((resolve) => setTimeout(resolve));
            await audioPlayer.updateComplete;

            expect(audio.pause).toHaveBeenCalledOnce();
            expect(audioPlayer.has_error).toBe(false);
            expect(playBtn.disabled).toBe(false);
            expect(playBtn.getAttribute('aria-label')).toBe('Play');
            expect(playBtn.querySelector('.fa-play')).not.toBeNull();
            expect(audioPlayer.querySelector('[role="status"]').textContent.trim()).toBe('');
        }),
    );

    it(
        'will render Spotify player for Spotify URLs',
        mock.initConverse(converse, 
            ['chatBoxesFetched'],
            { embed_3rd_party_media_players: true, view_mode: 'fullscreen' },
            async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                const message = 'https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6';

                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);
                await mock.sendMessage(_converse, view, message);
                await u.waitUntil(() => view.querySelectorAll('.chat-content iframe').length, 1000);
                const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
                expect(msg.querySelector('iframe').src).toContain(
                    'https://open.spotify.com/embed/track/6rqhFgbbKwnb9MLmUQDhG6',
                );
            },
        ),
    );
});
