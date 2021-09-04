/*global mock, converse */

const { Strophe, Promise, u } = converse.env;

describe("A Chat Message", function () {
    describe("which contains an OOB URL", function () {

        it("will render audio from oob mp3 URLs",
            mock.initConverse(
                ['chatBoxesFetched'], {},
                async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            spyOn(view.model, 'sendMessage').and.callThrough();

            const url = 'https://montague.lit/audio.mp3';
            let stanza = u.toStanza(`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard">
                    <body>Have you heard this funny audio?</body>
                    <x xmlns="jabber:x:oob"><url>${url}</url></x>
                </message>`)
            _converse.connection._dataRecv(mock.createRequest(stanza));
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-msg audio').length, 1000);
            let msg = view.querySelector('.chat-msg .chat-msg__text');
            expect(msg.classList.length).toEqual(1);
            expect(u.hasClass('chat-msg__text', msg)).toBe(true);
            expect(msg.textContent).toEqual('Have you heard this funny audio?');
            const media = view.querySelector('.chat-msg .chat-msg__media');
            expect(media.innerHTML.replace(/<!-.*?->/g, '').replace(/(\r\n|\n|\r)/gm, "").trim()).toEqual(
                `<audio controls="" src="https://montague.lit/audio.mp3"></audio>`+
                `<a target="_blank" rel="noopener" href="https://montague.lit/audio.mp3">${url}</a>`);

            // If the <url> and <body> contents is the same, don't duplicate.
            stanza = u.toStanza(`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard">
                    <body>${url}</body>
                    <x xmlns="jabber:x:oob"><url>${url}</url></x>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));

            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            msg = view.querySelector('.chat-msg .chat-msg__text');
            expect(msg.innerHTML.replace(/<!-.*?->/g, '')).toEqual('Have you heard this funny audio?'); // Emtpy

            // We don't render the OOB data
            expect(view.querySelector('converse-chat-message:last-child .chat-msg__media')).toBe(null);

            // But we do render the body
            const msg_el = view.querySelector('converse-chat-message:last-child .chat-msg__text');
            await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '').replace(/(\r\n|\n|\r)/gm, "").trim() ===
                `<audio controls="" src="https://montague.lit/audio.mp3"></audio>`+
                `<a target="_blank" rel="noopener" href="${url}">${url}</a>`);
        }));

        it("will render video from oob mp4 URLs",
            mock.initConverse(
                ['chatBoxesFetched'], {},
                async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid)
            const view = _converse.chatboxviews.get(contact_jid);
            spyOn(view.model, 'sendMessage').and.callThrough();

            const url = 'https://montague.lit/video.mp4';
            let stanza = u.toStanza(`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard">
                    <body>Have you seen this funny video?</body>
                    <x xmlns="jabber:x:oob"><url>${url}</url></x>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-msg video').length, 2000)
            let msg = view.querySelector('.chat-msg .chat-msg__text');
            expect(msg.classList.length).toBe(1);
            expect(msg.textContent).toEqual('Have you seen this funny video?');
            const media = view.querySelector('.chat-msg .chat-msg__media');
            expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "").replace(/<!-.*?->/g, '')).toEqual(
                `<video controls="" preload="metadata" src="${Strophe.xmlescape(url)}"></video>`+
                `<a target="_blank" rel="noopener" href="${Strophe.xmlescape(url)}">${Strophe.xmlescape(url)}</a>`);

            // If the <url> and <body> contents is the same, don't duplicate.
            stanza = u.toStanza(`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard">
                    <body>https://montague.lit/video.mp4</body>
                    <x xmlns="jabber:x:oob"><url>https://montague.lit/video.mp4</url></x>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            msg = view.querySelector('converse-chat-message .chat-msg__text');
            expect(msg.innerHTML.replace(/<!-.*?->/g, '')).toEqual('Have you seen this funny video?');
            expect(view.querySelector('converse-chat-message:last-child .chat-msg__media')).toBe(null);
        }));

        it("will render download links for files from oob URLs",
            mock.initConverse(
                ['chatBoxesFetched'], {},
                async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            spyOn(view.model, 'sendMessage').and.callThrough();
            const stanza = u.toStanza(`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard">
                    <body>Have you downloaded this funny file?</body>
                    <x xmlns="jabber:x:oob"><url>https://montague.lit/funny.pdf</url></x>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-msg a').length, 1000);
            const msg = view.querySelector('.chat-msg .chat-msg__text');
            expect(u.hasClass('chat-msg__text', msg)).toBe(true);
            expect(msg.textContent).toEqual('Have you downloaded this funny file?');
            const media = view.querySelector('.chat-msg .chat-msg__media');
            expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "").replace(/<!-.*?->/g, '')).toEqual(
                `<a target="_blank" rel="noopener" href="https://montague.lit/funny.pdf">Download file "funny.pdf"</a>`);
        }));

        it("will render images from oob URLs",
            mock.initConverse(
                ['chatBoxesFetched'], {},
                async function (_converse) {

            const base_url = 'https://conversejs.org';
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid)
            const view = _converse.chatboxviews.get(contact_jid);
            spyOn(view.model, 'sendMessage').and.callThrough();
            const url = base_url+"/logo/conversejs-filled.svg";

            const stanza = u.toStanza(`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard">
                    <body>Have you seen this funny image?</body>
                    <x xmlns="jabber:x:oob"><url>${url}</url></x>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));
            _converse.connection._dataRecv(mock.createRequest(stanza));
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-msg a').length, 1000);
            const msg = view.querySelector('.chat-msg .chat-msg__text');
            expect(u.hasClass('chat-msg__text', msg)).toBe(true);
            expect(msg.textContent).toEqual('Have you seen this funny image?');
            const media = view.querySelector('.chat-msg .chat-msg__media');
            expect(media.innerHTML.replace(/<!-.*?->/g, '').replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                `<a target="_blank" rel="noopener" href="${base_url}/logo/conversejs-filled.svg">`+
                `Download file "conversejs-filled.svg"</a>`);
        }));
    });
});
