/*global mock, converse */
const { sizzle, u } = converse.env;

describe("A Chat Message", function () {

    it("will render audio files from their URLs",
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
        await u.waitUntil(() => view.querySelectorAll('.chat-content audio').length, 1000)
        const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
        expect(msg.querySelector('audio').src).toEqual(message);
    }));

    it("will render audio streams",
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
        await u.waitUntil(() => view.querySelectorAll('.chat-content audio').length, 1000)
        const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
        expect(msg.querySelector('audio').src).toEqual(message);
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
