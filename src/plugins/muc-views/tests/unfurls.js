/*global mock, converse */

const { Strophe, u } = converse.env;

describe("A Groupchat Message", function () {

    it("will render an unfurl based on OGP data", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.chatboxviews.get(muc_jid);

        const unfurl_image_src = "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg";
        const unfurl_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

        const message_stanza = u.toStanza(`
            <message xmlns="jabber:client" type="groupchat" from="${muc_jid}/arzu" xml:lang="en" to="${_converse.jid}" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                <body>https://www.youtube.com/watch?v=dQw4w9WgXcQ</body>
                <active xmlns="http://jabber.org/protocol/chatstates"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04"/>
                <stanza-id xmlns="urn:xmpp:sid:0" by="${muc_jid}" id="8f7613cc-27d4-40ca-9488-da25c4baf92a"/>
                <markable xmlns="urn:xmpp:chat-markers:0"/>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(message_stanza));
        const el = await u.waitUntil(() => view.querySelector('.chat-msg__text'));
        expect(el.textContent).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

        const metadata_stanza = u.toStanza(`
            <message xmlns="jabber:client" from="${muc_jid}" to="${_converse.jid}" type="groupchat">
                <apply-to xmlns="urn:xmpp:fasten:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:site_name" content="YouTube" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:url" content="${unfurl_url}" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:title" content="Rick Astley - Never Gonna Give You Up (Video)" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image" content="${unfurl_image_src}" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image:width" content="1280" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image:height" content="720" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:description" content="Rick Astley&amp;#39;s official music video for &quot;Never Gonna Give You Up&quot; Listen to Rick Astley: https://RickAstley.lnk.to/_listenYD Subscribe to the official Rick Ast..." />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:type" content="video.other" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:video:url" content="https://www.youtube.com/embed/dQw4w9WgXcQ" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:video:secure_url" content="https://www.youtube.com/embed/dQw4w9WgXcQ" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:video:type" content="text/html" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:video:width" content="1280" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:video:height" content="720" />
                </apply-to>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(metadata_stanza));

        const unfurl = await u.waitUntil(() => view.querySelector('converse-message-unfurl'));
        expect(unfurl.querySelector('.card-img-top').getAttribute('src')).toBe(unfurl_image_src);
        expect(unfurl.querySelector('.card-img-top').getAttribute('href')).toBe(unfurl_url);
    }));

    it("will render an unfurl with limited OGP data", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
        /* Some sites don't include ogp data such as title, description and
         * url. This test is to check that we fall back gracefully */
        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.chatboxviews.get(muc_jid);

        const message_stanza = u.toStanza(`
            <message xmlns="jabber:client" type="groupchat" from="${muc_jid}/arzu" xml:lang="en" to="${_converse.jid}" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                <body>https://mempool.space</body>
                <active xmlns="http://jabber.org/protocol/chatstates"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04"/>
                <stanza-id xmlns="urn:xmpp:sid:0" by="${muc_jid}" id="8f7613cc-27d4-40ca-9488-da25c4baf92a"/>
                <markable xmlns="urn:xmpp:chat-markers:0"/>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(message_stanza));
        const el = await u.waitUntil(() => view.querySelector('.chat-msg__text'));
        expect(el.textContent).toBe('https://mempool.space');

        const metadata_stanza = u.toStanza(`
            <message xmlns="jabber:client" from="${muc_jid}" to="${_converse.jid}" type="groupchat">
                <apply-to xmlns="urn:xmpp:fasten:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image" content="https://conversejs.org/dist/images/custom_emojis/converse.png" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image:type" content="image/png" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image:width" content="1000" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image:height" content="500" />
                </apply-to>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(metadata_stanza));

        const unfurl = await u.waitUntil(() => view.querySelector('converse-message-unfurl'));
        expect(unfurl.querySelector('.card-img-top').getAttribute('src')).toBe('https://conversejs.org/dist/images/custom_emojis/converse.png');
        expect(unfurl.querySelector('.card-body')).toBe(null);
    }));

    it("will render an unfurl containing a GIF", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.chatboxviews.get(muc_jid);
        const unfurl_url = "https://giphy.com/gifs/giphyqa-4YY4DnqeUDBXNTcYMu";
        const gif_url = "https://media4.giphy.com/media/4YY4DnqeUDBXNTcYMu/giphy.gif?foo=bar";

        const message_stanza = u.toStanza(`
            <message xmlns="jabber:client" type="groupchat" from="${muc_jid}/arzu" xml:lang="en" to="${_converse.jid}" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                <body>${unfurl_url}</body>
                <active xmlns="http://jabber.org/protocol/chatstates"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04"/>
                <stanza-id xmlns="urn:xmpp:sid:0" by="${muc_jid}" id="8f7613cc-27d4-40ca-9488-da25c4baf92a"/>
                <markable xmlns="urn:xmpp:chat-markers:0"/>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(message_stanza));
        const el = await u.waitUntil(() => view.querySelector('.chat-msg__text'));
        expect(el.textContent).toBe(unfurl_url);

        const metadata_stanza = u.toStanza(`
            <message xmlns="jabber:client" from="${muc_jid}" to="${_converse.jid}" type="groupchat">
                <apply-to xmlns="urn:xmpp:fasten:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:title" content="Animated GIF" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:description" content="Alright then, keep your secrets" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:url" content="${unfurl_url}" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image" content="${gif_url}" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image:type" content="image/gif" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image:width" content="360" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image:height" content="302" />
                </apply-to>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(metadata_stanza));

        const unfurl = await u.waitUntil(() => view.querySelector('converse-message-unfurl'));
        expect(unfurl.querySelector('.card-img-top').getAttribute('src')).toBe(gif_url);
    }));

    it("will render multiple unfurls based on OGP data", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.chatboxviews.get(muc_jid);

        const message_stanza = u.toStanza(`
            <message xmlns="jabber:client" type="groupchat" from="${muc_jid}/arzu" xml:lang="en" to="${_converse.jid}" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                <body>Check out https://www.youtube.com/watch?v=dQw4w9WgXcQ and https://duckduckgo.com</body>
                <active xmlns="http://jabber.org/protocol/chatstates"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04"/>
                <stanza-id xmlns="urn:xmpp:sid:0" by="${muc_jid}" id="8f7613cc-27d4-40ca-9488-da25c4baf92a"/>
                <markable xmlns="urn:xmpp:chat-markers:0"/>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(message_stanza));
        const el = await u.waitUntil(() => view.querySelector('.chat-msg__text'));
        expect(el.textContent).toBe('Check out https://www.youtube.com/watch?v=dQw4w9WgXcQ and https://duckduckgo.com');

        let metadata_stanza = u.toStanza(`
            <message xmlns="jabber:client" from="${muc_jid}" to="${_converse.jid}" type="groupchat">
                <apply-to xmlns="urn:xmpp:fasten:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:site_name" content="YouTube" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:url" content="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:title" content="Rick Astley - Never Gonna Give You Up (Video)" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image" content="https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image:width" content="1280" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image:height" content="720" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:description" content="Rick Astley&amp;#39;s official music video for &quot;Never Gonna Give You Up&quot; Listen to Rick Astley: https://RickAstley.lnk.to/_listenYD Subscribe to the official Rick Ast..." />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:type" content="video.other" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:video:url" content="https://www.youtube.com/embed/dQw4w9WgXcQ" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:video:secure_url" content="https://www.youtube.com/embed/dQw4w9WgXcQ" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:video:type" content="text/html" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:video:width" content="1280" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:video:height" content="720" />
                </apply-to>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(metadata_stanza));
        await u.waitUntil(() => view.querySelectorAll('converse-message-unfurl').length === 1);

        metadata_stanza = u.toStanza(`
            <message xmlns="jabber:client" from="${muc_jid}" to="${_converse.jid}" type="groupchat">
                <apply-to xmlns="urn:xmpp:fasten:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:url" content="https://duckduckgo.com" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:site_name" content="DuckDuckGo" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image" content="https://duckduckgo.com/assets/logo_social-media.png" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:title" content="DuckDuckGo - Privacy, simplified." />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:description" content="The Internet privacy company that empowers you to seamlessly take control of your personal information online, without any tradeoffs." />
                </apply-to>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(metadata_stanza));

        await u.waitUntil(() => view.querySelectorAll('converse-message-unfurl').length === 2);
    }));

    it("will not render an unfurl received from a MUC participant", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.chatboxviews.get(muc_jid);

        const message_stanza = u.toStanza(`
            <message xmlns="jabber:client" type="groupchat" from="${muc_jid}/arzu" xml:lang="en" to="${_converse.jid}" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                <body>https://www.youtube.com/watch?v=dQw4w9WgXcQ</body>
                <active xmlns="http://jabber.org/protocol/chatstates"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04"/>
                <stanza-id xmlns="urn:xmpp:sid:0" by="${muc_jid}" id="8f7613cc-27d4-40ca-9488-da25c4baf92a"/>
                <markable xmlns="urn:xmpp:chat-markers:0"/>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(message_stanza));
        const el = await u.waitUntil(() => view.querySelector('.chat-msg__text'));
        expect(el.textContent).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

        spyOn(view.model, 'handleMetadataFastening').and.callThrough();

        const metadata_stanza = u.toStanza(`
            <message xmlns="jabber:client" from="${muc_jid}/arzu" to="${_converse.jid}" type="groupchat">
                <apply-to xmlns="urn:xmpp:fasten:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:site_name" content="YouTube" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:url" content="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:title" content="Rick Astley - Never Gonna Give You Up (Video)" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image" content="https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:description" content="Rick Astley&amp;#39;s official music video for &quot;Never Gonna Give You Up&quot; Listen to Rick Astley: https://RickAstley.lnk.to/_listenYD Subscribe to the official Rick Ast..." />
                </apply-to>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(metadata_stanza));

        await u.waitUntil(() => view.model.handleMetadataFastening.calls.count());
        expect(view.model.handleMetadataFastening.calls.first().returnValue).toBe(false);
        expect(view.querySelector('converse-message-unfurl')).toBe(null);
    }));

    it("will not render an unfurl based on OGP data if render_media is false",
            mock.initConverse(['chatBoxesFetched'],
            { 'render_media': false },
            async function (_converse) {

        const { api } = _converse;
        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.chatboxviews.get(muc_jid);

        const message_stanza = u.toStanza(`
            <message xmlns="jabber:client" type="groupchat" from="${muc_jid}/arzu" xml:lang="en" to="${_converse.jid}" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                <body>https://www.youtube.com/watch?v=dQw4w9WgXcQ</body>
                <active xmlns="http://jabber.org/protocol/chatstates"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04"/>
                <stanza-id xmlns="urn:xmpp:sid:0" by="${muc_jid}" id="8f7613cc-27d4-40ca-9488-da25c4baf92a"/>
                <markable xmlns="urn:xmpp:chat-markers:0"/>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(message_stanza));
        const el = await u.waitUntil(() => view.querySelector('.chat-msg__text'));
        expect(el.textContent).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

        spyOn(view.model, 'handleMetadataFastening').and.callThrough();

        const metadata_stanza = u.toStanza(`
            <message xmlns="jabber:client" from="${muc_jid}" to="${_converse.jid}" type="groupchat">
                <apply-to xmlns="urn:xmpp:fasten:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:site_name" content="YouTube" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:url" content="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:title" content="Rick Astley - Never Gonna Give You Up (Video)" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image" content="https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:description" content="Rick Astley&amp;#39;s official music video for &quot;Never Gonna Give You Up&quot; Listen to Rick Astley: https://RickAstley.lnk.to/_listenYD Subscribe to the official Rick Ast..." />
                </apply-to>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(metadata_stanza));

        expect(view.querySelector('converse-message-unfurl')).toBe(null);

        api.settings.set('render_media', true);
        await u.waitUntil(() => view.querySelector('converse-message-unfurl'));

        let button = await u.waitUntil(() => view.querySelector('.chat-msg__content .chat-msg__action-hide-previews'));
        expect(button.textContent.trim()).toBe('Hide media');
        button.click();

        await u.waitUntil(() => !view.querySelector('converse-message-unfurl'), 1000);
        button = await u.waitUntil(() => view.querySelector('.chat-msg__content .chat-msg__action-hide-previews'));
        expect(button.textContent.trim()).toBe('Show media');
    }));

    it("will only render a single unfurl when receiving the same OGP data multiple times",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.chatboxviews.get(muc_jid);

        const message_stanza = u.toStanza(`
            <message xmlns="jabber:client" type="groupchat" from="${muc_jid}/arzu" xml:lang="en" to="${_converse.jid}" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                <body>https://www.youtube.com/watch?v=dQw4w9WgXcQ</body>
                <active xmlns="http://jabber.org/protocol/chatstates"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04"/>
                <stanza-id xmlns="urn:xmpp:sid:0" by="${muc_jid}" id="8f7613cc-27d4-40ca-9488-da25c4baf92a"/>
                <markable xmlns="urn:xmpp:chat-markers:0"/>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(message_stanza));
        const el = await u.waitUntil(() => view.querySelector('.chat-msg__text'));
        expect(el.textContent).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

        spyOn(view.model, 'handleMetadataFastening').and.callThrough();

        const metadata_stanza = u.toStanza(`
            <message xmlns="jabber:client" from="${muc_jid}" to="${_converse.jid}" type="groupchat">
                <apply-to xmlns="urn:xmpp:fasten:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:site_name" content="YouTube" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:url" content="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:title" content="Rick Astley - Never Gonna Give You Up (Video)" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image" content="https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:description" content="Rick Astley&amp;#39;s official music video for &quot;Never Gonna Give You Up&quot; Listen to Rick Astley: https://RickAstley.lnk.to/_listenYD Subscribe to the official Rick Ast..." />
                </apply-to>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(metadata_stanza));
        _converse.connection._dataRecv(mock.createRequest(metadata_stanza));
        _converse.connection._dataRecv(mock.createRequest(metadata_stanza));

        await u.waitUntil(() => view.model.handleMetadataFastening.calls.count());
        const unfurls = await u.waitUntil(() => view.querySelectorAll('converse-message-unfurl'));
        expect(unfurls.length).toBe(1);
    }));

    it("will not render an unfurl image if the domain is not in allowed_image_domains",
            mock.initConverse(['chatBoxesFetched'],
            {'allowed_image_domains': []},
            async function (_converse) {

        const { api } = _converse;

        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.chatboxviews.get(muc_jid);

        const message_stanza = u.toStanza(`
            <message xmlns="jabber:client" type="groupchat" from="${muc_jid}/arzu" xml:lang="en" to="${_converse.jid}" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                <body>https://www.youtube.com/watch?v=dQw4w9WgXcQ</body>
                <active xmlns="http://jabber.org/protocol/chatstates"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04"/>
                <stanza-id xmlns="urn:xmpp:sid:0" by="${muc_jid}" id="8f7613cc-27d4-40ca-9488-da25c4baf92a"/>
                <markable xmlns="urn:xmpp:chat-markers:0"/>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(message_stanza));
        const el = await u.waitUntil(() => view.querySelector('.chat-msg__text'));
        expect(el.textContent).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

        const metadata_stanza = u.toStanza(`
            <message xmlns="jabber:client" from="${muc_jid}" to="${_converse.jid}" type="groupchat">
                <apply-to xmlns="urn:xmpp:fasten:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:site_name" content="YouTube" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:url" content="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:title" content="Rick Astley - Never Gonna Give You Up (Video)" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image" content="https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:description" content="Rick Astley&amp;#39;s official music video for &quot;Never Gonna Give You Up&quot; Listen to Rick Astley: https://RickAstley.lnk.to/_listenYD Subscribe to the official Rick Ast..." />
                </apply-to>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(metadata_stanza));

        await u.waitUntil(() => !view.querySelector('converse-message-unfurl'));

        api.settings.set('allowed_image_domains', null);
        await u.waitUntil(() => view.querySelector('converse-message-unfurl'));
    }));

    it("lets the user hide an unfurl",
            mock.initConverse(['chatBoxesFetched'],
            {'render_media': true},
            async function (_converse) {

        const { api } = _converse;

        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.chatboxviews.get(muc_jid);

        const message_stanza = u.toStanza(`
            <message xmlns="jabber:client" type="groupchat" from="${muc_jid}/arzu" xml:lang="en" to="${_converse.jid}" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                <body>https://www.youtube.com/watch?v=dQw4w9WgXcQ</body>
                <active xmlns="http://jabber.org/protocol/chatstates"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04"/>
                <stanza-id xmlns="urn:xmpp:sid:0" by="${muc_jid}" id="8f7613cc-27d4-40ca-9488-da25c4baf92a"/>
                <markable xmlns="urn:xmpp:chat-markers:0"/>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(message_stanza));
        const el = await u.waitUntil(() => view.querySelector('.chat-msg__text'));
        expect(el.textContent).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

        const metadata_stanza = u.toStanza(`
            <message xmlns="jabber:client" from="${muc_jid}" to="${_converse.jid}" type="groupchat">
                <apply-to xmlns="urn:xmpp:fasten:0" id="eda6c790-b4f3-4c07-b5e2-13fff99e6c04">
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:url" content="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:title" content="Rick Astley - Never Gonna Give You Up (Video)" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image" content="https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:description" content="Rick Astley&amp;#39;s official music video for &quot;Never Gonna Give You Up&quot; Listen to Rick Astley: https://RickAstley.lnk.to/_listenYD Subscribe to the official Rick Ast..." />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:type" content="video.other" />
                </apply-to>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(metadata_stanza));

        await u.waitUntil(() => view.querySelector('converse-message-unfurl'));
        let button = await u.waitUntil(() => view.querySelector('.chat-msg__content .chat-msg__action-hide-previews'));
        expect(button.textContent.trim()).toBe('Hide media');
        button.click();
        await u.waitUntil(() => view.querySelector('converse-message-unfurl') === null, 750);
        button = view.querySelector('.chat-msg__content .chat-msg__action-hide-previews');
        expect(button.textContent.trim()).toBe('Show media');
        button.click();
        await u.waitUntil(() => view.querySelector('converse-message-unfurl'), 750);

        // Check that the image doesn't render if the domain is not allowed
        expect(view.querySelector('converse-message-unfurl .chat-image')).not.toBe(null);
        api.settings.set('allowed_image_domains', []);
        await u.waitUntil(() => view.querySelector('converse-message-unfurl .chat-image') === null);
        api.settings.set('allowed_image_domains', undefined);
        await u.waitUntil(() => view.querySelector('converse-message-unfurl .chat-image') !== null);
    }));

    it("will not render an unfurl that has been removed in a subsequent correction", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
        const nick = 'romeo';
        const muc_jid = 'lounge@muc.montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.chatboxviews.get(muc_jid);

        const unfurl_image_src = "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg";
        const unfurl_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

        spyOn(_converse.connection, 'send').and.callThrough();

        const textarea = await u.waitUntil(() => view.querySelector('textarea.chat-textarea'));
        const message_form = view.querySelector('converse-muc-message-form');
        textarea.value = unfurl_url;
        const enter_event = {
            'target': textarea,
            'preventDefault': function preventDefault () {},
            'stopPropagation': function stopPropagation () {},
            'keyCode': 13 // Enter
        }
        message_form.onKeyDown(enter_event);

        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);
        expect(view.querySelector('.chat-msg__text').textContent)
            .toBe(unfurl_url);

        let msg = _converse.connection.send.calls.all()[0].args[0];
        expect(Strophe.serialize(msg))
        .toBe(
            `<message from="${_converse.jid}" id="${msg.getAttribute('id')}" to="${muc_jid}" type="groupchat" xmlns="jabber:client">`+
                `<body>${unfurl_url}</body>`+
                `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                `<origin-id id="${msg.querySelector('origin-id')?.getAttribute('id')}" xmlns="urn:xmpp:sid:0"/>`+
            `</message>`);

        const el = await u.waitUntil(() => view.querySelector('.chat-msg__text'));
        expect(el.textContent).toBe(unfurl_url);

        const metadata_stanza = u.toStanza(`
            <message xmlns="jabber:client" from="${muc_jid}" to="${_converse.jid}" type="groupchat">
                <apply-to xmlns="urn:xmpp:fasten:0" id="${msg.getAttribute('id')}">
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:site_name" content="YouTube" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:url" content="${unfurl_url}" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:title" content="Rick Astley - Never Gonna Give You Up (Video)" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image" content="${unfurl_image_src}" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image:width" content="1280" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image:height" content="720" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:description" content="Rick Astley&amp;#39;s official music video for &quot;Never Gonna Give You Up&quot; Listen to Rick Astley: https://RickAstley.lnk.to/_listenYD Subscribe to the official Rick Ast..." />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:type" content="video.other" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:video:url" content="https://www.youtube.com/embed/dQw4w9WgXcQ" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:video:secure_url" content="https://www.youtube.com/embed/dQw4w9WgXcQ" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:video:type" content="text/html" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:video:width" content="1280" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:video:height" content="720" />
                </apply-to>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(metadata_stanza));

        const unfurl = await u.waitUntil(() => view.querySelector('converse-message-unfurl'));
        expect(unfurl.querySelector('.card-img-top').getAttribute('src')).toBe(unfurl_image_src);
        expect(unfurl.querySelector('.card-img-top').getAttribute('href')).toBe(unfurl_url);

        // Modify the message to use a different URL
        expect(textarea.value).toBe('');
        message_form.onKeyDown({
            target: textarea,
            keyCode: 38 // Up arrow
        });
        expect(textarea.value).toBe(unfurl_url);
        textarea.value = "never mind";
        message_form.onKeyDown(enter_event);

        const getSentMessages = () => _converse.connection.send.calls.all().map(c => c.args[0]).filter(s => s.nodeName === 'message');
        await u.waitUntil(() => getSentMessages().length == 2);
        msg = getSentMessages().pop();
        expect(Strophe.serialize(msg))
        .toBe(
            `<message from="${_converse.jid}" id="${msg.getAttribute('id')}" to="${muc_jid}" type="groupchat" xmlns="jabber:client">`+
                `<body>never mind</body>`+
                `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                `<replace id="${msg.querySelector('replace')?.getAttribute('id')}" xmlns="urn:xmpp:message-correct:0"/>`+
                `<origin-id id="${msg.querySelector('origin-id')?.getAttribute('id')}" xmlns="urn:xmpp:sid:0"/>`+
            `</message>`);
    }));
});
