/*global mock, converse */

const { Strophe, stx, u }  = converse.env;

describe("Groupchats", function () {
    describe("when muc_send_probes is true", function () {

        it("sends presence probes when muc_send_probes is true",
                mock.initConverse([], {'muc_send_probes': true}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');

            let stanza = stx`<message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="${muc_jid}/ralphm">
                    <body>This message will trigger a presence probe</body>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
            const view = _converse.chatboxviews.get(muc_jid);

            await u.waitUntil(() => view.model.messages.length);
            let occupant = view.model.messages.at(0)?.occupant;
            expect(occupant).toBeDefined();
            expect(occupant.get('nick')).toBe('ralphm');
            expect(occupant.get('affiliation')).toBeUndefined();
            expect(occupant.get('role')).toBeUndefined();

            const sent_stanzas = _converse.api.connection.get().sent_stanzas;
            let probe = await u.waitUntil(() => sent_stanzas.filter(s => s.matches('presence[type="probe"]')).pop());
            expect(Strophe.serialize(probe)).toBe(
                `<presence to="${muc_jid}/ralphm" type="probe" xmlns="jabber:client">`+
                    `<priority>0</priority>`+
                    `<c hash="sha-1" node="https://conversejs.org" ver="TfHz9vOOfqIG0Z9lW5CuPaWGnrQ=" xmlns="http://jabber.org/protocol/caps"/>`+
                `</presence>`);

            let presence = stx`<presence xmlns="jabber:client" to="${_converse.jid}" from="${muc_jid}/ralphm">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="member" jid="ralph@example.org/Conversations.ZvLu" role="participant"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            await u.waitUntil(() => occupant.get('affiliation') === 'member');
            expect(occupant.get('role')).toBe('participant');

            // Check that unavailable but affiliated occupants don't get destroyed
            stanza = stx`<message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="${muc_jid}/gonePhising">
                    <body>This message from an unavailable user will trigger a presence probe</body>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

            await u.waitUntil(() => view.model.messages.length === 2);
            occupant = view.model.messages.at(1)?.occupant;
            expect(occupant).toBeDefined();
            expect(occupant.get('nick')).toBe('gonePhising');
            expect(occupant.get('affiliation')).toBeUndefined();
            expect(occupant.get('role')).toBeUndefined();

            probe = await u.waitUntil(() => sent_stanzas.filter(s => s.matches(`presence[to="${muc_jid}/gonePhising"]`)).pop());
            expect(Strophe.serialize(probe)).toBe(
                `<presence to="${muc_jid}/gonePhising" type="probe" xmlns="jabber:client">`+
                    `<priority>0</priority>`+
                    `<c hash="sha-1" node="https://conversejs.org" ver="TfHz9vOOfqIG0Z9lW5CuPaWGnrQ=" xmlns="http://jabber.org/protocol/caps"/>`+
                `</presence>`);

            presence = stx`<presence xmlns="jabber:client" type="unavailable" to="${_converse.jid}" from="${muc_jid}/gonePhising">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="member" jid="gonePhishing@example.org/d34dBEEF" role="participant"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            expect(view.model.occupants.length).toBe(3);
            await u.waitUntil(() => occupant.get('affiliation') === 'member');
            expect(occupant.get('role')).toBe('participant');
        }));
    });
});
