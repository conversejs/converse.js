/*global mock, converse */

const { Strophe, u } = converse.env;

describe("A MUC occupant", function () {

    it("does not stores the XEP-0421 occupant id if the feature isn't advertised",
            mock.initConverse([], {}, async function (_converse) {
        const muc_jid = 'lounge@montague.lit';
        const nick = 'romeo';
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, nick);

        // See example 21 https://xmpp.org/extensions/xep-0045.html#enter-pres
        const id = u.getUniqueId();
        const name = mock.chatroom_names[0];
        const presence = u.toStanza(`
            <presence
                from="${muc_jid}/${name}"
                id="${u.getUniqueId()}"
                to="${_converse.bare_jid}">
            <x xmlns="http://jabber.org/protocol/muc#user" />
            <occupant-id xmlns="urn:xmpp:occupant-id:0" id="${id}" />
            </presence>`);
        _converse.connection._dataRecv(mock.createRequest(presence));
        expect(model.getOccupantByNickname(name).get('occupant_id')).toBe(undefined);
    }));

    it("stores the XEP-0421 occupant id received from a presence stanza",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        const nick = 'romeo';
        const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, nick, features);

        expect(model.occupants.length).toBe(1);
        expect(model.get('occupant_id')).not.toBeFalsy();
        expect(model.get('occupant_id')).toBe(model.occupants.at(0).get('occupant_id'));

        for (let i=0; i<mock.chatroom_names.length; i++) {
            // See example 21 https://xmpp.org/extensions/xep-0045.html#enter-pres
            const id = u.getUniqueId();
            const name = mock.chatroom_names[i];
            const presence = u.toStanza(`
                <presence
                    from="${muc_jid}/${name}"
                    id="${u.getUniqueId()}"
                    to="${_converse.bare_jid}">
                <x xmlns="http://jabber.org/protocol/muc#user" />
                <occupant-id xmlns="urn:xmpp:occupant-id:0" id="${id}" />
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(presence));
            expect(model.getOccupantByNickname(name).get('occupant_id')).toBe(id);
        }
        expect(model.occupants.length).toBe(mock.chatroom_names.length + 1);
    }));

    it("will be added to a MUC message based on the XEP-0421 occupant id",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        const nick = 'romeo';
        const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, nick, features);

        expect(model.occupants.length).toBe(1);
        expect(model.get('occupant_id')).not.toBeFalsy();
        expect(model.get('occupant_id')).toBe(model.occupants.at(0).get('occupant_id'));

        const occupant_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

        const stanza = u.toStanza(`
            <message
                from='${muc_jid}/3rdwitch'
                id='hysf1v37'
                to='${_converse.bare_jid}'
                type='groupchat'>
            <body>Harpier cries: 'tis time, 'tis time.</body>
            <occupant-id xmlns="urn:xmpp:occupant-id:0" id="dd72603deec90a38ba552f7c68cbcc61bca202cd" />
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(stanza));

        await u.waitUntil(() => model.messages.length);
        let message = model.messages.at(0);
        expect(message.get('occupant_id')).toBe("dd72603deec90a38ba552f7c68cbcc61bca202cd");
        expect(message.occupant).toBeUndefined();
        expect(message.getDisplayName()).toBe('3rdwitch');

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

        const occupant = await u.waitUntil(() => model.getOccupantByNickname('thirdwitch'));
        expect(occupant.get('occupant_id')).toBe('dd72603deec90a38ba552f7c68cbcc61bca202cd');
        expect(model.occupants.findWhere({'occupant_id': "dd72603deec90a38ba552f7c68cbcc61bca202cd"})).toBe(occupant);

        message = model.messages.at(0);
        expect(occupant.get('nick')).toBe('thirdwitch');
        expect(message.occupant).toEqual(occupant);
        expect(message.getDisplayName()).toBe('thirdwitch');
    }));
});
