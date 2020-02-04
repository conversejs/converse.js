(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const Model = converse.env.Model;
    const Strophe = converse.env.Strophe;
    const $iq = converse.env.$iq;
    const $msg = converse.env.$msg;
    const dayjs = converse.env.dayjs;
    const u = converse.env.utils;
    const sizzle = converse.env.sizzle;
    // See: https://xmpp.org/rfcs/rfc3921.html

    // Implements the protocol defined in https://xmpp.org/extensions/xep-0313.html#config
    describe("Message Archive Management", function () {

        describe("The XEP-0313 Archive", function () {

            it("is queried when the user enters a new MUC",
                    mock.initConverse(['discoInitialized'], {'archived_messages_page_size': 2}, async function (done, _converse) {

                const sent_IQs = _converse.connection.IQ_stanzas;
                const muc_jid = 'orchard@chat.shakespeare.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
                let view = _converse.chatboxviews.get(muc_jid);
                let iq_get = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq query[xmlns="${Strophe.NS.MAM}"]`)).pop());
                expect(Strophe.serialize(iq_get)).toBe(
                    `<iq id="${iq_get.getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">`+
                        `<query queryid="${iq_get.querySelector('query').getAttribute('queryid')}" xmlns="${Strophe.NS.MAM}">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                                `<field type="hidden" var="FORM_TYPE"><value>urn:xmpp:mam:2</value></field>`+
                            `</x>`+
                            `<set xmlns="http://jabber.org/protocol/rsm"><max>2</max><before></before></set>`+
                        `</query>`+
                    `</iq>`);

                let first_msg_id = _converse.connection.getUniqueId();
                let last_msg_id = _converse.connection.getUniqueId();
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
                _converse.connection._dataRecv(test_utils.createRequest(message));

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
                _converse.connection._dataRecv(test_utils.createRequest(message));

                // Clear so that we don't match the older query
                while (sent_IQs.length) { sent_IQs.pop(); }

                // XXX: Even though the count is 3, when fetching messages for
                // the first time, we don't paginate, so that message
                // is not fetched. The user needs to manually load older
                // messages for it to be fetched.
                // TODO: we need to add a clickable link to load older messages
                let result = u.toStanza(
                    `<iq type='result' id='${iq_get.getAttribute('id')}'>
                        <fin xmlns='urn:xmpp:mam:2'>
                            <set xmlns='http://jabber.org/protocol/rsm'>
                                <first index='0'>${first_msg_id}</first>
                                <last>${last_msg_id}</last>
                                <count>3</count>
                            </set>
                        </fin>
                    </iq>`);
                _converse.connection._dataRecv(test_utils.createRequest(result));
                await u.waitUntil(() => view.model.messages.length === 2);
                view.close();
                // Clear so that we don't match the older query
                while (sent_IQs.length) { sent_IQs.pop(); }

                await u.waitUntil(() => _converse.chatboxes.length === 1);

                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
                view = _converse.chatboxviews.get(muc_jid);
                await u.waitUntil(() => view.model.messages.length);

                iq_get = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq query[xmlns="${Strophe.NS.MAM}"]`)).pop());
                expect(Strophe.serialize(iq_get)).toBe(
                    `<iq id="${iq_get.getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">`+
                        `<query queryid="${iq_get.querySelector('query').getAttribute('queryid')}" xmlns="${Strophe.NS.MAM}">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                                `<field type="hidden" var="FORM_TYPE"><value>urn:xmpp:mam:2</value></field>`+
                            `</x>`+
                            `<set xmlns="http://jabber.org/protocol/rsm"><max>2</max><after>${message.querySelector('result').getAttribute('id')}</after></set>`+
                        `</query>`+
                    `</iq>`);

                first_msg_id = _converse.connection.getUniqueId();
                last_msg_id = _converse.connection.getUniqueId();
                message = u.toStanza(
                    `<message xmlns="jabber:client"
                            to="romeo@montague.lit/orchard"
                            from="${muc_jid}">
                        <result xmlns="urn:xmpp:mam:2" queryid="${iq_get.querySelector('query').getAttribute('queryid')}" id="${first_msg_id}">
                            <forwarded xmlns="urn:xmpp:forward:0">
                                <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:17:23Z"/>
                                <message from="${muc_jid}/some1" type="groupchat">
                                    <body>4th Message</body>
                                </message>
                            </forwarded>
                        </result>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(message));

                message = u.toStanza(
                    `<message xmlns="jabber:client"
                            to="romeo@montague.lit/orchard"
                            from="${muc_jid}">
                        <result xmlns="urn:xmpp:mam:2" queryid="${iq_get.querySelector('query').getAttribute('queryid')}" id="${last_msg_id}">
                            <forwarded xmlns="urn:xmpp:forward:0">
                                <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:18:23Z"/>
                                <message from="${muc_jid}/some1" type="groupchat">
                                    <body>5th Message</body>
                                </message>
                            </forwarded>
                        </result>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(message));

                // Clear so that we don't match the older query
                while (sent_IQs.length) { sent_IQs.pop(); }

                result = u.toStanza(
                    `<iq type='result' id='${iq_get.getAttribute('id')}'>
                        <fin xmlns='urn:xmpp:mam:2'>
                            <set xmlns='http://jabber.org/protocol/rsm'>
                                <first index='0'>${first_msg_id}</first>
                                <last>${last_msg_id}</last>
                                <count>5</count>
                            </set>
                        </fin>
                    </iq>`);
                _converse.connection._dataRecv(test_utils.createRequest(result));
                await u.waitUntil(() => view.model.messages.length === 4);

                iq_get = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq query[xmlns="${Strophe.NS.MAM}"]`)).pop());
                expect(Strophe.serialize(iq_get)).toBe(
                    `<iq id="${iq_get.getAttribute('id')}" to="orchard@chat.shakespeare.lit" type="set" xmlns="jabber:client">`+
                        `<query queryid="${iq_get.querySelector('query').getAttribute('queryid')}" xmlns="urn:xmpp:mam:2">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                                `<field type="hidden" var="FORM_TYPE"><value>urn:xmpp:mam:2</value></field>`+
                            `</x>`+
                            `<set xmlns="http://jabber.org/protocol/rsm">`+
                                `<max>2</max><after>${last_msg_id}</after>`+
                            `</set>`+
                        `</query>`+
                    `</iq>`);

                const msg_id = _converse.connection.getUniqueId();
                message = u.toStanza(
                    `<message xmlns="jabber:client"
                            to="romeo@montague.lit/orchard"
                            from="${muc_jid}">
                        <result xmlns="urn:xmpp:mam:2" queryid="${iq_get.querySelector('query').getAttribute('queryid')}" id="${msg_id}">
                            <forwarded xmlns="urn:xmpp:forward:0">
                                <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:19:23Z"/>
                                <message from="${muc_jid}/some1" type="groupchat">
                                    <body>6th Message</body>
                                </message>
                            </forwarded>
                        </result>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(message));

                result = u.toStanza(
                    `<iq type='result' id='${iq_get.getAttribute('id')}'>
                        <fin xmlns="urn:xmpp:mam:2" complete="true">
                            <set xmlns="http://jabber.org/protocol/rsm">
                                <first index="0">${msg_id}</first>
                                <last>${msg_id}</last>
                                <count>6</count>
                            </set>
                        </fin>
                    </iq>`);
                _converse.connection._dataRecv(test_utils.createRequest(result));
                await u.waitUntil(() => view.model.messages.length === 5);
                const msg_els = view.content.querySelectorAll('.chat-msg__text');
                expect(Array.from(msg_els).map(e => e.textContent).join(' ')).toBe("2nd Message 3rd Message 4th Message 5th Message 6th Message");
                done();
            }));
        });

        describe("An archived message", function () {

            describe("when received", function () {

                it("is discarded if it doesn't come from the right sender",
                    mock.initConverse(
                        ['discoInitialized'], {},
                        async function (done, _converse) {

                    await test_utils.waitForRoster(_converse, 'current', 1);
                    const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    await test_utils.openChatBoxFor(_converse, contact_jid);
                    await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                    const sent_IQs = _converse.connection.IQ_stanzas;
                    const stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[type="set"] query[xmlns="${Strophe.NS.MAM}"]`)).pop());
                    const queryid = stanza.querySelector('query').getAttribute('queryid');
                    let msg = $msg({'id': _converse.connection.getUniqueId(), 'from': 'impersonator@capulet.lit', 'to': _converse.bare_jid})
                                .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id': _converse.connection.getUniqueId()})
                                    .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                        .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                        .c('message', {
                                            'xmlns':'jabber:client',
                                            'to': _converse.bare_jid,
                                            'id': _converse.connection.getUniqueId(),
                                            'from': contact_jid,
                                            'type':'chat'
                                        }).c('body').t("Meet me at the dance");
                    spyOn(converse.env.log, 'warn');
                    _converse.connection._dataRecv(test_utils.createRequest(msg));
                    expect(converse.env.log.warn).toHaveBeenCalledWith(`Ignoring alleged MAM message from ${msg.nodeTree.getAttribute('from')}`);

                    msg = $msg({'id': _converse.connection.getUniqueId(), 'to': _converse.bare_jid})
                                .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id': _converse.connection.getUniqueId()})
                                    .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                        .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                        .c('message', {
                                            'xmlns':'jabber:client',
                                            'to': _converse.bare_jid,
                                            'id': _converse.connection.getUniqueId(),
                                            'from': contact_jid,
                                            'type':'chat'
                                        }).c('body').t("Thrice the brinded cat hath mew'd.");
                    _converse.connection._dataRecv(test_utils.createRequest(msg));

                    const iq_result = $iq({'type': 'result', 'id': stanza.getAttribute('id')})
                        .c('fin', {'xmlns': 'urn:xmpp:mam:2'})
                            .c('set',  {'xmlns': 'http://jabber.org/protocol/rsm'})
                                .c('first', {'index': '0'}).t('23452-4534-1').up()
                                .c('last').t('09af3-cc343-b409f').up()
                                .c('count').t('16');
                    _converse.connection._dataRecv(test_utils.createRequest(iq_result));

                    const view = _converse.chatboxviews.get(contact_jid);
                    await new Promise(resolve => view.model.messages.once('rendered', resolve));
                    expect(view.model.messages.length).toBe(1);
                    expect(view.model.messages.at(0).get('message')).toBe("Thrice the brinded cat hath mew'd.");
                    done();
                }));


                it("updates the is_archived value of an already cached version",
                    mock.initConverse(
                        ['discoInitialized'], {},
                        async function (done, _converse) {

                    await test_utils.openAndEnterChatRoom(_converse, 'trek-radio@conference.lightwitch.org', 'romeo');

                    const view = _converse.chatboxviews.get('trek-radio@conference.lightwitch.org');
                    let stanza = u.toStanza(
                        `<message xmlns="jabber:client" to="romeo@montague.lit/orchard" type="groupchat" from="trek-radio@conference.lightwitch.org/some1">
                            <body>Hello</body>
                            <stanza-id xmlns="urn:xmpp:sid:0" id="45fbbf2a-1059-479d-9283-c8effaf05621" by="trek-radio@conference.lightwitch.org"/>
                        </message>`);
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));
                    await u.waitUntil(() => view.content.querySelectorAll('.chat-msg').length);
                    expect(view.model.messages.length).toBe(1);
                    expect(view.model.messages.at(0).get('is_archived')).toBe(false);
                    expect(view.model.messages.at(0).get('stanza_id trek-radio@conference.lightwitch.org')).toBe('45fbbf2a-1059-479d-9283-c8effaf05621');

                    stanza = u.toStanza(
                        `<message xmlns="jabber:client"
                                to="romeo@montague.lit/orchard"
                                from="trek-radio@conference.lightwitch.org">
                            <result xmlns="urn:xmpp:mam:2" queryid="82d9db27-6cf8-4787-8c2c-5a560263d823" id="45fbbf2a-1059-479d-9283-c8effaf05621">
                                <forwarded xmlns="urn:xmpp:forward:0">
                                    <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:17:23Z"/>
                                    <message from="trek-radio@conference.lightwitch.org/some1" type="groupchat">
                                        <body>Hello</body>
                                    </message>
                                </forwarded>
                            </result>
                        </message>`);
                    spyOn(view.model, 'getDuplicateMessage').and.callThrough();
                    spyOn(view.model, 'updateMessage').and.callThrough();
                    view.model.onMessage(stanza);
                    await u.waitUntil(() => view.model.getDuplicateMessage.calls.count());
                    expect(view.model.getDuplicateMessage.calls.count()).toBe(1);
                    const result = view.model.getDuplicateMessage.calls.all()[0].returnValue
                    expect(result instanceof _converse.Message).toBe(true);
                    expect(view.content.querySelectorAll('.chat-msg').length).toBe(1);

                    await u.waitUntil(() => view.model.updateMessage.calls.count());
                    expect(view.model.messages.length).toBe(1);
                    expect(view.model.messages.at(0).get('is_archived')).toBe(true);
                    expect(view.model.messages.at(0).get('stanza_id trek-radio@conference.lightwitch.org')).toBe('45fbbf2a-1059-479d-9283-c8effaf05621');
                    done();
                }));

                it("isn't shown as duplicate by comparing its stanza id or archive id",
                    mock.initConverse(
                        ['discoInitialized'], {},
                        async function (done, _converse) {

                    await test_utils.openAndEnterChatRoom(_converse, 'trek-radio@conference.lightwitch.org', 'jcbrand');
                    const view = _converse.chatboxviews.get('trek-radio@conference.lightwitch.org');
                    let stanza = u.toStanza(
                        `<message xmlns="jabber:client" to="jcbrand@lightwitch.org/converse.js-73057452" type="groupchat" from="trek-radio@conference.lightwitch.org/comndrdukath#0805 (STO)">
                            <body>negan</body>
                            <stanza-id xmlns="urn:xmpp:sid:0" id="45fbbf2a-1059-479d-9283-c8effaf05621" by="trek-radio@conference.lightwitch.org"/>
                        </message>`);
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));
                    await u.waitUntil(() => view.content.querySelectorAll('.chat-msg').length);
                    // Not sure whether such a race-condition might pose a problem
                    // in "real-world" situations.
                    stanza = u.toStanza(
                        `<message xmlns="jabber:client"
                                to="jcbrand@lightwitch.org/converse.js-73057452"
                                from="trek-radio@conference.lightwitch.org">
                            <result xmlns="urn:xmpp:mam:2" queryid="82d9db27-6cf8-4787-8c2c-5a560263d823" id="45fbbf2a-1059-479d-9283-c8effaf05621">
                                <forwarded xmlns="urn:xmpp:forward:0">
                                    <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:17:23Z"/>
                                    <message from="trek-radio@conference.lightwitch.org/comndrdukath#0805 (STO)" type="groupchat">
                                        <body>negan</body>
                                    </message>
                                </forwarded>
                            </result>
                        </message>`);
                    spyOn(view.model, 'getDuplicateMessage').and.callThrough();
                    view.model.onMessage(stanza);
                    await u.waitUntil(() => view.model.getDuplicateMessage.calls.count());
                    expect(view.model.getDuplicateMessage.calls.count()).toBe(1);
                    const result = await view.model.getDuplicateMessage.calls.all()[0].returnValue
                    expect(result instanceof _converse.Message).toBe(true);
                    expect(view.content.querySelectorAll('.chat-msg').length).toBe(1);
                    done();
                }));

                it("isn't shown as duplicate by comparing only the archive id",
                    mock.initConverse(
                        ['discoInitialized'], {},
                        async function (done, _converse) {

                    await test_utils.openAndEnterChatRoom(_converse, 'discuss@conference.conversejs.org', 'romeo');
                    const view = _converse.chatboxviews.get('discuss@conference.conversejs.org');
                    let stanza = u.toStanza(
                        `<message xmlns="jabber:client" to="romeo@montague.lit/orchard" from="discuss@conference.conversejs.org">
                            <result xmlns="urn:xmpp:mam:2" queryid="06fea9ca-97c9-48c4-8583-009ff54ea2e8" id="7a9fde91-4387-4bf8-b5d3-978dab8f6bf3">
                                <forwarded xmlns="urn:xmpp:forward:0">
                                    <delay xmlns="urn:xmpp:delay" stamp="2018-12-05T04:53:12Z"/>
                                    <message xmlns="jabber:client" to="discuss@conference.conversejs.org" type="groupchat" xml:lang="en" from="discuss@conference.conversejs.org/prezel">
                                        <body>looks like omemo fails completely with "bundle is undefined" when there is a device in the devicelist that has no keys published</body>
                                        <x xmlns="http://jabber.org/protocol/muc#user">
                                            <item affiliation="none" jid="prezel@blubber.im" role="participant"/>
                                        </x>
                                    </message>
                                </forwarded>
                            </result>
                        </message>`);
                    view.model.onMessage(stanza);
                    await u.waitUntil(() => view.content.querySelectorAll('.chat-msg').length);
                    expect(view.content.querySelectorAll('.chat-msg').length).toBe(1);

                    stanza = u.toStanza(
                        `<message xmlns="jabber:client" to="romeo@montague.lit/orchard" from="discuss@conference.conversejs.org">
                            <result xmlns="urn:xmpp:mam:2" queryid="06fea9ca-97c9-48c4-8583-009ff54ea2e8" id="7a9fde91-4387-4bf8-b5d3-978dab8f6bf3">
                                <forwarded xmlns="urn:xmpp:forward:0">
                                    <delay xmlns="urn:xmpp:delay" stamp="2018-12-05T04:53:12Z"/>
                                    <message xmlns="jabber:client" to="discuss@conference.conversejs.org" type="groupchat" xml:lang="en" from="discuss@conference.conversejs.org/prezel">
                                        <body>looks like omemo fails completely with "bundle is undefined" when there is a device in the devicelist that has no keys published</body>
                                        <x xmlns="http://jabber.org/protocol/muc#user">
                                            <item affiliation="none" jid="prezel@blubber.im" role="participant"/>
                                        </x>
                                    </message>
                                </forwarded>
                            </result>
                        </message>`);

                    spyOn(view.model, 'getDuplicateMessage').and.callThrough();
                    view.model.onMessage(stanza);
                    await u.waitUntil(() => view.model.getDuplicateMessage.calls.count());
                    expect(view.model.getDuplicateMessage.calls.count()).toBe(1);
                    const result = await view.model.getDuplicateMessage.calls.all()[0].returnValue
                    expect(result instanceof _converse.Message).toBe(true);
                    expect(view.content.querySelectorAll('.chat-msg').length).toBe(1);
                    done();
                }))
            });
        });

        describe("The archive.query API", function () {

           it("can be used to query for all archived messages",
                    mock.initConverse(['discoInitialized'], {}, async function (done, _converse) {

                const sendIQ = _converse.connection.sendIQ;
                await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                let sent_stanza, IQ_id;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                _converse.api.archive.query();
                await u.waitUntil(() => sent_stanza);
                const queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                expect(sent_stanza.toString()).toBe(
                    `<iq id="${IQ_id}" type="set" xmlns="jabber:client"><query queryid="${queryid}" xmlns="urn:xmpp:mam:2"/></iq>`);
                done();
            }));

           it("can be used to query for all messages to/from a particular JID",
                    mock.initConverse([], {}, async function (done, _converse) {

                await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                _converse.api.archive.query({'with':'juliet@capulet.lit'});
                await u.waitUntil(() => sent_stanza);
                const queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                expect(sent_stanza.toString()).toBe(
                    `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                        `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE">`+
                                `<value>urn:xmpp:mam:2</value>`+
                            `</field>`+
                            `<field var="with">`+
                                `<value>juliet@capulet.lit</value>`+
                            `</field>`+
                            `</x>`+
                        `</query>`+
                    `</iq>`);
                done();
            }));

           it("can be used to query for archived messages from a chat room",
                    mock.initConverse([], {}, async function (done, _converse) {

                const room_jid = 'coven@chat.shakespeare.lit';
                _converse.api.archive.query({'with': room_jid, 'groupchat': true});
                await test_utils.waitUntilDiscoConfirmed(_converse, room_jid, null, [Strophe.NS.MAM]);

                const sent_stanzas = _converse.connection.sent_stanzas;
                const stanza = await u.waitUntil(
                    () => sent_stanzas.filter(s => sizzle(`[xmlns="${Strophe.NS.MAM}"]`, s).length).pop());

                const queryid = stanza.querySelector('query').getAttribute('queryid');
                expect(Strophe.serialize(stanza)).toBe(
                    `<iq id="${stanza.getAttribute('id')}" to="coven@chat.shakespeare.lit" type="set" xmlns="jabber:client">`+
                        `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                                `<field type="hidden" var="FORM_TYPE">`+
                                    `<value>urn:xmpp:mam:2</value>`+
                                `</field>`+
                            `</x>`+
                        `</query>`+
                    `</iq>`);
                done();
           }));

            it("checks whether returned MAM messages from a MUC room are from the right JID",
                    mock.initConverse([], {}, async function (done, _converse) {

                const room_jid = 'coven@chat.shakespeare.lit';
                const promise = _converse.api.archive.query({'with': room_jid, 'groupchat': true, 'max':'10'});

                await test_utils.waitUntilDiscoConfirmed(_converse, room_jid, null, [Strophe.NS.MAM]);

                const sent_stanzas = _converse.connection.sent_stanzas;
                const sent_stanza = await u.waitUntil(
                    () => sent_stanzas.filter(s => sizzle(`[xmlns="${Strophe.NS.MAM}"]`, s).length).pop());
                const queryid = sent_stanza.querySelector('query').getAttribute('queryid');

                /* <message id='iasd207' from='coven@chat.shakespeare.lit' to='hag66@shakespeare.lit/pda'>
                 *     <result xmlns='urn:xmpp:mam:2' queryid='g27' id='34482-21985-73620'>
                 *         <forwarded xmlns='urn:xmpp:forward:0'>
                 *         <delay xmlns='urn:xmpp:delay' stamp='2002-10-13T23:58:37Z'/>
                 *         <message xmlns="jabber:client"
                 *             from='coven@chat.shakespeare.lit/firstwitch'
                 *             id='162BEBB1-F6DB-4D9A-9BD8-CFDCC801A0B2'
                 *             type='groupchat'>
                 *             <body>Thrice the brinded cat hath mew'd.</body>
                 *             <x xmlns='http://jabber.org/protocol/muc#user'>
                 *             <item affiliation='none'
                 *                     jid='witch1@shakespeare.lit'
                 *                     role='participant' />
                 *             </x>
                 *         </message>
                 *         </forwarded>
                 *     </result>
                 * </message>
                 */
                const msg1 = $msg({'id':'iasd207', 'from': 'other@chat.shakespear.lit', 'to': 'romeo@montague.lit'})
                            .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id':'34482-21985-73620'})
                                .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                    .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                    .c('message', {
                                        'xmlns':'jabber:client',
                                        'to':'romeo@montague.lit',
                                        'id':'162BEBB1-F6DB-4D9A-9BD8-CFDCC801A0B2',
                                        'from':'coven@chat.shakespeare.lit/firstwitch',
                                        'type':'groupchat' })
                                    .c('body').t("Thrice the brinded cat hath mew'd.");
                _converse.connection._dataRecv(test_utils.createRequest(msg1));

                /* Send an <iq> stanza to indicate the end of the result set.
                 *
                 * <iq type='result' id='juliet1'>
                 *     <fin xmlns='urn:xmpp:mam:2'>
                 *     <set xmlns='http://jabber.org/protocol/rsm'>
                 *         <first index='0'>28482-98726-73623</first>
                 *         <last>09af3-cc343-b409f</last>
                 *         <count>20</count>
                 *     </set>
                 * </iq>
                 */
                const stanza = $iq({'type': 'result', 'id': sent_stanza.getAttribute('id')})
                    .c('fin', {'xmlns': 'urn:xmpp:mam:2'})
                        .c('set',  {'xmlns': 'http://jabber.org/protocol/rsm'})
                            .c('first', {'index': '0'}).t('23452-4534-1').up()
                            .c('last').t('09af3-cc343-b409f').up()
                            .c('count').t('16');
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                const result = await promise;
                expect(result.messages.length).toBe(0);
                done();
           }));

           it("can be used to query for all messages in a certain timespan",
                    mock.initConverse([], {}, async function (done, _converse) {

                await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                const start = '2010-06-07T00:00:00Z';
                const end = '2010-07-07T13:23:54Z';
                _converse.api.archive.query({
                    'start': start,
                    'end': end
                });
                await u.waitUntil(() => sent_stanza);
                const queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                expect(sent_stanza.toString()).toBe(
                    `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                        `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE">`+
                                `<value>urn:xmpp:mam:2</value>`+
                            `</field>`+
                            `<field var="start">`+
                                `<value>${dayjs(start).toISOString()}</value>`+
                            `</field>`+
                            `<field var="end">`+
                                `<value>${dayjs(end).toISOString()}</value>`+
                            `</field>`+
                            `</x>`+
                        `</query>`+
                    `</iq>`
                );
                done();
           }));

           it("throws a TypeError if an invalid date is provided",
                    mock.initConverse([], {}, async function (done, _converse) {

                await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                try {
                    await _converse.api.archive.query({'start': 'not a real date'});
                } catch (e) {
                    expect(() => {throw e}).toThrow(new TypeError('archive.query: invalid date provided for: start'));
                }
                done();
           }));

           it("can be used to query for all messages after a certain time",
                    mock.initConverse([], {}, async function (done, _converse) {

                await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                if (!_converse.disco_entities.get(_converse.domain).features.findWhere({'var': Strophe.NS.MAM})) {
                    _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                }
                const start = '2010-06-07T00:00:00Z';
                _converse.api.archive.query({'start': start});
                await u.waitUntil(() => sent_stanza);
                const queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                expect(sent_stanza.toString()).toBe(
                    `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                        `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE">`+
                                `<value>urn:xmpp:mam:2</value>`+
                            `</field>`+
                            `<field var="start">`+
                                `<value>${dayjs(start).toISOString()}</value>`+
                            `</field>`+
                            `</x>`+
                        `</query>`+
                    `</iq>`
                );
                done();
           }));

           it("can be used to query for a limited set of results",
                    mock.initConverse([], {}, async function (done, _converse) {

                await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                const start = '2010-06-07T00:00:00Z';
                _converse.api.archive.query({'start': start, 'max':10});
                await u.waitUntil(() => sent_stanza);
                const queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                expect(sent_stanza.toString()).toBe(
                    `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                        `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                                `<field type="hidden" var="FORM_TYPE">`+
                                    `<value>urn:xmpp:mam:2</value>`+
                                `</field>`+
                                `<field var="start">`+
                                    `<value>${dayjs(start).toISOString()}</value>`+
                                `</field>`+
                            `</x>`+
                            `<set xmlns="http://jabber.org/protocol/rsm">`+
                                `<max>10</max>`+
                            `</set>`+
                        `</query>`+
                    `</iq>`
                );
                done();
           }));

           it("can be used to page through results",
                    mock.initConverse([], {}, async function (done, _converse) {

                await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                const start = '2010-06-07T00:00:00Z';
                _converse.api.archive.query({
                    'start': start,
                    'after': '09af3-cc343-b409f',
                    'max':10
                });
                await u.waitUntil(() => sent_stanza);
                const queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                expect(sent_stanza.toString()).toBe(
                    `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                        `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                                `<field type="hidden" var="FORM_TYPE">`+
                                    `<value>urn:xmpp:mam:2</value>`+
                                `</field>`+
                                `<field var="start">`+
                                    `<value>${dayjs(start).toISOString()}</value>`+
                                `</field>`+
                            `</x>`+
                            `<set xmlns="http://jabber.org/protocol/rsm">`+
                                `<max>10</max>`+
                                `<after>09af3-cc343-b409f</after>`+
                            `</set>`+
                        `</query>`+
                    `</iq>`);
                done();
           }));

           it("accepts \"before\" with an empty string as value to reverse the order",
                    mock.initConverse([], {}, async function (done, _converse) {

                await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                _converse.api.archive.query({'before': '', 'max':10});
                await u.waitUntil(() => sent_stanza);
                const queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                expect(sent_stanza.toString()).toBe(
                    `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                        `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                                `<field type="hidden" var="FORM_TYPE">`+
                                    `<value>urn:xmpp:mam:2</value>`+
                                `</field>`+
                            `</x>`+
                            `<set xmlns="http://jabber.org/protocol/rsm">`+
                                `<max>10</max>`+
                                `<before></before>`+
                            `</set>`+
                        `</query>`+
                    `</iq>`);
                done();
           }));

           it("accepts a _converse.RSM object for the query options",
                    mock.initConverse([], {}, async function (done, _converse) {

                await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                // Normally the user wouldn't manually make a _converse.RSM object
                // and pass it in. However, in the callback method an RSM object is
                // returned which can be reused for easy paging. This test is
                // more for that usecase.
                const rsm =  new _converse.RSM({'max': '10'});
                rsm['with'] = 'romeo@montague.lit'; // eslint-disable-line dot-notation
                rsm.start = '2010-06-07T00:00:00Z';
                _converse.api.archive.query(rsm);
                await u.waitUntil(() => sent_stanza);
                const queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                expect(sent_stanza.toString()).toBe(
                    `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                        `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                                `<field type="hidden" var="FORM_TYPE">`+
                                    `<value>urn:xmpp:mam:2</value>`+
                                `</field>`+
                                `<field var="with">`+
                                    `<value>romeo@montague.lit</value>`+
                                `</field>`+
                                `<field var="start">`+
                                    `<value>${dayjs(rsm.start).toISOString()}</value>`+
                                `</field>`+
                            `</x>`+
                            `<set xmlns="http://jabber.org/protocol/rsm">`+
                                `<max>10</max>`+
                            `</set>`+
                        `</query>`+
                    `</iq>`);
                done();
           }));

           it("returns an object which includes the messages and a _converse.RSM object",
                    mock.initConverse([], {}, async function (done, _converse) {

                await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                const promise = _converse.api.archive.query({'with': 'romeo@capulet.lit', 'max':'10'});
                await u.waitUntil(() => sent_stanza);
                const queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');

                /*  <message id='aeb213' to='juliet@capulet.lit/chamber'>
                 *  <result xmlns='urn:xmpp:mam:2' queryid='f27' id='28482-98726-73623'>
                 *      <forwarded xmlns='urn:xmpp:forward:0'>
                 *      <delay xmlns='urn:xmpp:delay' stamp='2010-07-10T23:08:25Z'/>
                 *      <message xmlns='jabber:client'
                 *          to='juliet@capulet.lit/balcony'
                 *          from='romeo@montague.lit/orchard'
                 *          type='chat'>
                 *          <body>Call me but love, and I'll be new baptized; Henceforth I never will be Romeo.</body>
                 *      </message>
                 *      </forwarded>
                 *  </result>
                 *  </message>
                 */
                const msg1 = $msg({'id':'aeb212', 'to':'juliet@capulet.lit/chamber'})
                            .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id':'28482-98726-73623'})
                                .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                    .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                    .c('message', {
                                        'xmlns':'jabber:client',
                                        'to':'juliet@capulet.lit/balcony',
                                        'from':'romeo@montague.lit/orchard',
                                        'type':'chat' })
                                    .c('body').t("Call me but love, and I'll be new baptized;");
                _converse.connection._dataRecv(test_utils.createRequest(msg1));

                const msg2 = $msg({'id':'aeb213', 'to':'juliet@capulet.lit/chamber'})
                            .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id':'28482-98726-73624'})
                                .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                    .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                    .c('message', {
                                        'xmlns':'jabber:client',
                                        'to':'juliet@capulet.lit/balcony',
                                        'from':'romeo@montague.lit/orchard',
                                        'type':'chat' })
                                    .c('body').t("Henceforth I never will be Romeo.");
                _converse.connection._dataRecv(test_utils.createRequest(msg2));

                /* Send an <iq> stanza to indicate the end of the result set.
                 *
                 * <iq type='result' id='juliet1'>
                 *     <fin xmlns='urn:xmpp:mam:2'>
                 *     <set xmlns='http://jabber.org/protocol/rsm'>
                 *         <first index='0'>28482-98726-73623</first>
                 *         <last>09af3-cc343-b409f</last>
                 *         <count>20</count>
                 *     </set>
                 * </iq>
                 */
                const stanza = $iq({'type': 'result', 'id': IQ_id})
                    .c('fin', {'xmlns': 'urn:xmpp:mam:2'})
                        .c('set',  {'xmlns': 'http://jabber.org/protocol/rsm'})
                            .c('first', {'index': '0'}).t('23452-4534-1').up()
                            .c('last').t('09af3-cc343-b409f').up()
                            .c('count').t('16');
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                const result = await promise;
                expect(result.messages.length).toBe(2);
                expect(result.messages[0].outerHTML).toBe(msg1.nodeTree.outerHTML);
                expect(result.messages[1].outerHTML).toBe(msg2.nodeTree.outerHTML);
                expect(result.rsm['with']).toBe('romeo@capulet.lit'); // eslint-disable-line dot-notation
                expect(result.rsm.max).toBe('10');
                expect(result.rsm.count).toBe('16');
                expect(result.rsm.first).toBe('23452-4534-1');
                expect(result.rsm.last).toBe('09af3-cc343-b409f');
                done()
           }));
        });

        describe("The default preference", function () {

            it("is set once server support for MAM has been confirmed",
                    mock.initConverse([], {}, async function (done, _converse) {

                const entity = await _converse.api.disco.entities.get(_converse.domain);
                spyOn(_converse, 'onMAMPreferences').and.callThrough();
                _converse.message_archiving = 'never';

                const feature = new Model({
                    'var': Strophe.NS.MAM
                });
                spyOn(feature, 'save').and.callFake(feature.set); // Save will complain about a url not being set

                entity.onFeatureAdded(feature);

                const IQ_stanzas = _converse.connection.IQ_stanzas;
                let sent_stanza = await u.waitUntil(() => IQ_stanzas.filter(s => sizzle('iq[type="get"] prefs[xmlns="urn:xmpp:mam:2"]', s).length).pop());
                expect(Strophe.serialize(sent_stanza)).toBe(
                    `<iq id="${sent_stanza.getAttribute('id')}" type="get" xmlns="jabber:client">`+
                        `<prefs xmlns="urn:xmpp:mam:2"/>`+
                    `</iq>`);

                /* Example 20. Server responds with current preferences
                 *
                 * <iq type='result' id='juliet2'>
                 *   <prefs xmlns='urn:xmpp:mam:0' default='roster'>
                 *     <always/>
                 *     <never/>
                 *   </prefs>
                 * </iq>
                 */
                let stanza = $iq({'type': 'result', 'id': sent_stanza.getAttribute('id')})
                    .c('prefs', {'xmlns': Strophe.NS.MAM, 'default':'roster'})
                    .c('always').c('jid').t('romeo@montague.lit').up().up()
                    .c('never').c('jid').t('montague@montague.lit');
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                await u.waitUntil(() => _converse.onMAMPreferences.calls.count());
                expect(_converse.onMAMPreferences).toHaveBeenCalled();

                sent_stanza = await u.waitUntil(() => IQ_stanzas.filter(s => sizzle('iq[type="set"] prefs[xmlns="urn:xmpp:mam:2"]', s).length).pop());
                expect(Strophe.serialize(sent_stanza)).toBe(
                    `<iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                        `<prefs default="never" xmlns="urn:xmpp:mam:2">`+
                            `<always><jid>romeo@montague.lit</jid></always>`+
                            `<never><jid>montague@montague.lit</jid></never>`+
                        `</prefs>`+
                    `</iq>`
                );

                expect(feature.get('preference')).toBe(undefined);
                /* <iq type='result' id='juliet3'>
                 *   <prefs xmlns='urn:xmpp:mam:0' default='always'>
                 *       <always>
                 *          <jid>romeo@montague.lit</jid>
                 *       </always>
                 *       <never>
                 *          <jid>montague@montague.lit</jid>
                 *       </never>
                 *   </prefs>
                 * </iq>
                 */
                stanza = $iq({'type': 'result', 'id': sent_stanza.getAttribute('id')})
                    .c('prefs', {'xmlns': Strophe.NS.MAM, 'default':'always'})
                        .c('always').up()
                        .c('never');
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await u.waitUntil(() => feature.save.calls.count());
                expect(feature.save).toHaveBeenCalled();
                expect(feature.get('preferences')['default']).toBe('never'); // eslint-disable-line dot-notation
                done();
            }));
        });
    });

    describe("Chatboxes", function () {
        describe("A Chatbox", function () {

            it("will fetch archived messages once it's opened",
                    mock.initConverse(['discoInitialized'], {}, async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await test_utils.openChatBoxFor(_converse, contact_jid);
                await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);

                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                await u.waitUntil(() => sent_stanza);
                const stanza_el = sent_stanza.root().nodeTree;
                const queryid = stanza_el.querySelector('query').getAttribute('queryid');
                expect(sent_stanza.toString()).toBe(
                    `<iq id="${stanza_el.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                        `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                                `<field type="hidden" var="FORM_TYPE"><value>urn:xmpp:mam:2</value></field>`+
                                `<field var="with"><value>mercutio@montague.lit</value></field>`+
                            `</x>`+
                            `<set xmlns="http://jabber.org/protocol/rsm"><max>50</max><before></before></set>`+
                        `</query>`+
                    `</iq>`
                );
                const msg1 = $msg({'id':'aeb212', 'to': contact_jid})
                            .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id':'28482-98726-73623'})
                                .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                    .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                    .c('message', {
                                        'xmlns':'jabber:client',
                                        'to': contact_jid,
                                        'from': _converse.bare_jid,
                                        'type':'chat' })
                                    .c('body').t("Call me but love, and I'll be new baptized;");
                _converse.connection._dataRecv(test_utils.createRequest(msg1));
                const msg2 = $msg({'id':'aeb213', 'to': contact_jid})
                            .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id':'28482-98726-73624'})
                                .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                    .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                    .c('message', {
                                        'xmlns':'jabber:client',
                                        'to': contact_jid,
                                        'from': _converse.bare_jid,
                                        'type':'chat' })
                                    .c('body').t("Henceforth I never will be Romeo.");
                _converse.connection._dataRecv(test_utils.createRequest(msg2));
                const stanza = $iq({'type': 'result', 'id': IQ_id})
                    .c('fin', {'xmlns': 'urn:xmpp:mam:2'})
                        .c('set',  {'xmlns': 'http://jabber.org/protocol/rsm'})
                            .c('first', {'index': '0'}).t('23452-4534-1').up()
                            .c('last').t('09af3-cc343-b409f').up()
                            .c('count').t('16');
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                done();
            }));

            it("will show an error message if the MAM query times out",
                    mock.initConverse(['discoInitialized'], {}, async function (done, _converse) {

                const sendIQ = _converse.connection.sendIQ;

                let timeout_happened = false;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sendIQ.bind(this)(iq, callback, errback);
                    if (!timeout_happened) {
                        if (typeof(iq.tree) === "function") {
                            iq = iq.tree();
                        }
                        if (sizzle('query[xmlns="urn:xmpp:mam:2"]', iq).length) {
                            // We emulate a timeout event
                            callback(null);
                            timeout_happened = true;
                        }
                    }
                });
                await test_utils.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await test_utils.openChatBoxFor(_converse, contact_jid);
                await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);

                const IQ_stanzas = _converse.connection.IQ_stanzas;
                let sent_stanza = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle('query[xmlns="urn:xmpp:mam:2"]', iq).length).pop());
                let queryid = sent_stanza.querySelector('query').getAttribute('queryid');

                expect(Strophe.serialize(sent_stanza)).toBe(
                    `<iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                        `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                                `<field type="hidden" var="FORM_TYPE"><value>urn:xmpp:mam:2</value></field>`+
                                `<field var="with"><value>mercutio@montague.lit</value></field>`+
                            `</x>`+
                            `<set xmlns="http://jabber.org/protocol/rsm"><max>50</max><before></before></set>`+
                        `</query>`+
                    `</iq>`);

                const view = _converse.chatboxviews.get(contact_jid);
                expect(view.model.messages.length).toBe(1);
                expect(view.model.messages.at(0).get('is_ephemeral')).toBe(false);
                expect(view.model.messages.at(0).get('type')).toBe('error');
                expect(view.model.messages.at(0).get('message')).toBe('Timeout while trying to fetch archived messages.');

                let err_message = view.el.querySelector('.message.chat-error');
                err_message.querySelector('.retry').click();
                expect(err_message.querySelector('.spinner')).not.toBe(null);

                while (_converse.connection.IQ_stanzas.length) {
                    _converse.connection.IQ_stanzas.pop();
                }
                sent_stanza = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle('query[xmlns="urn:xmpp:mam:2"]', iq).length).pop());
                queryid = sent_stanza.querySelector('query').getAttribute('queryid');
                expect(Strophe.serialize(sent_stanza)).toBe(
                    `<iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                        `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                                `<field type="hidden" var="FORM_TYPE"><value>urn:xmpp:mam:2</value></field>`+
                                `<field var="with"><value>mercutio@montague.lit</value></field>`+
                            `</x>`+
                            `<set xmlns="http://jabber.org/protocol/rsm"><max>50</max><before></before></set>`+
                        `</query>`+
                    `</iq>`);

                const msg1 = $msg({'id':'aeb212', 'to': contact_jid})
                            .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid': queryid, 'id':'28482-98726-73623'})
                                .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                    .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                    .c('message', {
                                        'xmlns':'jabber:client',
                                        'to': contact_jid,
                                        'from': _converse.bare_jid,
                                        'type':'chat' })
                                    .c('body').t("Call me but love, and I'll be new baptized;");
                _converse.connection._dataRecv(test_utils.createRequest(msg1));

                const msg2 = $msg({'id':'aeb213', 'to': contact_jid})
                            .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid': queryid, 'id':'28482-98726-73624'})
                                .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                    .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:18:25Z'}).up()
                                    .c('message', {
                                        'xmlns':'jabber:client',
                                        'to': contact_jid,
                                        'from': _converse.bare_jid,
                                        'type':'chat' })
                                    .c('body').t("Henceforth I never will be Romeo.");
                _converse.connection._dataRecv(test_utils.createRequest(msg2));

                const stanza = $iq({'type': 'result', 'id': sent_stanza.getAttribute('id')})
                    .c('fin', {'xmlns': 'urn:xmpp:mam:2', 'complete': true})
                        .c('set',  {'xmlns': 'http://jabber.org/protocol/rsm'})
                            .c('first', {'index': '0'}).t('28482-98726-73623').up()
                            .c('last').t('28482-98726-73624').up()
                            .c('count').t('2');
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await u.waitUntil(() => view.model.messages.length === 2, 500);
                err_message = view.el.querySelector('.message.chat-error');
                expect(err_message).toBe(null);
                done();
            }));
        });
    });
}));
