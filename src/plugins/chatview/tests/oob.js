/*global mock, converse */
const { Strophe, u, stx } = converse.env;

describe("A Chat Message", function () {

    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

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
            let stanza = stx`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard"
                         xmlns="jabber:client">
                    <body>Have you heard this funny audio?</body>
                    <x xmlns="jabber:x:oob"><url>${url}</url></x>
                </message>`
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-msg audio').length, 1000);
            let msg = view.querySelector('.chat-msg .chat-msg__text');
            expect(msg.classList.length).toEqual(1);
            expect(u.hasClass('chat-msg__text', msg)).toBe(true);
            expect(msg.textContent).toEqual('Have you heard this funny audio?');
            const media = view.querySelector('.chat-msg .chat-msg__media');
            expect(media.querySelector('audio').getAttribute('src')).toBe(url);

            // If the <url> and <body> contents is the same, don't duplicate.
            stanza = stx`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard"
                         xmlns="jabber:client">
                    <body>${url}</body>
                    <x xmlns="jabber:x:oob"><url>${url}</url></x>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            msg = view.querySelector('.chat-msg .chat-msg__text');
            expect(msg.innerHTML.replace(/<!-.*?->/g, '')).toEqual('Have you heard this funny audio?'); // Emtpy

            // We don't render the OOB data
            expect(view.querySelector('converse-chat-message:last-child .chat-msg__media')).toBe(null);

            // But we do render the body
            const audio = await await u.waitUntil(
                () => view.querySelector('converse-chat-message:last-child .chat-msg__text audio'));
            expect(audio.getAttribute('src')).toBe(url);
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
            let stanza = stx`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard"
                         xmlns="jabber:client">
                    <body>Have you seen this funny video?</body>
                    <x xmlns="jabber:x:oob"><url>${url}</url></x>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-msg video').length, 2000)
            let msg = view.querySelector('.chat-msg .chat-msg__text');
            expect(msg.classList.length).toBe(1);
            expect(msg.textContent).toEqual('Have you seen this funny video?');
            const media = view.querySelector('.chat-msg .chat-msg__media');
            expect(media.querySelector('video').getAttribute('src')).toBe(url);

            // If the <url> and <body> contents is the same, don't duplicate.
            stanza = stx`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard"
                         xmlns="jabber:client">
                    <body>https://montague.lit/video.mp4</body>
                    <x xmlns="jabber:x:oob"><url>https://montague.lit/video.mp4</url></x>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            msg = view.querySelector('converse-chat-message .chat-msg__text');
            expect(msg.innerHTML.replace(/<!-.*?->/g, '')).toEqual('Have you seen this funny video?');
            expect(view.querySelector('converse-chat-message:last-child .chat-msg__media')).toBe(null);
            expect(media.firstElementChild.nodeName).toBe('CONVERSE-TEXTURE');
            await u.waitUntil(() => media.firstElementChild.querySelector('video'));
            expect(media.firstElementChild.querySelector('video').getAttribute('src')).toBe(url);
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
            const url = 'https://montague.lit/funny.pdf';
            const stanza = stx`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard"
                         xmlns="jabber:client">
                    <body>Have you downloaded this funny file?</body>
                    <x xmlns="jabber:x:oob"><url>${url}</url></x>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-msg a').length, 1000);
            const msg = view.querySelector('.chat-msg .chat-msg__text');
            expect(u.hasClass('chat-msg__text', msg)).toBe(true);
            expect(msg.textContent).toEqual('Have you downloaded this funny file?');
            const media = view.querySelector('.chat-msg .chat-msg__media');
            expect(media.firstElementChild.nodeName).toBe('CONVERSE-TEXTURE');
            await u.waitUntil(() => media.firstElementChild.querySelector('a'));
            expect(media.firstElementChild.querySelector('a').getAttribute('href')).toBe(url);
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

            const stanza = stx`
                <message xmlns="jabber:client"
                        from="${contact_jid}"
                        type="chat"
                        to="romeo@montague.lit/orchard">
                    <body>Have you seen this funny image?</body>
                    <x xmlns="jabber:x:oob"><url>${url}</url></x>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-msg a').length, 1000);
            const msg = view.querySelector('.chat-msg .chat-msg__text');
            expect(u.hasClass('chat-msg__text', msg)).toBe(true);
            expect(msg.textContent).toEqual('Have you seen this funny image?');
            const media = view.querySelector('.chat-msg .chat-msg__media');
            expect(media.firstElementChild.nodeName).toBe('CONVERSE-TEXTURE');
            await u.waitUntil(() => media.firstElementChild.querySelector('img'));
            expect(media.firstElementChild.querySelector('img').getAttribute('src')).toBe(url);
        }));
    });
});
