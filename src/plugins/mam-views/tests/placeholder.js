/*global mock, converse */

const { Strophe, u } = converse.env;

describe("Message Archive Management", function () {

    describe("A placeholder message", function () {

        it("is created to indicate a gap in the history",
            mock.initConverse(
                ['discoInitialized'],
                {
                    'archived_messages_page_size': 2,
                    'persistent_store': 'localStorage',
                    'mam_request_all_pages': false
                },
                async function (_converse) {

            const sent_IQs = _converse.connection.IQ_stanzas;
            const muc_jid = 'orchard@chat.shakespeare.lit';
            const msgid = u.getUniqueId();

            // We put an already cached message in localStorage
            const key_prefix = `converse-test-persistent/${_converse.bare_jid}`;
            let key = `${key_prefix}/converse.messages-${muc_jid}-${_converse.bare_jid}`;
            localStorage.setItem(key, `["converse.messages-${muc_jid}-${_converse.bare_jid}-${msgid}"]`);

            key = `${key_prefix}/converse.messages-${muc_jid}-${_converse.bare_jid}-${msgid}`;
            const msgtxt = "existing cached message";
            localStorage.setItem(key, `{
                "body": "${msgtxt}",
                "message": "${msgtxt}",
                "editable":true,
                "from": "${muc_jid}/romeo",
                "fullname": "Romeo",
                "id": "${msgid}",
                "is_archived": false,
                "is_only_emojis": false,
                "nick": "jc",
                "origin_id": "${msgid}",
                "received": "2021-06-15T11:17:15.451Z",
                "sender": "me",
                "stanza_id ${muc_jid}": "1e1c2355-c5b8-4d48-9e33-1310724578c2",
                "time": "2021-06-15T11:17:15.424Z",
                "type": "groupchat",
                "msgid": "${msgid}"
            }`);

            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);

            let iq_get = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq query[xmlns="${Strophe.NS.MAM}"]`)).pop());
            const first_msg_id = _converse.connection.getUniqueId();
            const second_msg_id = _converse.connection.getUniqueId();
            const third_msg_id = _converse.connection.getUniqueId();
            let message = u.toStanza(
                `<message xmlns="jabber:client"
                        to="romeo@montague.lit/orchard"
                        from="${muc_jid}">
                    <result xmlns="urn:xmpp:mam:2" queryid="${iq_get.querySelector('query').getAttribute('queryid')}" id="${second_msg_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2021-06-15T11:18:23Z"/>
                            <message from="${muc_jid}/some1" type="groupchat">
                                <body>2nd MAM Message</body>
                            </message>
                        </forwarded>
                    </result>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(message));

            message = u.toStanza(
                `<message xmlns="jabber:client"
                        to="romeo@montague.lit/orchard"
                        from="${muc_jid}">
                    <result xmlns="urn:xmpp:mam:2" queryid="${iq_get.querySelector('query').getAttribute('queryid')}" id="${third_msg_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2021-06-15T12:16:23Z"/>
                            <message from="${muc_jid}/some1" type="groupchat">
                                <body>3rd MAM Message</body>
                            </message>
                        </forwarded>
                    </result>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(message));

            // Clear so that we don't match the older query
            while (sent_IQs.length) { sent_IQs.pop(); }

            let result = u.toStanza(
                `<iq type='result' id='${iq_get.getAttribute('id')}'>
                    <fin xmlns='urn:xmpp:mam:2'>
                        <set xmlns='http://jabber.org/protocol/rsm'>
                            <first index='0'>${second_msg_id}</first>
                            <last>${third_msg_id}</last>
                            <count>3</count>
                        </set>
                    </fin>
                </iq>`);
            _converse.connection._dataRecv(mock.createRequest(result));
            await u.waitUntil(() => view.model.messages.length === 4);

            const msg = view.model.messages.at(1);
            expect(msg instanceof _converse.MAMPlaceholderMessage).toBe(true);
            expect(msg.get('time')).toBe('2021-06-15T11:18:22.999Z');

            const placeholder_el = view.querySelector('converse-mam-placeholder');
            placeholder_el.firstElementChild.click();
            await u.waitUntil(() => view.querySelector('converse-mam-placeholder .spinner'));

            iq_get = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq query[xmlns="${Strophe.NS.MAM}"]`)).pop());
            expect(Strophe.serialize(iq_get)).toBe(
                `<iq id="${iq_get.getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">`+
                    `<query queryid="${iq_get.querySelector('query').getAttribute('queryid')}" xmlns="urn:xmpp:mam:2">`+
                        `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE"><value>urn:xmpp:mam:2</value></field>`+
                            `<field var="start"><value>2021-06-15T11:17:15.424Z</value></field>`+
                        `</x>`+
                        `<set xmlns="http://jabber.org/protocol/rsm"><before>${view.model.messages.at(2).get(`stanza_id ${muc_jid}`)}</before>`+
                        `<max>2</max>`+
                    `</set>`+
                    `</query>`+
                `</iq>`);

            message = u.toStanza(
                `<message xmlns="jabber:client"
                        to="romeo@montague.lit/orchard"
                        from="${muc_jid}">
                    <result xmlns="urn:xmpp:mam:2" queryid="${iq_get.querySelector('query').getAttribute('queryid')}" id="${first_msg_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2021-06-15T11:18:20Z"/>
                            <message from="${muc_jid}/some1" type="groupchat">
                                <body>1st MAM Message</body>
                            </message>
                        </forwarded>
                    </result>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(message));

            // Clear so that we don't match the older query
            while (sent_IQs.length) { sent_IQs.pop(); }

            result = u.toStanza(
                `<iq type='result' id='${iq_get.getAttribute('id')}'>
                    <fin xmlns='urn:xmpp:mam:2' complete='true'>
                        <set xmlns='http://jabber.org/protocol/rsm'>
                            <first index='0'>${first_msg_id}</first>
                            <last>${first_msg_id}</last>
                            <count>1</count>
                        </set>
                    </fin>
                </iq>`);
            _converse.connection._dataRecv(mock.createRequest(result));
            await u.waitUntil(() => view.model.messages.length === 4);
            await u.waitUntil(() => view.querySelector('converse-mam-placeholder') === null);
        }));

        it("is not created when there isn't a gap because the cached history is empty",
                mock.initConverse(['discoInitialized'], {'archived_messages_page_size': 2},
                async function (_converse) {

            const sent_IQs = _converse.connection.IQ_stanzas;
            const muc_jid = 'orchard@chat.shakespeare.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
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
                                <body>2nd Message</body>
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
                                <body>3rd Message</body>
                            </message>
                        </forwarded>
                    </result>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(message));

            // Clear so that we don't match the older query
            while (sent_IQs.length) { sent_IQs.pop(); }

            const result = u.toStanza(
                `<iq type='result' id='${iq_get.getAttribute('id')}'>
                    <fin xmlns='urn:xmpp:mam:2'>
                        <set xmlns='http://jabber.org/protocol/rsm'>
                            <first index='0'>${first_msg_id}</first>
                            <last>${last_msg_id}</last>
                            <count>3</count>
                        </set>
                    </fin>
                </iq>`);
            _converse.connection._dataRecv(mock.createRequest(result));
            await u.waitUntil(() => view.model.messages.length === 2);
            expect(true).toBe(true);
        }));
    });
});
