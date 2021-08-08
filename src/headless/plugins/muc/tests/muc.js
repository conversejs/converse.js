/*global mock, converse */

const { u } = converse.env;

describe("Groupchats", function () {

    it("keeps track of unread messages and mentions",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        // Open a hidden room
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick, [], [], false, {'hidden': true});
        const model = _converse.chatboxes.get(muc_jid);

        _converse.connection._dataRecv(mock.createRequest(u.toStanza(`
            <message xmlns="jabber:client" type="groupchat" id="1" to="${_converse.jid}" xml:lang="en" from="${muc_jid}/juliet">
                <body>Romeo oh romeo</body>
            </message>`)));
        await u.waitUntil(() => model.messages.length);
        expect(model.get('num_unread_general')).toBe(1);
        expect(model.get('num_unread')).toBe(1);

        _converse.connection._dataRecv(mock.createRequest(u.toStanza(`
            <message xmlns="jabber:client" type="groupchat" id="2" to="${_converse.jid}" xml:lang="en" from="${muc_jid}/juliet">
                <body>Wherefore art though?</body>
            </message>`)));

        await u.waitUntil(() => model.messages.length === 2);

        expect(model.get('num_unread_general')).toBe(2);
        expect(model.get('num_unread')).toBe(1);

        // Check that unread counters are cleared when chat becomes visible
        model.set('hidden', false);
        expect(model.get('num_unread_general')).toBe(0);
        expect(model.get('num_unread')).toBe(0);
    }));
});
