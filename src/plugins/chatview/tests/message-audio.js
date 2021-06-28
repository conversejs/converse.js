/*global mock, converse */

const { sizzle, u } = converse.env;

describe("A Chat Message", function () {

    it("will render audio files from their URLs",
            mock.initConverse(['chatBoxesFetched'], {},
            async function (_converse) {
        await mock.waitForRoster(_converse, 'current');
        const base_url = 'https://conversejs.org';
        const message = base_url+"/logo/audio.mp3";

        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('.chat-content audio').length, 1000)
        const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
        expect(msg.innerHTML.replace(/<!-.*?->/g, '').replace(/(\r\n|\n|\r)/gm, "").trim()).toEqual(
            `<audio controls="" src="${message}"></audio>`+
            `<a target="_blank" rel="noopener" href="${message}">${message}</a>`);
    }));
});
