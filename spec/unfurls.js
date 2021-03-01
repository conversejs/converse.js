/*global mock, converse */

const { u } = converse.env;

describe("A Groupchat Message", function () {

    it("will render an unfurl based on OGP data", mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {
        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.api.chatviews.get(muc_jid);

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
        expect(unfurl.querySelector('.card-img-top').getAttribute('src')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
        done();
    }));

    it("will render multiple unfurls based on OGP data", mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {
        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.api.chatviews.get(muc_jid);

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
        done();
    }));

    it("will not render an unfurl based on a URL not in the original message", mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {
        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.api.chatviews.get(muc_jid);

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
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:url" content="https://www.youtube.com/watch?v=tmY-G6sngk8" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:title" content="Rick Astley - Never Gonna Give You Up (Video)" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:image" content="https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg" />
                    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:description" content="Rick Astley&amp;#39;s official music video for &quot;Never Gonna Give You Up&quot; Listen to Rick Astley: https://RickAstley.lnk.to/_listenYD Subscribe to the official Rick Ast..." />
                </apply-to>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(metadata_stanza));

        await u.waitUntil(() => view.model.handleMetadataFastening.calls.count());
        expect(view.model.handleMetadataFastening.calls.first().returnValue).toBe(false);
        expect(view.querySelector('converse-message-unfurl')).toBe(null);
        done();
    }));

    it("will not render an unfurl received from a MUC participant", mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {
        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.api.chatviews.get(muc_jid);

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
        done();
    }));

    it("will not render an unfurl based on OGP data if muc_show_ogp_unfurls is false",
            mock.initConverse(['chatBoxesFetched'],
            {'muc_show_ogp_unfurls': false},
            async function (done, _converse) {
        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.api.chatviews.get(muc_jid);

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

        await u.waitUntil(() => view.model.handleMetadataFastening.calls.count());
        expect(view.model.handleMetadataFastening.calls.first().returnValue).toBe(false);
        expect(view.querySelector('converse-message-unfurl')).toBe(null);
        done();
    }));

    it("will only render a single unfurl when receiving the same OGP data multiple times",
            mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {
        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.api.chatviews.get(muc_jid);

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
        done();
    }));
});
