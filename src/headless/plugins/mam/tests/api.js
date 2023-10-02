/*global mock, converse */
const dayjs = converse.env.dayjs;
const Strophe = converse.env.Strophe;
const $iq = converse.env.$iq;
const $msg = converse.env.$msg;
const u = converse.env.utils;
const sizzle = converse.env.sizzle;

describe("Message Archive Management", function () {
    describe("The archive.query API", function () {

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
            expect(Strophe.serialize(sent_stanza)).toBe(
                `<iq id="${IQ_id}" type="set" xmlns="jabber:client"><query queryid="${queryid}" xmlns="urn:xmpp:mam:2"/></iq>`);
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
            _converse.api.archive.query({'with':'juliet@capulet.lit'});
            await u.waitUntil(() => sent_stanza);
            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            expect(Strophe.serialize(sent_stanza)).toBe(
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
        }));

       it("can be used to query for archived messages from a chat room",
                mock.initConverse(['statusInitialized'], {}, async function (_converse) {

            const room_jid = 'coven@chat.shakespeare.lit';
            _converse.api.archive.query({'with': room_jid, 'groupchat': true});
            await mock.waitUntilDiscoConfirmed(_converse, room_jid, null, [Strophe.NS.MAM]);

            const sent_stanzas = _converse.api.connection.get().sent_stanzas;
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
       }));

        it("checks whether returned MAM messages from a MUC room are from the right JID",
                mock.initConverse(['statusInitialized'], {}, async function (_converse) {

            const room_jid = 'coven@chat.shakespeare.lit';
            const promise = _converse.api.archive.query({'with': room_jid, 'groupchat': true, 'max':'10'});

            await mock.waitUntilDiscoConfirmed(_converse, room_jid, null, [Strophe.NS.MAM]);

            const sent_stanzas = _converse.api.connection.get().sent_stanzas;
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
            _converse.api.connection.get()._dataRecv(mock.createRequest(msg1));

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
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

            const result = await promise;
            expect(result.messages.length).toBe(0);
       }));

       it("can be used to query for all messages in a certain timespan",
                mock.initConverse([], {}, async function (_converse) {

            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
            let sent_stanza, IQ_id;
            const sendIQ = _converse.api.connection.get().sendIQ;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
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
            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            expect(Strophe.serialize(sent_stanza)).toBe(
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
       }));

       it("throws a TypeError if an invalid date is provided",
                mock.initConverse([], {}, async function (_converse) {

            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
            try {
                await _converse.api.archive.query({'start': 'not a real date'});
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
            _converse.api.archive.query({'start': start});
            await u.waitUntil(() => sent_stanza);
            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            expect(Strophe.serialize(sent_stanza)).toBe(
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
            _converse.api.archive.query({'start': start, 'max':10});
            await u.waitUntil(() => sent_stanza);
            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            expect(Strophe.serialize(sent_stanza)).toBe(
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
       }));

       it("can be used to page through results",
                mock.initConverse([], {}, async function (_converse) {

            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
            let sent_stanza, IQ_id;
            const sendIQ = _converse.api.connection.get().sendIQ;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
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
            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            expect(Strophe.serialize(sent_stanza)).toBe(
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
                            `<after>09af3-cc343-b409f</after>`+
                            `<max>10</max>`+
                        `</set>`+
                    `</query>`+
                `</iq>`);
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
            _converse.api.archive.query({'before': '', 'max':10});
            await u.waitUntil(() => sent_stanza);
            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            expect(Strophe.serialize(sent_stanza)).toBe(
                `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                    `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                        `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE">`+
                                `<value>urn:xmpp:mam:2</value>`+
                            `</field>`+
                        `</x>`+
                        `<set xmlns="http://jabber.org/protocol/rsm">`+
                            `<before></before>`+
                            `<max>10</max>`+
                        `</set>`+
                    `</query>`+
                `</iq>`);
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
            const promise = _converse.api.archive.query({'with': 'romeo@capulet.lit', 'max':'10'});

            await u.waitUntil(() => sent_stanza);
            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');

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
            _converse.api.connection.get()._dataRecv(mock.createRequest(msg1));

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
            _converse.api.connection.get()._dataRecv(mock.createRequest(msg2));

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
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

            const result = await promise;
            expect(result.messages.length).toBe(2);
            expect(result.messages[0].outerHTML).toBe(msg1.nodeTree.outerHTML);
            expect(result.messages[1].outerHTML).toBe(msg2.nodeTree.outerHTML);
            expect(result.rsm.query.max).toBe('10');
            expect(result.rsm.result.count).toBe(16);
            expect(result.rsm.result.first).toBe('23452-4534-1');
            expect(result.rsm.result.last).toBe('09af3-cc343-b409f');
       }));
    });
});
