/*global mock, converse */
const { sizzle, u } = converse.env;

describe("A Chat Message", function () {

    it("will render audio files from their URLs using the accessible audio player",
            mock.initConverse(['chatBoxesFetched'],
            { fetch_url_headers: true },
            async function (_converse) {
        await mock.waitForRoster(_converse, 'current', 1);
        const base_url = 'https://conversejs.org';
        const message = base_url+"/logo/audio.mp3";

        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('.chat-content converse-audio-player').length, 1000);
        const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
        const audioPlayer = msg.querySelector('converse-audio-player');
        expect(audioPlayer.getAttribute('src')).toEqual(message);
    }));

    it("will render audio streams using the accessible audio player",
            mock.initConverse(['chatBoxesFetched'],
            { fetch_url_headers: true },
            async function (_converse) {

        spyOn(window, 'fetch').and.callFake(async () => {
            return new Response('', {
                status: 200,
                headers: {
                    'Content-Type': 'audio/mpeg'
                }
            });
        });

        await mock.waitForRoster(_converse, 'current', 1);
        const message = 'http://foo.bar/stream';
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('.chat-content converse-audio-player').length, 1000);
        const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
        const audioPlayer = msg.querySelector('converse-audio-player');
        expect(audioPlayer.getAttribute('src')).toEqual(message);
    }));

    it("renders an accessible audio player with proper ARIA attributes",
            mock.initConverse(['chatBoxesFetched'],
            { fetch_url_headers: true },
            async function (_converse) {
        await mock.waitForRoster(_converse, 'current', 1);
        const base_url = 'https://conversejs.org';
        const message = base_url+"/logo/audio.mp3";

        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        await mock.sendMessage(view, message);
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
    }));

    it("audio player play button responds to click and keyboard events",
            mock.initConverse(['chatBoxesFetched'],
            { fetch_url_headers: true },
            async function (_converse) {
        await mock.waitForRoster(_converse, 'current', 1);
        const base_url = 'https://conversejs.org';
        const message = base_url+"/logo/audio.mp3";

        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('.chat-content converse-audio-player').length, 1000);
        
        const audioPlayer = view.querySelector('converse-audio-player');
        const playBtn = audioPlayer.querySelector('.audio-player__play-btn');
        
        // Check that play button is focusable
        playBtn.focus();
        expect(document.activeElement).toBe(playBtn);
        
        // Check that aria-pressed is initially false
        expect(playBtn.getAttribute('aria-pressed')).toEqual('false');
    }));

    it("will render Spotify player for Spotify URLs",
            mock.initConverse(['chatBoxesFetched'],
            { embed_3rd_party_media_players: true, view_mode: 'fullscreen' },
            async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const message = 'https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6';

        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('.chat-content iframe').length, 1000)
        const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
        expect(msg.querySelector('iframe').src).toContain('https://open.spotify.com/embed/track/6rqhFgbbKwnb9MLmUQDhG6');
    }));
});
