/*global mock, converse */
const { Strophe, sizzle, u } = converse.env;

describe("Message Archive Management", function () {

    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    describe("A placeholder message", function () {

        it("is created to indicate a gap in the history",
            mock.initConverse(
                ['discoInitialized'],
                {
                    auto_fill_history_gaps: false,
                    archived_messages_page_size: 2,
                    persistent_store: 'localStorage',
                    mam_request_all_pages: false
                },
                async function (_converse) {

            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            const muc_jid = 'orchard@chat.shakespeare.lit';
            const msgid = u.getUniqueId();
            const conn = _converse.api.connection.get();

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

            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);

            let iq_get = await u.waitUntil(() => sent_IQs.filter((iq) => sizzle(`query[xmlns="${Strophe.NS.MAM}"]`, iq).length).pop());
            const first_msg_id = conn.getUniqueId();
            const second_msg_id = conn.getUniqueId();
            const third_msg_id = conn.getUniqueId();
            let message = stx`
                <message xmlns="jabber:client"
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
                </message>`;
            conn._dataRecv(mock.createRequest(message));

            message = stx`
                <message xmlns="jabber:client"
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
                </message>`;
            conn._dataRecv(mock.createRequest(message));

            // Clear so that we don't match the older query
            while (sent_IQs.length) { sent_IQs.pop(); }

            let result = stx`
                <iq type='result' id='${iq_get.getAttribute('id')}' xmlns="jabber:client">
                    <fin xmlns='urn:xmpp:mam:2'>
                        <set xmlns='http://jabber.org/protocol/rsm'>
                            <first index='0'>${second_msg_id}</first>
                            <last>${third_msg_id}</last>
                            <count>3</count>
                        </set>
                    </fin>
                </iq>`;
            conn._dataRecv(mock.createRequest(result));
            await u.waitUntil(() => view.model.messages.length === 5);

            expect(view.model.messages.at(0) instanceof _converse.MAMPlaceholderMessage).toBe(true);
            expect(view.model.messages.at(0).get('time')).toBe('2021-06-15T11:17:15.423Z');
            expect(view.model.messages.at(1).get('body')).toBe('existing cached message');
            expect(view.model.messages.at(2) instanceof _converse.MAMPlaceholderMessage).toBe(true);
            expect(view.model.messages.at(2).get('time')).toBe('2021-06-15T11:18:22.999Z');
            expect(view.model.messages.at(3).get('body')).toBe('2nd MAM Message');
            expect(view.model.messages.at(4).get('body')).toBe('3rd MAM Message');

            const placeholder_el = [...view.querySelectorAll('converse-mam-placeholder')].pop();
            placeholder_el.firstElementChild.click();

            await u.waitUntil(() => view.querySelector('converse-mam-placeholder .spinner-grow'));

            iq_get = await u.waitUntil(() => sent_IQs.filter((iq) => sizzle(`iq query[xmlns="${Strophe.NS.MAM}"]`, iq).length).pop());
            expect(iq_get).toEqualStanza(
                stx`<iq id="${iq_get.getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">
                    <query queryid="${iq_get.querySelector('query').getAttribute('queryid')}" xmlns="urn:xmpp:mam:2">
                        <x xmlns="jabber:x:data" type="submit">
                            <field type="hidden" var="FORM_TYPE"><value>urn:xmpp:mam:2</value></field>
                            <field var="start"><value>2021-06-15T11:17:15.424Z</value></field>
                        </x>
                        <set xmlns="http://jabber.org/protocol/rsm">
                            <before>${second_msg_id}</before>
                            <max>2</max>
                        </set>
                    </query>
                </iq>`);

            message = stx`
                <message xmlns="jabber:client"
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
                </message>`;
            conn._dataRecv(mock.createRequest(message));

            // Clear so that we don't match the older query
            while (sent_IQs.length) { sent_IQs.pop(); }

            result = stx`
                <iq type='result' id='${iq_get.getAttribute('id')}' xmlns="jabber:client">
                    <fin xmlns='urn:xmpp:mam:2' complete='true'>
                        <set xmlns='http://jabber.org/protocol/rsm'>
                            <first index='0'>${first_msg_id}</first>
                            <last>${first_msg_id}</last>
                            <count>1</count>
                        </set>
                    </fin>
                </iq>`;
            conn._dataRecv(mock.createRequest(result));
            await u.waitUntil(() => view.model.messages.length === 5);
            await u.waitUntil(() => view.querySelectorAll('converse-mam-placeholder').length === 1);
        }));

        it("is not created when the full RSM result set is returned",
                mock.initConverse(['discoInitialized'], {'archived_messages_page_size': 2},
                async function (_converse) {

            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            const muc_jid = 'orchard@chat.shakespeare.lit';
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            const iq_get = await u.waitUntil(() => sent_IQs.filter((iq) => sizzle(`query[xmlns="${Strophe.NS.MAM}"]`, iq).length).pop());

            const first_msg_id = _converse.api.connection.get().getUniqueId();
            const last_msg_id = _converse.api.connection.get().getUniqueId();
            let message = stx`
                <message xmlns="jabber:client"
                        to="romeo@montague.lit/orchard"
                        from="${muc_jid}">
                    <result xmlns="urn:xmpp:mam:2" queryid="${iq_get.querySelector('query').getAttribute('queryid')}" id="${first_msg_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:15:23Z"/>
                            <message from="${muc_jid}/some1" type="groupchat">
                                <body>First Message</body>
                            </message>
                        </forwarded>
                    </result>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(message));

            message = stx`
                <message xmlns="jabber:client"
                        to="romeo@montague.lit/orchard"
                        from="${muc_jid}">
                    <result xmlns="urn:xmpp:mam:2" queryid="${iq_get.querySelector('query').getAttribute('queryid')}" id="${last_msg_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:16:23Z"/>
                            <message from="${muc_jid}/some1" type="groupchat">
                                <body>Second Message</body>
                            </message>
                        </forwarded>
                    </result>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(message));

            // Clear so that we don't match the older query
            while (sent_IQs.length) { sent_IQs.pop(); }

            const result = stx`
                <iq type='result' id='${iq_get.getAttribute('id')}' xmlns="jabber:client">
                    <fin xmlns='urn:xmpp:mam:2' complete='true'>
                        <set xmlns='http://jabber.org/protocol/rsm'>
                            <first index='0'>${first_msg_id}</first>
                            <last>${last_msg_id}</last>
                        </set>
                    </fin>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(result));
            await u.waitUntil(() => view.model.messages.length === 2);
            expect(view.model.messages.pluck('id').join(',')).toBe(`${first_msg_id},${last_msg_id}`);
        }));
    });
});
