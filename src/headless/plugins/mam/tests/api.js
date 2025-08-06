/*global converse */
import mock from "../../../tests/mock.js";

const { stx } = converse.env;
const dayjs = converse.env.dayjs;
const Strophe = converse.env.Strophe;
const u = converse.env.utils;
const sizzle = converse.env.sizzle;

describe("Message Archive Management", function () {
    describe("The archive.query API", function () {

        beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

        it("can be used to query for all archived messages",
                mock.initConverse(['discoInitialized'], {}, async function (_converse) {

            const sendIQ = _converse.api.connection.get().sendIQ;
            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
            let sent_stanza, IQ_id;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_stanza = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });
            _converse.api.archive.query();
            await u.waitUntil(() => sent_stanza);
            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            expect(sent_stanza).toEqualStanza(
                stx`<iq id="${IQ_id}" type="set" xmlns="jabber:client"><query queryid="${queryid}" xmlns="urn:xmpp:mam:2"/></iq>`);
        }));

       it("can be used to query for all messages to/from a particular JID",
                mock.initConverse([], {}, async function (_converse) {

            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
            let sent_stanza, IQ_id;
            const sendIQ = _converse.api.connection.get().sendIQ;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_stanza = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });
            _converse.api.archive.query({ mam: { with:'juliet@capulet.lit' }});
            await u.waitUntil(() => sent_stanza);
            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            expect(sent_stanza).toEqualStanza(stx`
                <iq id="${IQ_id}" type="set" xmlns="jabber:client">
                    <query queryid="${queryid}" xmlns="urn:xmpp:mam:2">
                        <x type="submit" xmlns="jabber:x:data">
                        <field type="hidden" var="FORM_TYPE">
                            <value>urn:xmpp:mam:2</value>
                        </field>
                        <field var="with">
                            <value>juliet@capulet.lit</value>
                        </field>
                        </x>
                    </query>
                </iq>`);
        }));

       it("can be used to query for archived messages from a chat room",
                mock.initConverse(['statusInitialized'], {}, async function (_converse) {

            const { api } = _converse;
            const room_jid = 'coven@chat.shakespeare.lit';
            api.archive.query({ mam: { with: room_jid }, is_groupchat: true });
            await mock.waitUntilDiscoConfirmed(_converse, room_jid, null, [Strophe.NS.MAM]);

            const sent_stanzas = api.connection.get().sent_stanzas;
            const stanza = await u.waitUntil(
                () => sent_stanzas.filter(s => sizzle(`[xmlns="${Strophe.NS.MAM}"]`, s).length).pop());

            const queryid = stanza.querySelector('query').getAttribute('queryid');
            expect(stanza).toEqualStanza(stx`
                <iq id="${stanza.getAttribute('id')}" to="${room_jid}" type="set" xmlns="jabber:client">
                    <query queryid="${queryid}" xmlns="urn:xmpp:mam:2"></query>
                </iq>`);
       }));

        it("checks whether returned MAM messages from a MUC room are from the right JID",
                mock.initConverse(['statusInitialized'], {}, async function (_converse) {

            const room_jid = 'coven@chat.shakespeare.lit';
            const promise = _converse.api.archive.query({
                is_groupchat: true,
                mam: { with: room_jid },
                rsm: { "max": "10" }
            });

            await mock.waitUntilDiscoConfirmed(_converse, room_jid, null, [Strophe.NS.MAM]);

            const sent_stanzas = _converse.api.connection.get().sent_stanzas;
            const sent_stanza = await u.waitUntil(
                () => sent_stanzas.filter(s => sizzle(`[xmlns="${Strophe.NS.MAM}"]`, s).length).pop());
            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            const msg1 = stx`<message id='iasd207' from='other@chat.shakespear.lit' to='romeo@montague.lit' xmlns="jabber:client">
                        <result xmlns='urn:xmpp:mam:2' queryid='${queryid}' id='34482-21985-73620'>
                            <forwarded xmlns='urn:xmpp:forward:0'>
                                <delay xmlns='urn:xmpp:delay' stamp='2010-07-10T23:08:25Z'/>
                                <message xmlns='jabber:client'
                                    to='romeo@montague.lit'
                                    id='162BEBB1-F6DB-4D9A-9BD8-CFDCC801A0B2'
                                    from='coven@chat.shakespeare.lit/firstwitch'
                                    type='groupchat'>
                                    <body>Thrice the brinded cat hath mew'd.</body>
                                </message>
                            </forwarded>
                        </result>
                    </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(msg1));

            // Send an <iq> stanza to indicate the end of the result set.
            const stanza = stx`<iq type='result' id='${sent_stanza.getAttribute('id')}' xmlns="jabber:client">
                <fin xmlns='urn:xmpp:mam:2'>
                    <set xmlns='http://jabber.org/protocol/rsm'>
                        <first index='0'>23452-4534-1</first>
                        <last>09af3-cc343-b409f</last>
                        <count>16</count>
                    </set>
                </fin>
            </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

            const result = await promise;
            expect(result.messages.length).toBe(0);
       }));

       it("can be used to query for all messages in a certain timespan",
                mock.initConverse([], {}, async function (_converse) {

            const { api } = _converse;
            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
            let sent_stanza, IQ_id;
            const sendIQ = api.connection.get().sendIQ;
            spyOn(api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_stanza = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });
            const start = '2010-06-07T00:00:00Z';
            const end = '2010-07-07T13:23:54Z';
            api.archive.query({ mam: { start, end }});
            await u.waitUntil(() => sent_stanza);
            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            expect(sent_stanza).toEqualStanza(
                stx`<iq id="${IQ_id}" type="set" xmlns="jabber:client">
                    <query queryid="${queryid}" xmlns="urn:xmpp:mam:2">
                        <x type="submit" xmlns="jabber:x:data">
                            <field type="hidden" var="FORM_TYPE">
                                <value>urn:xmpp:mam:2</value>
                            </field>
                            <field var="start">
                                <value>${dayjs(start).toISOString()}</value>
                            </field>
                            <field var="end">
                                <value>${dayjs(end).toISOString()}</value>
                            </field>
                        </x>
                    </query>
                </iq>`
            );
       }));

       it("throws a TypeError if an invalid date is provided",
                mock.initConverse([], {}, async function (_converse) {

            let promise;
            try {
                promise = _converse.api.archive.query({ mam: { start: 'not a real date' }});
                await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                await promise;
            } catch (e) {
                expect(() => {throw e}).toThrow(new TypeError('archive.query: invalid date provided for: start'));
            }
       }));

       it("can be used to query for all messages after a certain time",
                mock.initConverse([], {}, async function (_converse) {

            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
            let sent_stanza, IQ_id;
            const sendIQ = _converse.api.connection.get().sendIQ;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_stanza = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });
            if (!_converse.disco_entities.get(_converse.domain).features.findWhere({'var': Strophe.NS.MAM})) {
                _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
            }
            const start = '2010-06-07T00:00:00Z';
            _converse.api.archive.query({ mam: { start }});
            await u.waitUntil(() => sent_stanza);
            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            expect(sent_stanza).toEqualStanza(
                stx`<iq id="${IQ_id}" type="set" xmlns="jabber:client">
                    <query queryid="${queryid}" xmlns="urn:xmpp:mam:2">
                        <x type="submit" xmlns="jabber:x:data">
                            <field type="hidden" var="FORM_TYPE">
                                <value>urn:xmpp:mam:2</value>
                            </field>
                            <field var="start">
                                <value>${dayjs(start).toISOString()}</value>
                            </field>
                        </x>
                    </query>
                </iq>`
            );
       }));

       it("can be used to query for a limited set of results",
                mock.initConverse([], {}, async function (_converse) {

            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
            let sent_stanza, IQ_id;
            const sendIQ = _converse.api.connection.get().sendIQ;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_stanza = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });
            const start = '2010-06-07T00:00:00Z';
            _converse.api.archive.query({ mam: { start }, rsm: { max:10 }});
            await u.waitUntil(() => sent_stanza);
            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            expect(sent_stanza).toEqualStanza(
                stx`<iq id="${IQ_id}" type="set" xmlns="jabber:client">
                    <query queryid="${queryid}" xmlns="urn:xmpp:mam:2">
                        <x type="submit" xmlns="jabber:x:data">
                            <field type="hidden" var="FORM_TYPE">
                                <value>urn:xmpp:mam:2</value>
                            </field>
                            <field var="start">
                                <value>${dayjs(start).toISOString()}</value>
                            </field>
                        </x>
                        <set xmlns="http://jabber.org/protocol/rsm">
                            <max>10</max>
                        </set>
                    </query>
                </iq>`
            );
       }));

       it("accepts \"before\" with an empty string as value to reverse the order",
                mock.initConverse([], {}, async function (_converse) {

            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
            let sent_stanza, IQ_id;
            const sendIQ = _converse.api.connection.get().sendIQ;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_stanza = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });
            _converse.api.archive.query({ rsm: { before: '', max: 10 }});
            await u.waitUntil(() => sent_stanza);
            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            expect(sent_stanza).toEqualStanza(
                stx`<iq id="${IQ_id}" type="set" xmlns="jabber:client">
                    <query queryid="${queryid}" xmlns="urn:xmpp:mam:2">
                        <set xmlns="http://jabber.org/protocol/rsm">
                            <before></before>
                            <max>10</max>
                        </set>
                    </query>
                </iq>`);
       }));

       it("returns an object which includes the messages and a _converse.RSM object",
                mock.initConverse([], {}, async function (_converse) {

            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
            let sent_stanza, IQ_id;
            const sendIQ = _converse.api.connection.get().sendIQ;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_stanza = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });
            const promise = _converse.api.archive.query({ mam: { with: 'romeo@capulet.lit' }, rsm: { max:'10' }});

            await u.waitUntil(() => sent_stanza);
            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');

            const msg1 = stx`<message id='aeb212' to='juliet@capulet.lit/chamber' xmlns="jabber:client">
                        <result xmlns='urn:xmpp:mam:2' queryid='${queryid}' id='28482-98726-73623'>
                            <forwarded xmlns='urn:xmpp:forward:0'>
                                <delay xmlns='urn:xmpp:delay' stamp='2010-07-10T23:08:25Z'/>
                                <message xmlns='jabber:client'
                                        to='juliet@capulet.lit/balcony'
                                        from='romeo@montague.lit/orchard'
                                        type='chat'>
                                    <body>Call me but love, and I'll be new baptized.</body>
                                </message>
                            </forwarded>
                        </result>
                    </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(msg1));

            const msg2 = stx`<message id='aeb213' to='juliet@capulet.lit/chamber' xmlns="jabber:client">
                        <result xmlns='urn:xmpp:mam:2' queryid='${queryid}' id='28482-98726-73624'>
                            <forwarded xmlns='urn:xmpp:forward:0'>
                                <delay xmlns='urn:xmpp:delay' stamp='2010-07-10T23:08:25Z'/>
                                <message xmlns='jabber:client'
                                    to='juliet@capulet.lit/balcony'
                                    from='romeo@montague.lit/orchard'
                                    type='chat'>
                                    <body>Henceforth I never will be Romeo.</body>
                                </message>
                            </forwarded>
                        </result>
                    </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(msg2));

            const stanza = stx`<iq type='result' id='${IQ_id}' xmlns="jabber:client">
                <fin xmlns='urn:xmpp:mam:2'>
                    <set xmlns='http://jabber.org/protocol/rsm'>
                        <first index='0'>28482-98726-73623</first>
                        <last>09af3-cc343-b409f</last>
                        <count>16</count>
                    </set>
                </fin>
            </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

            const result = await promise;
            expect(result.messages.length).toBe(2);
            expect(result.messages[0].outerHTML).toBe(msg1.nodeTree.outerHTML);
            expect(result.messages[1].outerHTML).toBe(msg2.nodeTree.outerHTML);
            expect(result.rsm.query.max).toBe('10');
            expect(result.rsm.result.count).toBe(16);
            expect(result.rsm.result.first).toBe('28482-98726-73623');
            expect(result.rsm.result.last).toBe('09af3-cc343-b409f');
       }));
    });
});
