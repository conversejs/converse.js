/*global mock, converse */
// XEP-0444: Message Reactions
const { Strophe, u } = converse.env;


describe("A XEP-0444 Message Reaction", function () {

    it("is handled when received in a 1:1 chat",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const chatbox = _converse.chatboxes.get(contact_jid);

        // First send a message that will be reacted to
        const msgid = u.getUniqueId();
        const stanza = u.toStanza(`
            <message from='${contact_jid}'
                id='${msgid}'
                type="chat"
                to='${_converse.jid}'>
              <body>Hello world</body>
            </message>`);
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => chatbox.messages.length === 1);

        const message = chatbox.messages.at(0);
        expect(message.get('body')).toBe('Hello world');

        // Now receive a reaction to that message
        const reaction_stanza = u.toStanza(`
            <message from='${contact_jid}'
                id='${u.getUniqueId()}'
                type="chat"
                to='${_converse.jid}'>
              <reactions id='${msgid}' xmlns='urn:xmpp:reactions:0'>
                <reaction>👍</reaction>
              </reactions>
              <store xmlns="urn:xmpp:hints"/>
            </message>`);
        _converse.api.connection.get()._dataRecv(mock.createRequest(reaction_stanza));

        await u.waitUntil(() => message.get('reactions'));
        const reactions = message.get('reactions');
        expect(reactions[Strophe.getBareJidFromJid(contact_jid)]).toEqual(['👍']);
    }));

    it("can contain multiple emojis",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const chatbox = _converse.chatboxes.get(contact_jid);

        const msgid = u.getUniqueId();
        const stanza = u.toStanza(`
            <message from='${contact_jid}'
                id='${msgid}'
                type="chat"
                to='${_converse.jid}'>
              <body>Great news!</body>
            </message>`);
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => chatbox.messages.length === 1);

        const message = chatbox.messages.at(0);

        // Send multiple reactions
        const reaction_stanza = u.toStanza(`
            <message from='${contact_jid}'
                id='${u.getUniqueId()}'
                type="chat"
                to='${_converse.jid}'>
              <reactions id='${msgid}' xmlns='urn:xmpp:reactions:0'>
                <reaction>👍</reaction>
                <reaction>🎉</reaction>
                <reaction>❤️</reaction>
              </reactions>
              <store xmlns="urn:xmpp:hints"/>
            </message>`);
        _converse.api.connection.get()._dataRecv(mock.createRequest(reaction_stanza));

        await u.waitUntil(() => message.get('reactions'));
        const reactions = message.get('reactions');
        const sender = Strophe.getBareJidFromJid(contact_jid);
        expect(reactions[sender]).toEqual(['👍', '🎉', '❤️']);
    }));

    it("can be removed by sending an empty reactions element",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const chatbox = _converse.chatboxes.get(contact_jid);

        const msgid = u.getUniqueId();
        const stanza = u.toStanza(`
            <message from='${contact_jid}'
                id='${msgid}'
                type="chat"
                to='${_converse.jid}'>
              <body>Hello</body>
            </message>`);
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => chatbox.messages.length === 1);

        const message = chatbox.messages.at(0);

        // First add a reaction
        const add_reaction = u.toStanza(`
            <message from='${contact_jid}'
                id='${u.getUniqueId()}'
                type="chat"
                to='${_converse.jid}'>
              <reactions id='${msgid}' xmlns='urn:xmpp:reactions:0'>
                <reaction>👍</reaction>
              </reactions>
              <store xmlns="urn:xmpp:hints"/>
            </message>`);
        _converse.api.connection.get()._dataRecv(mock.createRequest(add_reaction));
        await u.waitUntil(() => message.get('reactions'));

        const sender = Strophe.getBareJidFromJid(contact_jid);
        expect(message.get('reactions')[sender]).toEqual(['👍']);

        // Now remove all reactions
        const remove_reaction = u.toStanza(`
            <message from='${contact_jid}'
                id='${u.getUniqueId()}'
                type="chat"
                to='${_converse.jid}'>
              <reactions id='${msgid}' xmlns='urn:xmpp:reactions:0'>
              </reactions>
              <store xmlns="urn:xmpp:hints"/>
            </message>`);
        _converse.api.connection.get()._dataRecv(mock.createRequest(remove_reaction));

        await u.waitUntil(() => {
            const r = message.get('reactions');
            return r && !r[sender];
        });
        expect(message.get('reactions')[sender]).toBeUndefined();
    }));

    it("does not create a new message in the chat",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const chatbox = _converse.chatboxes.get(contact_jid);

        const msgid = u.getUniqueId();
        const stanza = u.toStanza(`
            <message from='${contact_jid}'
                id='${msgid}'
                type="chat"
                to='${_converse.jid}'>
              <body>Test message</body>
            </message>`);
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => chatbox.messages.length === 1);

        // Send a reaction — should NOT create a new message
        const reaction_stanza = u.toStanza(`
            <message from='${contact_jid}'
                id='${u.getUniqueId()}'
                type="chat"
                to='${_converse.jid}'>
              <reactions id='${msgid}' xmlns='urn:xmpp:reactions:0'>
                <reaction>😂</reaction>
              </reactions>
              <store xmlns="urn:xmpp:hints"/>
            </message>`);
        _converse.api.connection.get()._dataRecv(mock.createRequest(reaction_stanza));

        // Wait a bit and ensure no new message was created
        await u.waitUntil(() => chatbox.messages.at(0).get('reactions'));
        expect(chatbox.messages.length).toBe(1);
    }));
});
