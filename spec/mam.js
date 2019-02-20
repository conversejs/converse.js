(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const _ = converse.env._;
    const Backbone = converse.env.Backbone;
    const Strophe = converse.env.Strophe;
    const $iq = converse.env.$iq;
    const $msg = converse.env.$msg;
    const moment = converse.env.moment;
    const u = converse.env.utils;
    // See: https://xmpp.org/rfcs/rfc3921.html

    describe("Message Archive Management", function () {
        // Implement the protocol defined in https://xmpp.org/extensions/xep-0313.html#config

        describe("Archived Messages", function () {

           it("aren't shown as duplicates by comparing their stanza id and archive id",
                mock.initConverse(
                    null, ['discoInitialized'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'trek-radio', 'conference.lightwitch.org', 'jcbrand');
                const view = _converse.chatboxviews.get('trek-radio@conference.lightwitch.org');
                let stanza = u.toStanza(
                    `<message xmlns="jabber:client" to="jcbrand@lightwitch.org/converse.js-73057452" type="groupchat" from="trek-radio@conference.lightwitch.org/comndrdukath#0805 (STO)">
                        <body>negan</body>
                        <stanza-id xmlns="urn:xmpp:sid:0" id="45fbbf2a-1059-479d-9283-c8effaf05621" by="trek-radio@conference.lightwitch.org"/>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await test_utils.waitUntil(() => view.content.querySelectorAll('.chat-msg').length);
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
                spyOn(view.model, 'hasDuplicateArchiveID').and.callThrough();
                view.model.onMessage(stanza);
                await test_utils.waitUntil(() => view.model.hasDuplicateArchiveID.calls.count());
                expect(view.model.hasDuplicateArchiveID.calls.count()).toBe(1);
                const result = await view.model.hasDuplicateArchiveID.calls.all()[0].returnValue
                expect(result).toBe(true);
                expect(view.content.querySelectorAll('.chat-msg').length).toBe(1);
                done();
            }));

           it("aren't shown as duplicates by comparing only their archive id",
                mock.initConverse(
                    null, ['discoInitialized'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'discuss', 'conference.conversejs.org', 'dummy');
                const view = _converse.chatboxviews.get('discuss@conference.conversejs.org');
                let stanza = u.toStanza(
                    `<message xmlns="jabber:client" to="dummy@localhost/resource" from="discuss@conference.conversejs.org">
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
                await test_utils.waitUntil(() => view.content.querySelectorAll('.chat-msg').length);
                expect(view.content.querySelectorAll('.chat-msg').length).toBe(1);

                stanza = u.toStanza(
                    `<message xmlns="jabber:client" to="dummy@localhost/resource" from="discuss@conference.conversejs.org">
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

                spyOn(view.model, 'hasDuplicateArchiveID').and.callThrough();
                view.model.onMessage(stanza);
                await test_utils.waitUntil(() => view.model.hasDuplicateArchiveID.calls.count());
                expect(view.model.hasDuplicateArchiveID.calls.count()).toBe(1);
                const result = await view.model.hasDuplicateArchiveID.calls.all()[0].returnValue
                expect(result).toBe(true);
                expect(view.content.querySelectorAll('.chat-msg').length).toBe(1);
                done();
            }))
        });

        describe("The archive.query API", function () {

           it("can be used to query for all archived messages",
                mock.initConverse(
                    null, ['discoInitialized'], {},
                    function (done, _converse) {

                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                if (!_converse.disco_entities.get(_converse.domain).features.findWhere({'var': Strophe.NS.MAM})) {
                    _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                }
                _converse.api.archive.query();
                const queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                expect(sent_stanza.toString()).toBe(
                    `<iq id="${IQ_id}" type="set" xmlns="jabber:client"><query queryid="${queryid}" xmlns="urn:xmpp:mam:2"/></iq>`);
                done();
            }));

           it("can be used to query for all messages to/from a particular JID",
                mock.initConverse(
                    null, [], {},
                    async function (done, _converse) {

                const entity = await _converse.api.disco.entities.get(_converse.domain);
                if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                    _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                }
                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                _converse.api.archive.query({'with':'juliet@capulet.lit'});
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
                mock.initConverse(
                    null, [], {},
                    async function (done, _converse) {

                const entity = await _converse.api.disco.entities.get(_converse.domain);
                if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                    _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                }

                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                const callback = jasmine.createSpy('callback');

                _converse.api.archive.query({'with': 'coven@chat.shakespeare.lit', 'groupchat': true}, callback);
                const queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');

                expect(sent_stanza.toString()).toBe(
                    `<iq id="${IQ_id}" to="coven@chat.shakespeare.lit" type="set" xmlns="jabber:client">`+
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
                mock.initConverse(
                    null, [], {},
                    async function (done, _converse) {

                const entity = await _converse.api.disco.entities.get(_converse.domain);
                if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                    _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                }
                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                const callback = jasmine.createSpy('callback');

                _converse.api.archive.query({'with': 'coven@chat.shakespear.lit', 'groupchat': true, 'max':'10'}, callback);
                const queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');

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
                const msg1 = $msg({'id':'iasd207', 'from': 'other@chat.shakespear.lit', 'to': 'dummy@localhost'})
                            .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id':'34482-21985-73620'})
                                .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                    .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                    .c('message', {
                                        'xmlns':'jabber:client',
                                        'to':'dummy@localhost',
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
                const stanza = $iq({'type': 'result', 'id': IQ_id})
                    .c('fin', {'xmlns': 'urn:xmpp:mam:2'})
                        .c('set',  {'xmlns': 'http://jabber.org/protocol/rsm'})
                            .c('first', {'index': '0'}).t('23452-4534-1').up()
                            .c('last').t('09af3-cc343-b409f').up()
                            .c('count').t('16');
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                await test_utils.waitUntil(() => callback.calls.count());
                expect(callback).toHaveBeenCalled();
                const args = callback.calls.argsFor(0);
                expect(args[0].length).toBe(0);
                done();
           }));

           it("can be used to query for all messages in a certain timespan",
                mock.initConverse(
                    null, [], {},
                    async function (done, _converse) {

                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                const entities = await _converse.api.disco.entities.get();
                if (!entities.get(_converse.domain).features.findWhere({'var': Strophe.NS.MAM})) {
                    _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                }
                const start = '2010-06-07T00:00:00Z';
                const end = '2010-07-07T13:23:54Z';
                _converse.api.archive.query({
                    'start': start,
                    'end': end

                });
                const queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                expect(sent_stanza.toString()).toBe(
                    `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                        `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE">`+
                                `<value>urn:xmpp:mam:2</value>`+
                            `</field>`+
                            `<field var="start">`+
                                `<value>${moment(start).format()}</value>`+
                            `</field>`+
                            `<field var="end">`+
                                `<value>${moment(end).format()}</value>`+
                            `</field>`+
                            `</x>`+
                        `</query>`+
                    `</iq>`
                );
                done();
           }));

           it("throws a TypeError if an invalid date is provided",
                mock.initConverse(
                    null, [], {},
                    async function (done, _converse) {

                const entity = await _converse.api.disco.entities.get(_converse.domain);
                if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                    _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                }
                expect(_.partial(_converse.api.archive.query, {'start': 'not a real date'})).toThrow(
                    new TypeError('archive.query: invalid date provided for: start')
                );
                done();
           }));

           it("can be used to query for all messages after a certain time",
                mock.initConverse(
                    null, [], {},
                    async function (done, _converse) {

                const entity = await _converse.api.disco.entities.get(_converse.domain);
                if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                    _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                }
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
                const queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                expect(sent_stanza.toString()).toBe(
                    `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                        `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE">`+
                                `<value>urn:xmpp:mam:2</value>`+
                            `</field>`+
                            `<field var="start">`+
                                `<value>${moment(start).format()}</value>`+
                            `</field>`+
                            `</x>`+
                        `</query>`+
                    `</iq>`
                );
                done();
           }));

           it("can be used to query for a limited set of results",
                mock.initConverse(
                    null, [], {},
                    async function (done, _converse) {

                const entity = await _converse.api.disco.entities.get(_converse.domain);
                if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                    _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                }
                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                const start = '2010-06-07T00:00:00Z';
                _converse.api.archive.query({'start': start, 'max':10});
                const queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                expect(sent_stanza.toString()).toBe(
                    `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                        `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                                `<field type="hidden" var="FORM_TYPE">`+
                                    `<value>urn:xmpp:mam:2</value>`+
                                `</field>`+
                                `<field var="start">`+
                                    `<value>${moment(start).format()}</value>`+
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
                mock.initConverse(
                    null, [], {},
                    async function (done, _converse) {

                const entity = await _converse.api.disco.entities.get(_converse.domain);
                if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                    _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                }
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
                const queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                expect(sent_stanza.toString()).toBe(
                    `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                        `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                                `<field type="hidden" var="FORM_TYPE">`+
                                    `<value>urn:xmpp:mam:2</value>`+
                                `</field>`+
                                `<field var="start">`+
                                    `<value>${moment(start).format()}</value>`+
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
                mock.initConverse(
                    null, [], {},
                    async function (done, _converse) {

                const entity = await _converse.api.disco.entities.get(_converse.domain);
                if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                    _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                }
                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                _converse.api.archive.query({'before': '', 'max':10});
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

           it("accepts a Strophe.RSM object for the query options",
                mock.initConverse(
                    null, [], {},
                    async function (done, _converse) {

                const entity = await _converse.api.disco.entities.get(_converse.domain);
                if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                    _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                }
                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                // Normally the user wouldn't manually make a Strophe.RSM object
                // and pass it in. However, in the callback method an RSM object is
                // returned which can be reused for easy paging. This test is
                // more for that usecase.
                const rsm =  new Strophe.RSM({'max': '10'});
                rsm['with'] = 'romeo@montague.lit'; // eslint-disable-line dot-notation
                rsm.start = '2010-06-07T00:00:00Z';
                _converse.api.archive.query(rsm);

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
                                    `<value>${moment(rsm.start).format()}</value>`+
                                `</field>`+
                            `</x>`+
                            `<set xmlns="http://jabber.org/protocol/rsm">`+
                                `<max>10</max>`+
                            `</set>`+
                        `</query>`+
                    `</iq>`);
                done();
           }));

           it("accepts a callback function, which it passes the messages and a Strophe.RSM object",
                mock.initConverse(
                    null, [], {},
                    async function (done, _converse) {

                const entity = await _converse.api.disco.entities.get(_converse.domain);
                if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                    _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                }
                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                const callback = jasmine.createSpy('callback');

                _converse.api.archive.query({'with': 'romeo@capulet.lit', 'max':'10'}, callback);
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
                const msg1 = $msg({'id':'aeb213', 'to':'juliet@capulet.lit/chamber'})
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

                await test_utils.waitUntil(() => callback.calls.count());
                expect(callback).toHaveBeenCalled();
                const args = callback.calls.argsFor(0);
                expect(args[0].length).toBe(2);
                expect(args[0][0].outerHTML).toBe(msg1.nodeTree.outerHTML);
                expect(args[0][1].outerHTML).toBe(msg2.nodeTree.outerHTML);
                expect(args[1]['with']).toBe('romeo@capulet.lit'); // eslint-disable-line dot-notation
                expect(args[1].max).toBe('10');
                expect(args[1].count).toBe('16');
                expect(args[1].first).toBe('23452-4534-1');
                expect(args[1].last).toBe('09af3-cc343-b409f');
                done()
           }));
        });

        describe("The default preference", function () {

            it("is set once server support for MAM has been confirmed",
                mock.initConverse(
                    null, [], {},
                    async function (done, _converse) {

                const entity = await _converse.api.disco.entities.get(_converse.domain);
                let  sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                spyOn(_converse, 'onMAMPreferences').and.callThrough();
                _converse.message_archiving = 'never';

                const feature = new Backbone.Model({
                    'var': Strophe.NS.MAM
                });
                spyOn(feature, 'save').and.callFake(feature.set); // Save will complain about a url not being set

                entity.onFeatureAdded(feature);

                expect(_converse.connection.sendIQ).toHaveBeenCalled();
                expect(sent_stanza.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" type="get" xmlns="jabber:client">`+
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
                let stanza = $iq({'type': 'result', 'id': IQ_id})
                    .c('prefs', {'xmlns': Strophe.NS.MAM, 'default':'roster'})
                    .c('always').c('jid').t('romeo@montague.lit').up().up()
                    .c('never').c('jid').t('montague@montague.lit');
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                await test_utils.waitUntil(() => _converse.onMAMPreferences.calls.count());
                expect(_converse.onMAMPreferences).toHaveBeenCalled();
                expect(_converse.connection.sendIQ.calls.count()).toBe(3);

                expect(sent_stanza.toString()).toBe(
                    `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
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
                stanza = $iq({'type': 'result', 'id': IQ_id})
                    .c('prefs', {'xmlns': Strophe.NS.MAM, 'default':'always'})
                        .c('always').up()
                        .c('never');
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await test_utils.waitUntil(() => feature.save.calls.count());
                expect(feature.save).toHaveBeenCalled();
                expect(feature.get('preferences')['default']).toBe('never'); // eslint-disable-line dot-notation
                done();
            }));
        });
    });
}));
