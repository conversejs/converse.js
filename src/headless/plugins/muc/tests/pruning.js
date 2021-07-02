/*global mock, converse */

const {  u } = converse.env;

describe("A Groupchat Message", function () {

    it("will be pruned if it exceeds the prune_messages_above threshold",
        mock.initConverse(
            ['chatBoxesFetched'],
            {'prune_messages_above': 3},
            async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        expect(model.ui.get('scrolled')).toBeFalsy();

        model.sendMessage({'body': '1st message'});
        model.sendMessage({'body': '2nd message'});
        model.sendMessage({'body': '3rd message'});
        await u.waitUntil(() => model.messages.length === 3);
        // Make sure pruneHistory fires
        await new Promise(resolve => setTimeout(resolve, 550));

        model.sendMessage({'body': '4th message'});
        await u.waitUntil(() => model.messages.length === 4);
        await u.waitUntil(() => model.messages.length === 3, 550);

        model.ui.set('scrolled', true);
        model.sendMessage({'body': '5th message'});
        model.sendMessage({'body': '6th message'});
        await u.waitUntil(() => model.messages.length === 5);

        // Wait long enough to be sure the debounced pruneHistory method didn't fire.
        await new Promise(resolve => setTimeout(resolve, 550));
        expect(model.messages.length).toBe(5);
        model.ui.set('scrolled', false);
        await u.waitUntil(() => model.messages.length === 3, 550);

        // Test incoming messages
        const stanza = u.toStanza(`
            <message xmlns="jabber:client"
                     from="${muc_jid}/juliet"
                     to="${_converse.connection.jid}"
                     type="groupchat">
                <body>1st incoming</body>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => model.messages.length === 4);
        await u.waitUntil(() => model.messages.length === 3, 550);
    }));
});
