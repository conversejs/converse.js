/*global mock, converse */

const { sizzle, u } = converse.env;

describe("A Chat Message", function () {

    it("will render gifs from their URLs", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
        await mock.waitForRoster(_converse, 'current');
        const gif_url = 'https://media.giphy.com/media/Byana3FscAMGQ/giphy.gif';
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        spyOn(view.model, 'sendMessage').and.callThrough();
        await mock.sendMessage(view, gif_url);
        await u.waitUntil(() => view.querySelectorAll('.chat-content canvas').length);
        expect(view.model.sendMessage).toHaveBeenCalled();
        const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
        const html = `<converse-gif autoplay="" noloop="" fallback="empty" src="${gif_url}">`+
            `<canvas class="gif-canvas"><img class="gif" src="${gif_url}"></canvas></converse-gif>`+
            `<a target="_blank" rel="noopener" href="${gif_url}">${gif_url}</a>`;
        await u.waitUntil(() => msg.innerHTML.replace(/<!-.*?->/g, '').trim() === html, 1000);
    }));
});
