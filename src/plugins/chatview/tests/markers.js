/*global mock, converse */

const Strophe = converse.env.Strophe;
const u = converse.env.utils;
// See: https://xmpp.org/rfcs/rfc3921.html


describe("A XEP-0333 Chat Marker", function () {

    it("is sent when a markable message is received from a roster contact",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const msgid = u.getUniqueId();
        const stanza = u.toStanza(`
            <message from='${contact_jid}'
                id='${msgid}'
                type="chat"
                to='${_converse.jid}'>
              <body>My lord, dispatch; read o'er these articles.</body>
              <markable xmlns='urn:xmpp:chat-markers:0'/>
            </message>`);

        const sent_stanzas = [];
        spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s?.nodeTree ?? s));
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => sent_stanzas.length === 2);
        expect(Strophe.serialize(sent_stanzas[0])).toBe(
            `<message from="romeo@montague.lit/orchard" `+
                    `id="${sent_stanzas[0].getAttribute('id')}" `+
                    `to="${contact_jid}" type="chat" xmlns="jabber:client">`+
            `<received id="${msgid}" xmlns="urn:xmpp:chat-markers:0"/>`+
            `</message>`);
    }));

    it("is not sent when a markable message is received from someone not on the roster",
            mock.initConverse([], {'allow_non_roster_messaging': true}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 0);
        const contact_jid = 'someone@montague.lit';
        const msgid = u.getUniqueId();
        const stanza = u.toStanza(`
            <message from='${contact_jid}'
                id='${msgid}'
                type="chat"
                to='${_converse.jid}'>
              <body>My lord, dispatch; read o'er these articles.</body>
              <markable xmlns='urn:xmpp:chat-markers:0'/>
            </message>`);

        const sent_stanzas = [];
        spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s));
        await _converse.handleMessageStanza(stanza);
        const sent_messages = sent_stanzas
            .map(s => s?.nodeTree ?? s)
            .filter(e => e.nodeName === 'message');

        await u.waitUntil(() => sent_messages.length === 2);
        expect(Strophe.serialize(sent_messages[0])).toBe(
            `<message id="${sent_messages[0].getAttribute('id')}" to="${contact_jid}" type="chat" xmlns="jabber:client">`+
                `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                `<no-store xmlns="urn:xmpp:hints"/>`+
                `<no-permanent-store xmlns="urn:xmpp:hints"/>`+
            `</message>`
        );
    }));

    it("is ignored if it's a carbon copy of one that I sent from a different client",
        mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], [Strophe.NS.SID]);

        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);

        let stanza = u.toStanza(`
            <message xmlns="jabber:client"
                     to="${_converse.bare_jid}"
                     type="chat"
                     id="2e972ea0-0050-44b7-a830-f6638a2595b3"
                     from="${contact_jid}">
                <body>😊</body>
                <markable xmlns="urn:xmpp:chat-markers:0"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="2e972ea0-0050-44b7-a830-f6638a2595b3"/>
                <stanza-id xmlns="urn:xmpp:sid:0" id="IxVDLJ0RYbWcWvqC" by="${_converse.bare_jid}"/>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        expect(view.model.messages.length).toBe(1);

        stanza = u.toStanza(
            `<message xmlns="jabber:client" to="${_converse.bare_jid}" type="chat" from="${contact_jid}">
                <sent xmlns="urn:xmpp:carbons:2">
                    <forwarded xmlns="urn:xmpp:forward:0">
                        <message xmlns="jabber:client" to="${contact_jid}" type="chat" from="${_converse.bare_jid}/other-resource">
                            <received xmlns="urn:xmpp:chat-markers:0" id="2e972ea0-0050-44b7-a830-f6638a2595b3"/>
                            <store xmlns="urn:xmpp:hints"/>
                            <stanza-id xmlns="urn:xmpp:sid:0" id="F4TC6CvHwzqRbeHb" by="${_converse.bare_jid}"/>
                        </message>
                    </forwarded>
                </sent>
            </message>`);
        spyOn(_converse.api, "trigger").and.callThrough();
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => _converse.api.trigger.calls.count(), 500);
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        expect(view.model.messages.length).toBe(1);
    }));
});
