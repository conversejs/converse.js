/*global mock, converse */

const { Strophe } = converse.env;
const u = converse.env.utils;
// See: https://xmpp.org/rfcs/rfc3921.html


describe("XEP-0437 Room Activity Indicators", function () {

    it("will be activated for a MUC that becomes hidden",
        mock.initConverse(
            [], {
                'allow_bookmarks': false, // Hack to get the rooms list to render
                'muc_subscribe_to_rai': true,
                'view_mode': 'fullscreen'},
            async function (_converse) {

        expect(_converse.session.get('rai_enabled_domains')).toBe(undefined);

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);
        expect(view.model.get('hidden')).toBe(false);

        const sent_IQs = _converse.connection.IQ_stanzas;
        const iq_get = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq query[xmlns="${Strophe.NS.MAM}"]`)).pop());
        const first_msg_id = _converse.connection.getUniqueId();
        const last_msg_id = _converse.connection.getUniqueId();
        let message = u.toStanza(
            `<message xmlns="jabber:client"
                    to="romeo@montague.lit/orchard"
                    from="${muc_jid}">
                <result xmlns="urn:xmpp:mam:2" queryid="${iq_get.querySelector('query').getAttribute('queryid')}" id="${first_msg_id}">
                    <forwarded xmlns="urn:xmpp:forward:0">
                        <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:15:23Z"/>
                        <message from="${muc_jid}/some1" type="groupchat">
                            <body>1st MAM Message</body>
                        </message>
                    </forwarded>
                </result>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(message));

        message = u.toStanza(
            `<message xmlns="jabber:client"
                    to="romeo@montague.lit/orchard"
                    from="${muc_jid}">
                <result xmlns="urn:xmpp:mam:2" queryid="${iq_get.querySelector('query').getAttribute('queryid')}" id="${last_msg_id}">
                    <forwarded xmlns="urn:xmpp:forward:0">
                        <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:16:23Z"/>
                        <message from="${muc_jid}/some1" type="groupchat">
                            <body>2nd MAM Message</body>
                        </message>
                    </forwarded>
                </result>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(message));

        const result = u.toStanza(
            `<iq type='result' id='${iq_get.getAttribute('id')}'>
                <fin xmlns='urn:xmpp:mam:2'>
                    <set xmlns='http://jabber.org/protocol/rsm'>
                        <first index='0'>${first_msg_id}</first>
                        <last>${last_msg_id}</last>
                        <count>2</count>
                    </set>
                </fin>
            </iq>`);
        _converse.connection._dataRecv(mock.createRequest(result));
        await u.waitUntil(() => view.model.messages.length === 2);

        const sent_stanzas = [];
        spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s?.nodeTree ?? s));
        view.model.save({'hidden': true});
        await u.waitUntil(() => sent_stanzas.length === 3);

        expect(Strophe.serialize(sent_stanzas[0])).toBe(
            `<message from="${_converse.jid}" id="${sent_stanzas[0].getAttribute('id')}" to="lounge@montague.lit" type="groupchat" xmlns="jabber:client">`+
                `<received id="${last_msg_id}" xmlns="urn:xmpp:chat-markers:0"/>`+
            `</message>`
        );
        expect(Strophe.serialize(sent_stanzas[1])).toBe(
            `<presence to="${muc_jid}/romeo" type="unavailable" xmlns="jabber:client">`+
                `<priority>0</priority>`+
                `<c hash="sha-1" node="https://conversejs.org" ver="/5ng/Bnz6MXvkSDu6hjAlgQ8C60=" xmlns="http://jabber.org/protocol/caps"/>`+
            `</presence>`
        );
        expect(Strophe.serialize(sent_stanzas[2])).toBe(
            `<presence to="montague.lit" xmlns="jabber:client">`+
                `<priority>0</priority>`+
                `<c hash="sha-1" node="https://conversejs.org" ver="/5ng/Bnz6MXvkSDu6hjAlgQ8C60=" xmlns="http://jabber.org/protocol/caps"/>`+
                `<rai xmlns="urn:xmpp:rai:0"/>`+
            `</presence>`
        );

        await u.waitUntil(() => view.model.session.get('connection_status') === converse.ROOMSTATUS.DISCONNECTED);
        expect(view.model.get('has_activity')).toBe(false);

        const room_el = await u.waitUntil(() => document.querySelector("converse-rooms-list .available-chatroom"));
        expect(Array.from(room_el.classList).includes('unread-msgs')).toBeFalsy();

        const activity_stanza = u.toStanza(`
            <message from="${Strophe.getDomainFromJid(muc_jid)}">
                <rai xmlns="urn:xmpp:rai:0">
                    <activity>${muc_jid}</activity>
                </rai>
            </message>
        `);
        _converse.connection._dataRecv(mock.createRequest(activity_stanza));

        await u.waitUntil(() => view.model.get('has_activity'));
        expect(Array.from(room_el.classList).includes('unread-msgs')).toBeTruthy();
    }));

    it("will be activated for a MUC that starts out hidden",
        mock.initConverse(
            [], {
                'allow_bookmarks': false, // Hack to get the rooms list to render
                'muc_subscribe_to_rai': true,
                'view_mode': 'fullscreen'},
            async function (_converse) {

        const { api } = _converse;
        expect(_converse.session.get('rai_enabled_domains')).toBe(undefined);

        const muc_jid = 'lounge@montague.lit';
        const nick = 'romeo';
        const sent_stanzas = _converse.connection.sent_stanzas;

        const muc_creation_promise = await api.rooms.open(muc_jid, {nick, 'hidden': true}, false);
        await mock.getRoomFeatures(_converse, muc_jid, []);
        await mock.receiveOwnMUCPresence(_converse, muc_jid, nick);
        await muc_creation_promise;

        const model = _converse.chatboxes.get(muc_jid);
        await u.waitUntil(() => (model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));
        expect(model.get('hidden')).toBe(true);


        const getSentPresences = () => sent_stanzas.filter(s => s.nodeName === 'presence');
        await u.waitUntil(() => getSentPresences().length === 3, 500);
        const sent_presences = getSentPresences();

        expect(Strophe.serialize(sent_presences[1])).toBe(
            `<presence to="${muc_jid}/romeo" type="unavailable" xmlns="jabber:client">`+
                `<priority>0</priority>`+
                `<c hash="sha-1" node="https://conversejs.org" ver="/5ng/Bnz6MXvkSDu6hjAlgQ8C60=" xmlns="http://jabber.org/protocol/caps"/>`+
            `</presence>`
        );
        expect(Strophe.serialize(sent_presences[2])).toBe(
            `<presence to="montague.lit" xmlns="jabber:client">`+
                `<priority>0</priority>`+
                `<c hash="sha-1" node="https://conversejs.org" ver="/5ng/Bnz6MXvkSDu6hjAlgQ8C60=" xmlns="http://jabber.org/protocol/caps"/>`+
                `<rai xmlns="urn:xmpp:rai:0"/>`+
            `</presence>`
        );

        await u.waitUntil(() => model.session.get('connection_status') === converse.ROOMSTATUS.DISCONNECTED);
        expect(model.get('has_activity')).toBe(false);

        const room_el = await u.waitUntil(() => document.querySelector("converse-rooms-list .available-chatroom"));
        expect(Array.from(room_el.classList).includes('unread-msgs')).toBeFalsy();

        const activity_stanza = u.toStanza(`
            <message from="${Strophe.getDomainFromJid(muc_jid)}">
                <rai xmlns="urn:xmpp:rai:0">
                    <activity>${muc_jid}</activity>
                </rai>
            </message>
        `);
        _converse.connection._dataRecv(mock.createRequest(activity_stanza));

        await u.waitUntil(() => model.get('has_activity'));
        expect(Array.from(room_el.classList).includes('unread-msgs')).toBeTruthy();
    }));


    it("may not be activated due to server resource constraints",
        mock.initConverse(
            [], {
                'allow_bookmarks': false, // Hack to get the rooms list to render
                'muc_subscribe_to_rai': true,
                'view_mode': 'fullscreen'},
            async function (_converse) {

        expect(_converse.session.get('rai_enabled_domains')).toBe(undefined);

        const muc_jid = 'lounge@montague.lit';
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        expect(model.get('hidden')).toBe(false);
        const sent_stanzas = [];
        spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s?.nodeTree ?? s));
        model.save({'hidden': true});
        await u.waitUntil(() => sent_stanzas.filter(s => s.nodeName === 'presence').length === 2);

        const sent_presences = sent_stanzas.filter(s => s.nodeName === 'presence');
        expect(Strophe.serialize(sent_presences[0])).toBe(
            `<presence to="${muc_jid}/romeo" type="unavailable" xmlns="jabber:client">`+
                `<priority>0</priority>`+
                `<c hash="sha-1" node="https://conversejs.org" ver="/5ng/Bnz6MXvkSDu6hjAlgQ8C60=" xmlns="http://jabber.org/protocol/caps"/>`+
            `</presence>`
        );
        expect(Strophe.serialize(sent_presences[1])).toBe(
            `<presence to="montague.lit" xmlns="jabber:client">`+
                `<priority>0</priority>`+
                `<c hash="sha-1" node="https://conversejs.org" ver="/5ng/Bnz6MXvkSDu6hjAlgQ8C60=" xmlns="http://jabber.org/protocol/caps"/>`+
                `<rai xmlns="urn:xmpp:rai:0"/>`+
            `</presence>`
        );
        // If an error presence with "resource-constraint" is returned, we rejoin
        const activity_stanza = u.toStanza(`
            <presence type="error" from="${Strophe.getDomainFromJid(muc_jid)}">
                <error type="wait"><resource-constraint xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error>
            </presence>
        `);
        _converse.connection._dataRecv(mock.createRequest(activity_stanza));

        await u.waitUntil(() => model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING);
    }));

});
