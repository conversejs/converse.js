/*global mock, converse */

const { sizzle, u } = converse.env;

describe("A Chat Message", function () {

    it("will render images from their URLs", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
        await mock.waitForRoster(_converse, 'current');
        const base_url = 'https://conversejs.org';
        let message = base_url+"/logo/conversejs-filled.svg";
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        spyOn(view.model, 'sendMessage').and.callThrough();
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-image').length, 1000)
        expect(view.model.sendMessage).toHaveBeenCalled();
        let msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
        expect(msg.innerHTML.replace(/<!-.*?->/g, '').trim()).toEqual(
            `<a class="chat-image__link" target="_blank" rel="noopener" href="${base_url}/logo/conversejs-filled.svg">`+
                `<img class="chat-image img-thumbnail" loading="lazy" src="https://conversejs.org/logo/conversejs-filled.svg">`+
            `</a>`);

        message += "?param1=val1&param2=val2";
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-image').length === 2, 1000);
        expect(view.model.sendMessage).toHaveBeenCalled();
        msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
        expect(msg.innerHTML.replace(/<!-.*?->/g, '').trim()).toEqual(
            `<a class="chat-image__link" target="_blank" rel="noopener" href="${base_url}/logo/conversejs-filled.svg?param1=val1&amp;param2=val2">`+
                `<img class="chat-image img-thumbnail" loading="lazy" src="${message.replace(/&/g, '&amp;')}">`+
            `</a>`);

        // Test now with two images in one message
        message += ' hello world '+base_url+"/logo/conversejs-filled.svg";
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-image').length === 4, 1000);
        expect(view.model.sendMessage).toHaveBeenCalled();
        msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
        expect(msg.textContent.trim()).toEqual('hello world');
        expect(msg.querySelectorAll('img.chat-image').length).toEqual(2);

        // Configured image URLs are rendered
        _converse.api.settings.set('image_urls_regex', /^https?:\/\/(?:www.)?(?:imgur\.com\/\w{7})\/?$/i);
        message = 'https://imgur.com/oxymPax';
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-image').length === 5, 1000);
        expect(view.querySelectorAll('.chat-content .chat-image').length).toBe(5);

        // Check that the Imgur URL gets a .png attached to make it render
        await u.waitUntil(() => Array.from(view.querySelectorAll('.chat-content .chat-image')).pop().src.endsWith('png'), 1000);
    }));

    it("will not render images if render_media is false",
            mock.initConverse(['chatBoxesFetched'], {'render_media': false}, async function (_converse) {
        await mock.waitForRoster(_converse, 'current');
        const base_url = 'https://conversejs.org';
        const message = base_url+"/logo/conversejs-filled.svg";

        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        await mock.sendMessage(view, message);
        const sel = '.chat-content .chat-msg:last .chat-msg__text';
        await u.waitUntil(() => sizzle(sel).pop().innerHTML.replace(/<!-.*?->/g, '').trim() === message);
        expect(true).toBe(true);
    }));

    it("will automatically render images from approved URLs only",
        mock.initConverse(
            ['chatBoxesFetched'], {'render_media': ['imgur.com']},
            async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        const base_url = 'https://conversejs.org';
        let message = 'https://imgur.com/oxymPax.png';
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        spyOn(view.model, 'sendMessage').and.callThrough();
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-msg').length === 1);

        message = base_url+"/logo/conversejs-filled.svg";
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-msg').length === 2, 1000);
        await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-image').length === 1, 1000)
        expect(view.querySelectorAll('.chat-content .chat-image').length).toBe(1);
    }));

    it("will automatically update its rendering of media and the message actions when settings change",
        mock.initConverse(
            ['chatBoxesFetched'], {'render_media': ['imgur.com']},
            async function (_converse) {

        const { api } = _converse;
        await mock.waitForRoster(_converse, 'current');
        const message = 'https://imgur.com/oxymPax.png';
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        spyOn(view.model, 'sendMessage').and.callThrough();
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-msg').length === 1);

        const actions_el = view.querySelector('converse-message-actions');
        await u.waitUntil(() => actions_el.textContent.includes('Hide media'));

        actions_el.querySelector('.chat-msg__action-hide-previews').click();
        await u.waitUntil(() => !view.querySelector('converse-chat-message-body img'));
        await u.waitUntil(() => actions_el.textContent.includes('Show media'));

        actions_el.querySelector('.chat-msg__action-hide-previews').click();
        await u.waitUntil(() => actions_el.textContent.includes('Hide media'));

        api.settings.set('render_media', false);
        await u.waitUntil(() => actions_el.textContent.includes('Show media'));
        await u.waitUntil(() => !view.querySelector('converse-chat-message-body img'));

        actions_el.querySelector('.chat-msg__action-hide-previews').click();
        await u.waitUntil(() => actions_el.textContent.includes('Hide media'));

        api.settings.set('render_media', ['imgur.com']);
        await u.waitUntil(() => actions_el.textContent.includes('Hide media'));
        await u.waitUntil(() => view.querySelector('converse-chat-message-body img'));

        api.settings.set('render_media', ['conversejs.org']);
        await u.waitUntil(() => actions_el.textContent.includes('Show media'));
        await u.waitUntil(() => !view.querySelector('converse-chat-message-body img'));

        api.settings.set('allowed_image_domains', ['conversejs.org']);
        await u.waitUntil(() => !actions_el.textContent.includes('Show media'));
        expect(actions_el.textContent.includes('Hide media')).toBe(false);

        api.settings.set('render_media', ['imgur.com']);
        return new Promise(resolve => setTimeout(() => {
            expect(actions_el.textContent.includes('Hide media')).toBe(false);
            expect(actions_el.textContent.includes('Show media')).toBe(false);
            expect(view.querySelector('converse-chat-message-body img')).toBe(null);
            resolve();
        }, 500));
    }));


    it("will fall back to rendering images as URLs",
        mock.initConverse(
            ['chatBoxesFetched'], {},
            async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        const base_url = 'https://conversejs.org';
        const message = base_url+"/logo/non-existing.svg";
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        spyOn(view.model, 'sendMessage').and.callThrough();
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-image').length, 1000)
        expect(view.model.sendMessage).toHaveBeenCalled();
        const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
        await u.waitUntil(() => msg.innerHTML.replace(/<!-.*?->/g, '').trim() ==
            `<a target="_blank" rel="noopener" href="https://conversejs.org/logo/non-existing.svg">https://conversejs.org/logo/non-existing.svg</a>`, 1000);
    }));

    it("will fall back to rendering URLs that match image_urls_regex as URLs",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {
                'render_media': true,
                'image_urls_regex': /^https?:\/\/(www.)?(pbs\.twimg\.com\/)/i
            },
            async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        const message = "https://pbs.twimg.com/media/string?format=jpg&name=small";
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        spyOn(view.model, 'sendMessage').and.callThrough();
        await mock.sendMessage(view, message);
        expect(view.model.sendMessage).toHaveBeenCalled();
        await u.waitUntil(() => view.querySelector('.chat-content .chat-msg'), 1000);
        const msg = view.querySelector('.chat-content .chat-msg .chat-msg__text');
        await u.waitUntil(() => msg.innerHTML.replace(/<!-.*?->/g, '').trim() ==
            `<a target="_blank" rel="noopener" href="https://pbs.twimg.com/media/string?format=jpg&amp;name=small">https://pbs.twimg.com/media/string?format=jpg&amp;name=small</a>`, 1000);
    }));

    it("will respect a changed allowed_image_domains setting when re-rendered",
        mock.initConverse(
            ['chatBoxesFetched'], {'render_media': true},
            async function (_converse) {

        const { api } = _converse;
        await mock.waitForRoster(_converse, 'current');
        const message = 'https://imgur.com/oxymPax.png';
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('converse-chat-message-body .chat-image').length === 1);
        expect(view.querySelector('.chat-msg__action-hide-previews')).not.toBe(null);

        api.settings.set('allowed_image_domains', []);

        await u.waitUntil(() => view.querySelector('converse-chat-message-body .chat-image') === null);
        expect(view.querySelector('.chat-msg__action-hide-previews')).toBe(null);

        api.settings.set('allowed_image_domains', null);
        await u.waitUntil(() => view.querySelector('converse-chat-message-body .chat-image'));
        expect(view.querySelector('.chat-msg__action-hide-previews')).not.toBe(null);
    }));

    it("will allow the user to toggle visibility of rendered images",
            mock.initConverse(['chatBoxesFetched'], {'render_media': true}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        // let message = "https://i.imgur.com/Py9ifJE.mp4";
        const base_url = 'https://conversejs.org';
        const message = base_url+"/logo/conversejs-filled.svg";

        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        await mock.sendMessage(view, message);

        const sel = '.chat-content .chat-msg:last .chat-msg__text';
        await u.waitUntil(() => sizzle(sel).pop().innerHTML.replace(/<!-.*?->/g, '').trim() === message);

        const actions_el = view.querySelector('converse-message-actions');
        await u.waitUntil(() => actions_el.textContent.includes('Hide media'));
        await u.waitUntil(() => view.querySelector('converse-chat-message-body img'));

        actions_el.querySelector('.chat-msg__action-hide-previews').click();
        await u.waitUntil(() => actions_el.textContent.includes('Show media'));
        await u.waitUntil(() => !view.querySelector('converse-chat-message-body img'));

        expect(view.querySelector('converse-chat-message-body').innerHTML.replace(/<!-.*?->/g, '').trim())
            .toBe(`<a target="_blank" rel="noopener" href="${message}">${message}</a>`)
    }));
});
