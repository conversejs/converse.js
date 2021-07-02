/*global mock, converse */

const u = converse.env.utils;
// See: https://xmpp.org/rfcs/rfc3921.html


describe("A XEP-0333 Chat Marker", function () {
    it("may be returned for a MUC message",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);
        const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
        textarea.value = 'But soft, what light through yonder airlock breaks?';
        const message_form = view.querySelector('converse-muc-message-form');
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        expect(view.querySelector('.chat-msg .chat-msg__text').textContent.trim())
            .toBe("But soft, what light through yonder airlock breaks?");

        const msg_obj = view.model.messages.at(0);
        let stanza = u.toStanza(`
            <message xml:lang="en" to="romeo@montague.lit/orchard"
                     from="lounge@montague.lit/some1" type="groupchat" xmlns="jabber:client">
                <received xmlns="urn:xmpp:chat-markers:0" id="${msg_obj.get('msgid')}"/>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);
        expect(view.querySelectorAll('.chat-msg__receipt').length).toBe(0);

        stanza = u.toStanza(`
            <message xml:lang="en" to="romeo@montague.lit/orchard"
                     from="lounge@montague.lit/some1" type="groupchat" xmlns="jabber:client">
                <displayed xmlns="urn:xmpp:chat-markers:0" id="${msg_obj.get('msgid')}"/>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(stanza));
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        expect(view.querySelectorAll('.chat-msg__receipt').length).toBe(0);

        stanza = u.toStanza(`
            <message xml:lang="en" to="romeo@montague.lit/orchard"
                     from="lounge@montague.lit/some1" type="groupchat" xmlns="jabber:client">
                <acknowledged xmlns="urn:xmpp:chat-markers:0" id="${msg_obj.get('msgid')}"/>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(stanza));

        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        expect(view.querySelectorAll('.chat-msg__receipt').length).toBe(0);

        stanza = u.toStanza(`
            <message xml:lang="en" to="romeo@montague.lit/orchard"
                     from="lounge@montague.lit/some1" type="groupchat" xmlns="jabber:client">
                <body>'tis I!</body>
                <stanza-id xmlns='urn:xmpp:sid:0' id='stanza-id-1' by='${muc_jid}'/>
                <markable xmlns="urn:xmpp:chat-markers:0"/>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 2);
        expect(view.querySelectorAll('.chat-msg__receipt').length).toBe(0);
    }));
});
