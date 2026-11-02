import converse from '../../../dist/converse-headless.js';
import mock from '../../../tests/mock.js';

const { stx, u } = converse.env;

describe('Sending a message that targets another', function () {
    it(
        'replies to a given message by its msgid in a chat, leaving the reply chosen on the chat alone',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const chat = await mock.openChatBoxFor(_converse, contact_jid);
            await _converse.handleMessageStanza(stx`
                <message xmlns="jabber:client" from="${contact_jid}/orchard" to="${_converse.bare_jid}"
                        type="chat" id="target-1">
                    <body>Wherefore art thou?</body>
                </message>`);
            const target = await u.waitUntil(() => chat.messages.findWhere({ msgid: 'target-1' }));
            chat.save({ reply_to_id: 'chosen', reply_to: contact_jid });

            const { sent_stanzas } = _converse.api.connection.get();
            const message = await chat.sendMessage({ body: 'Here' }, { replying_to: target });

            const stanza = sent_stanzas.filter((s) => s.nodeName === 'message').pop();
            const reply = stanza.querySelector('reply');
            expect(reply.getAttribute('id')).toBe('target-1');
            expect(reply.getAttribute('to')).toBe(`${contact_jid}/orchard`);
            expect(message.get('reply_to_id')).toBe('target-1');
            expect(message.getMessageText()).toBe('Here');
            expect(chat.get('reply_to_id')).toBe('chosen');
        }),
    );

    it(
        'corrects a given message of ours, not only the one marked as being corrected',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const chat = await mock.openChatBoxFor(_converse, contact_jid);
            const first = await chat.sendMessage({ body: 'Frist' });
            await chat.sendMessage({ body: 'Second' });

            const { sent_stanzas } = _converse.api.connection.get();
            const corrected = await chat.sendMessage({ body: 'First' }, { correcting: first });

            expect(corrected).toBe(first);
            expect(chat.messages.length).toBe(2);
            expect(first.get('body')).toBe('First');
            expect(first.get('edited')).toBeTruthy();
            const stanza = sent_stanzas.filter((s) => s.nodeName === 'message').pop();
            const replace = stanza.querySelector('replace');
            expect(replace.getAttribute('id')).toBe(first.get('msgid'));
        }),
    );

    it(
        "refuses to correct a message that isn't ours, or isn't in the conversation",
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            await mock.waitForRoster(_converse, 'current', 2);
            const [contact_jid, other_jid] = mock.cur_names
                .slice(0, 2)
                .map((name) => name.replace(/ /g, '.').toLowerCase() + '@montague.lit');
            const chat = await mock.openChatBoxFor(_converse, contact_jid);
            const other_chat = await mock.openChatBoxFor(_converse, other_jid);
            await _converse.handleMessageStanza(stx`
                <message xmlns="jabber:client" from="${contact_jid}/orchard" to="${_converse.bare_jid}"
                        type="chat" id="theirs">
                    <body>Wherefore art thou?</body>
                </message>`);
            const theirs = await u.waitUntil(() => chat.messages.findWhere({ msgid: 'theirs' }));
            const elsewhere = await other_chat.sendMessage({ body: 'Elsewhere' });

            const { sent_stanzas } = _converse.api.connection.get();
            const sent = sent_stanzas.length;
            await expect(chat.sendMessage({ body: 'Mine now' }, { correcting: theirs })).rejects.toThrow(
                "Can't correct",
            );
            await expect(chat.sendMessage({ body: 'Moved' }, { correcting: elsewhere })).rejects.toThrow(
                "Can't correct",
            );

            expect(theirs.get('body')).toBe('Wherefore art thou?');
            expect(elsewhere.get('body')).toBe('Elsewhere');
            expect(chat.messages.length).toBe(1);
            expect(sent_stanzas.length).toBe(sent);
        }),
    );

    it(
        'replies to a groupchat message by the stanza-id the room gave it',
        mock.initConverse(converse, [], {}, async (_converse) => {
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'lounge@montague.lit';
            const muc = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                    <message xmlns="jabber:client" from="${muc_jid}/juliet" to="${_converse.jid}"
                            type="groupchat" id="client-id">
                        <body>Anyone here?</body>
                        <stanza-id xmlns="urn:xmpp:sid:0" id="room-id" by="${muc_jid}"/>
                    </message>`,
                ),
            );
            const target = await u.waitUntil(() => muc.messages.findWhere({ msgid: 'client-id' }));

            const { sent_stanzas } = _converse.api.connection.get();
            await muc.sendMessage({ body: 'Yes' }, { replying_to: target });

            const stanza = sent_stanzas.filter((s) => s.nodeName === 'message').pop();
            const reply = stanza.querySelector('reply');
            expect(reply.getAttribute('id')).toBe('room-id');
            expect(reply.getAttribute('to')).toBe(`${muc_jid}/juliet`);
        }),
    );
});
