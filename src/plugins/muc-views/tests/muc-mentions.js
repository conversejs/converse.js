/*global mock, converse */

const { dayjs } = converse.env;
const u = converse.env.utils;
// See: https://xmpp.org/rfcs/rfc3921.html


describe("MUC Mention Notfications", function () {

    it("may be received from a MUC in which the user is not currently present",
        mock.initConverse([], {
                'allow_bookmarks': false, // Hack to get the rooms list to render
                'muc_subscribe_to_rai': true,
                'view_mode': 'fullscreen'},
            async function (_converse) {

        const { api } = _converse;

        expect(_converse.session.get('rai_enabled_domains')).toBe(undefined);

        const muc_jid = 'lounge@montague.lit';
        const nick = 'romeo';
        const muc_creation_promise = await api.rooms.open(muc_jid, {nick, 'hidden': true}, false);
        await mock.getRoomFeatures(_converse, muc_jid, []);
        await mock.receiveOwnMUCPresence(_converse, muc_jid, nick);
        await muc_creation_promise;

        const model = _converse.chatboxes.get(muc_jid);
        await u.waitUntil(() => (model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));
        expect(model.get('hidden')).toBe(true);
        await u.waitUntil(() => model.session.get('connection_status') === converse.ROOMSTATUS.DISCONNECTED);

        const room_el = await u.waitUntil(() => document.querySelector("converse-rooms-list .available-chatroom"));
        expect(Array.from(room_el.classList).includes('unread-msgs')).toBeFalsy();

        const base_time = new Date();
        let message = u.toStanza(`
            <message from="${muc_jid}">
                <mentions xmlns='urn:xmpp:mmn:0'>
                    <forwarded xmlns='urn:xmpp:forward:0'>
                        <delay xmlns='urn:xmpp:delay' stamp='${dayjs(base_time).subtract(5, 'minutes').toISOString()}'/>
                        <message type='groupchat' id='${_converse.connection.getUniqueId()}'
                            to='${muc_jid}'
                            from='${muc_jid}/juliet'
                            xml:lang='en'>
                            <body>Romeo, wherefore art though Romeo</body>
                            <reference xmlns='urn:xmpp:reference:0'
                                type='mention'
                                begin='0'
                                uri='xmpp:${_converse.bare_jid}'
                                end='5'/>
                        </message>
                    </forwarded>
                </mentions>
            </message>
        `);
        _converse.connection._dataRecv(mock.createRequest(message));

        await u.waitUntil(() => Array.from(room_el.classList).includes('unread-msgs'));
        expect(room_el.querySelector('.msgs-indicator')?.textContent.trim()).toBe('1');

        message = u.toStanza(`
            <message from="${muc_jid}">
                <mentions xmlns='urn:xmpp:mmn:0'>
                    <forwarded xmlns='urn:xmpp:forward:0'>
                        <delay xmlns='urn:xmpp:delay' stamp='${dayjs(base_time).subtract(4, 'minutes').toISOString()}'/>
                        <message type='groupchat' id='${_converse.connection.getUniqueId()}'
                            to='${muc_jid}'
                            from='${muc_jid}/juliet'
                            xml:lang='en'>
                            <body>Romeo, wherefore art though Romeo</body>
                            <reference xmlns='urn:xmpp:reference:0'
                                type='mention'
                                begin='0'
                                uri='xmpp:${_converse.bare_jid}'
                                end='5'/>
                        </message>
                    </forwarded>
                </mentions>
            </message>
        `);
        _converse.connection._dataRecv(mock.createRequest(message));
        expect(Array.from(room_el.classList).includes('unread-msgs')).toBeTruthy();
        await u.waitUntil(() => room_el.querySelector('.msgs-indicator')?.textContent.trim() === '2');
    }));
});
