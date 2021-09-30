/*global mock, converse */

const { Strophe, sizzle, u } = converse.env;

describe("A chat message containing video URLs", function () {

    it("will render videos from their URLs", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
        await mock.waitForRoster(_converse, 'current');
        // let message = "https://i.imgur.com/Py9ifJE.mp4";
        const base_url = 'https://conversejs.org';
        let message = base_url+"/logo/conversejs-filled.mp4";

        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('.chat-content video').length, 1000)
        let msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
        expect(msg.innerHTML.replace(/<!-.*?->/g, '').trim()).toEqual(
            `<video controls="" preload="metadata" src="${message}"></video>`+
            `<a target="_blank" rel="noopener" href="${message}">${message}</a>`);

        message += "?param1=val1&param2=val2";
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('.chat-content video').length === 2, 1000);
        msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
        expect(msg.innerHTML.replace(/<!-.*?->/g, '').trim()).toEqual(
            `<video controls="" preload="metadata" src="${Strophe.xmlescape(message)}"></video>`+
            `<a target="_blank" rel="noopener" href="${Strophe.xmlescape(message)}">${Strophe.xmlescape(message)}</a>`);
    }));

    it("will not render videos if render_media is false",
            mock.initConverse(['chatBoxesFetched'], {'render_media': false}, async function (_converse) {
        await mock.waitForRoster(_converse, 'current');
        // let message = "https://i.imgur.com/Py9ifJE.mp4";
        const base_url = 'https://conversejs.org';
        const message = base_url+"/logo/conversejs-filled.mp4";

        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        await mock.sendMessage(view, message);
        const sel = '.chat-content .chat-msg:last .chat-msg__text';
        await u.waitUntil(() => sizzle(sel).pop().innerHTML.replace(/<!-.*?->/g, '').trim() === message);
        expect(true).toBe(true);
    }));

    it("will allow rendering of videos from approved URLs only",
        mock.initConverse(
            ['chatBoxesFetched'], {'allowed_video_domains': ['conversejs.org']},
            async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        let message = "https://i.imgur.com/Py9ifJE.mp4";
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        spyOn(view.model, 'sendMessage').and.callThrough();
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-msg').length === 1);

        const base_url = 'https://conversejs.org';
        message = base_url+"/logo/conversejs-filled.mp4";
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('.chat-content video').length, 1000)
        const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
        expect(msg.innerHTML.replace(/<!-.*?->/g, '').trim()).toEqual(
            `<video controls="" preload="metadata" src="${message}"></video>`+
            `<a target="_blank" rel="noopener" href="${message}">${message}</a>`);
    }));

    it("will allow the user to toggle visibility of rendered videos",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        // let message = "https://i.imgur.com/Py9ifJE.mp4";
        const base_url = 'https://conversejs.org';
        const message = base_url+"/logo/conversejs-filled.mp4";

        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        await mock.sendMessage(view, message);
        const sel = '.chat-content .chat-msg:last .chat-msg__text';
        await u.waitUntil(() => sizzle(sel).pop().innerHTML.replace(/<!-.*?->/g, '').trim() === message);

        const actions_el = view.querySelector('converse-message-actions');
        await u.waitUntil(() => actions_el.textContent.includes('Hide media'));
        await u.waitUntil(() => view.querySelector('converse-chat-message-body video'));

        actions_el.querySelector('.chat-msg__action-hide-previews').click();
        await u.waitUntil(() => actions_el.textContent.includes('Show media'));
        await u.waitUntil(() => !view.querySelector('converse-chat-message-body video'));

        expect(view.querySelector('converse-chat-message-body').innerHTML.replace(/<!-.*?->/g, '').trim())
            .toBe(`<a target="_blank" rel="noopener" href="${message}">${message}</a>`)
    }));
});
