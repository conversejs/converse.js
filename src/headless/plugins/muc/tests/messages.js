/*global mock, converse */

const { Strophe, u } = converse.env;

describe("A MUC message", function () {

    it("saves the user's real JID as looked up via the XEP-0421 occupant id",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        const nick = 'romeo';
        const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, nick, features);
        const occupant_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const presence = u.toStanza(`
            <presence
                from="${muc_jid}/thirdwitch"
                id="${u.getUniqueId()}"
                to="${_converse.bare_jid}">
            <x xmlns="http://jabber.org/protocol/muc#user">
                <item jid="${occupant_jid}" />
            </x>
            <occupant-id xmlns="urn:xmpp:occupant-id:0" id="dd72603deec90a38ba552f7c68cbcc61bca202cd" />
            </presence>`);
        _converse.connection._dataRecv(mock.createRequest(presence));
        expect(model.getOccupantByNickname('thirdwitch').get('occupant_id')).toBe('dd72603deec90a38ba552f7c68cbcc61bca202cd');

        const stanza = u.toStanza(`
            <message
                from='${muc_jid}/thirdwitch'
                id='hysf1v37'
                to='${_converse.bare_jid}'
                type='groupchat'>
            <body>Harpier cries: 'tis time, 'tis time.</body>
            <occupant-id xmlns="urn:xmpp:occupant-id:0" id="dd72603deec90a38ba552f7c68cbcc61bca202cd" />
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(stanza));

        await u.waitUntil(() => model.messages.length);
        expect(model.messages.at(0).get('occupant_id')).toBe("dd72603deec90a38ba552f7c68cbcc61bca202cd");
        expect(model.messages.at(0).get('from_real_jid')).toBe(occupant_jid);
    }));
});
