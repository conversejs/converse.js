/*global mock, converse */

const { u, stx } = converse.env;

describe("A XEP-0317 MUC Hat", function () {

    it("can be included in a presence stanza",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);


        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <presence
                to="romeo@montague.lit/_converse.js-29092160"
                from="coven@chat.shakespeare.lit/newguy"
                xmlns="jabber:client">
                <x xmlns="${Strophe.NS.MUC_USER}">
                    <item affiliation="none" jid="newguy@montague.lit/_converse.js-290929789" role="participant"/>
                </x>
            </presence>`));

        const hat1_id = u.getUniqueId();
        const hat2_id = u.getUniqueId();
        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <presence from="${muc_jid}/Terry" id="${u.getUniqueId()}" to="${_converse.jid}" xmlns="jabber:client">
                <x xmlns="http://jabber.org/protocol/muc#user">
                    <item affiliation="member" role="participant"/>
                </x>
                <hats xmlns="urn:xmpp:hats:0">
                    <hat title="Teacher&apos;s Assistant" id="${hat1_id}"/>
                    <hat title="Dark Mage" id="${hat2_id}"/>
                </hats>
            </presence>`));

        await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
            "romeo and Terry have entered the groupchat");

        let hats = view.model.getOccupant("Terry").get('hats');
        expect(hats.length).toBe(2);
        expect(hats.map(h => h.title).join(' ')).toBe("Teacher's Assistant Dark Mage");

        _converse.api.connection.get()._dataRecv(mock.createRequest(u.toStanza(`
            <message type="groupchat" from="${muc_jid}/Terry" id="${u.getUniqueId()}" to="${_converse.jid}">
                <body>Hello world</body>
            </message>
        `)));

        const msg_el = await u.waitUntil(() => view.querySelector('.chat-msg'));
        let badges = Array.from(msg_el.querySelectorAll('.badge'));
        expect(badges.length).toBe(2);
        expect(badges.map(b => b.textContent.trim()).join(' ' )).toBe("Teacher's Assistant Dark Mage");

        const hat3_id = u.getUniqueId();
        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <presence from="${muc_jid}/Terry" id="${u.getUniqueId()}" to="${_converse.jid}" xmlns="jabber:client">
                <x xmlns="http://jabber.org/protocol/muc#user">
                    <item affiliation="member" role="participant"/>
                </x>
                <hats xmlns="urn:xmpp:hats:0">
                    <hat title="Teacher&apos;s Assistant" id="${hat1_id}"/>
                    <hat title="Dark Mage" id="${hat2_id}"/>
                    <hat title="Mad hatter" id="${hat3_id}"/>
                </hats>
            </presence>
        `));

        await u.waitUntil(() => view.model.getOccupant("Terry").get('hats').length === 3);
        hats = view.model.getOccupant("Terry").get('hats');
        expect(hats.map(h => h.title).join(' ')).toBe("Teacher's Assistant Dark Mage Mad hatter");
        await u.waitUntil(() => view.querySelectorAll('.chat-msg .badge').length === 3, 1000);
        badges = Array.from(view.querySelectorAll('.chat-msg .badge'));
        expect(badges.map(b => b.textContent.trim()).join(' ' )).toBe("Teacher's Assistant Dark Mage Mad hatter");

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <presence from="${muc_jid}/Terry" id="${u.getUniqueId()}" to="${_converse.jid}" xmlns="jabber:client">
                <x xmlns="http://jabber.org/protocol/muc#user">
                    <item affiliation="member" role="participant"/>
                </x>
            </presence>
        `));
        await u.waitUntil(() => view.model.getOccupant("Terry").get('hats').length === 0);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg .badge').length === 0);
    }));
})
