/*global mock, converse */
const { stx, u } = converse.env;

describe('When receiving a MUC private message', function () {
    it(
        "doesn't appear in the main MUC chatarea",
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            const muc_jid = 'coven@chat.shakespeare.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(stx`
                    <presence
                        from="${muc_jid}/firstwitch"
                        id="${u.getUniqueId()}"
                        to="${_converse.jid}"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="owner" role="moderator"/>
                    </x>
                    </presence>`)
            );

            await u.waitUntil(() => view.model.occupants.length === 2);

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(stx`
                    <message from="${muc_jid}/firstwitch"
                            id="${u.getUniqueId()}"
                            to="${_converse.jid}"
                            type="chat"
                            xmlns="jabber:client">
                        <body>I'll give thee a wind.</body>
                        <x xmlns="http://jabber.org/protocol/muc#user" />
                    </message>
                `)
            );

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(stx`
                    <message from="coven@chat.shakespeare.lit/thirdwitch"
                            id="${u.getUniqueId()}"
                            to="${_converse.jid}"
                            type="groupchat"
                            xmlns="jabber:client">
                        <body>Harpier cries: "tis time, "tis time.</body>
                    </message>
                `)
            );

            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);

            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.pop().get('message')).toBe('Harpier cries: "tis time, "tis time.');

            const occupant = view.model.occupants.findOccupant({ nick: 'firstwitch' });
            expect(occupant.get('num_unread')).toBe(1);
            expect(occupant.messages.length).toBe(1);
            expect(occupant.messages.pop().get('message')).toBe("I'll give thee a wind.");
        })
    );
});
