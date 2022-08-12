/*global mock, converse */

const { Strophe, u, $msg } = converse.env;

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

    it("keeps track whether you are the sender or not",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const msg = $msg({
                from: 'lounge@montague.lit/romeo',
                id: u.getUniqueId(),
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t('I wrote this message!').tree();
        await model.handleMessageStanza(msg);
        await u.waitUntil(() => model.messages.last()?.get('received'));
        expect(model.messages.last().get('sender')).toBe('me');
    }));

    it("gets updated with its stanza-id upon MUC reflection",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'room@muc.example.com';
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');

        model.sendMessage({'body': 'hello world'});
        await u.waitUntil(() => model.messages.length === 1);
        const msg = model.messages.at(0);
        expect(msg.get('stanza_id')).toBeUndefined();
        expect(msg.get('origin_id')).toBe(msg.get('origin_id'));

        const stanza = u.toStanza(`
            <message xmlns="jabber:client"
                     from="room@muc.example.com/romeo"
                     to="${_converse.connection.jid}"
                     type="groupchat">
                <body>Hello world</body>
                <stanza-id xmlns="urn:xmpp:sid:0"
                           id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad"
                           by="room@muc.example.com"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="${msg.get('origin_id')}"/>
            </message>`);
        spyOn(model, 'updateMessage').and.callThrough();
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => model.updateMessage.calls.count() === 1);
        expect(model.messages.length).toBe(1);
        expect(model.messages.at(0).get('stanza_id room@muc.example.com')).toBe("5f3dbc5e-e1d3-4077-a492-693f3769c7ad");
        expect(model.messages.at(0).get('origin_id')).toBe(msg.get('origin_id'));
    }));

    it("is rejected if it's an unencapsulated forwarded message",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const impersonated_jid = `${muc_jid}/alice`;
        const received_stanza = u.toStanza(`
            <message to='${_converse.jid}' from='${muc_jid}/mallory' type='groupchat' id='${_converse.connection.getUniqueId()}'>
                <forwarded xmlns='urn:xmpp:forward:0'>
                    <delay xmlns='urn:xmpp:delay' stamp='2019-07-10T23:08:25Z'/>
                    <message from='${impersonated_jid}'
                            id='0202197'
                            to='${_converse.bare_jid}'
                            type='groupchat'
                            xmlns='jabber:client'>
                        <body>Yet I should kill thee with much cherishing.</body>
                    </message>
                </forwarded>
            </message>
        `);
        spyOn(converse.env.log, 'error').and.callThrough();
        _converse.connection._dataRecv(mock.createRequest(received_stanza));
        await u.waitUntil(() => converse.env.log.error.calls.count() === 1);
        expect(converse.env.log.error.calls.argsFor(0)[0]?.message).toBe(
            `Ignoring unencapsulated forwarded message from ${muc_jid}/mallory`
        );
        const model = _converse.chatboxes.get(muc_jid);
        expect(model.messages.length).toBe(0);
    }));

    it('parses the correct body element',
            mock.initConverse(['chatBoxesFetched'], {}, async function(_converse) {

        const muc_jid = 'lounge@montague.lit';
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const received_stanza = u.toStanza(`
        <message to='${_converse.jid}' from='${muc_jid}/mallory' type='groupchat' id='${_converse.connection.getUniqueId()}' >
            <reply xmlns='urn:xmpp:reply:0' id='${_converse.connection.getUniqueId()}' to='${_converse.jid}'/>
            <fallback xmlns='urn:xmpp:feature-fallback:0' for='urn:xmpp:reply:0'>
                <body start='0' end='10'/>
            </fallback>
            <active xmlns='http://jabber.org/protocol/chatstates'/>
            <body>&gt; ping
pong</body>
            <request xmlns='urn:xmpp:receipts'/>
        </message>
    `);
        await model.handleMessageStanza(received_stanza);
        await u.waitUntil(() => model.messages.last());
        expect(model.messages.last().get('body')).toBe('> ping\npong');
    }));
});
