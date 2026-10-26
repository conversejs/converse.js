import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { dayjs, stx, sizzle, u, Strophe } = converse.env;

describe('Message Archive Management', function () {
    describe('The archive.query API', function () {
        it(
            'can be used to query for all archived messages',
            mock.initConverse(converse, ['discoInitialized'], {}, async function (_converse) {
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
                    stx`<iq id="${IQ_id}" type="set" xmlns="jabber:client"><query queryid="${queryid}" xmlns="urn:xmpp:mam:2"/></iq>`,
                );
            }),
        );

        it(
            'can be used to query for all messages to/from a particular JID',
            mock.initConverse(converse, [], {}, async function (_converse) {
                await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                let sent_stanza, IQ_id;
                const sendIQ = _converse.api.connection.get().sendIQ;
                spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                _converse.api.archive.query({ mam: { with: 'juliet@capulet.lit' } });
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
            }),
        );

        it(
            'can be used to query for archived messages from a chat room',
            mock.initConverse(converse, ['statusInitialized'], {}, async function (_converse) {
                const { api } = _converse;
                const room_jid = 'coven@chat.shakespeare.lit';
                api.archive.query({ mam: { with: room_jid }, is_groupchat: true });
                await mock.waitUntilDiscoConfirmed(_converse, room_jid, null, [Strophe.NS.MAM]);

                const sent_stanzas = api.connection.get().sent_stanzas;
                const stanza = await u.waitUntil(() =>
                    sent_stanzas.filter((s) => sizzle(`[xmlns="${Strophe.NS.MAM}"]`, s).length).pop(),
                );

                const queryid = stanza.querySelector('query').getAttribute('queryid');
                expect(stanza).toEqualStanza(stx`
                <iq id="${stanza.getAttribute('id')}" to="${room_jid}" type="set" xmlns="jabber:client">
                    <query queryid="${queryid}" xmlns="urn:xmpp:mam:2"></query>
                </iq>`);
            }),
        );

        it(
            'checks whether returned MAM messages from a MUC room are from the right JID',
            mock.initConverse(converse, ['statusInitialized'], {}, async function (_converse) {
                const room_jid = 'coven@chat.shakespeare.lit';
                const promise = _converse.api.archive.query({
                    is_groupchat: true,
                    mam: { with: room_jid },
                    rsm: { 'max': '10' },
                });

                await mock.waitUntilDiscoConfirmed(_converse, room_jid, null, [Strophe.NS.MAM]);

                const sent_stanzas = _converse.api.connection.get().sent_stanzas;
                const sent_stanza = await u.waitUntil(() =>
                    sent_stanzas.filter((s) => sizzle(`[xmlns="${Strophe.NS.MAM}"]`, s).length).pop(),
                );
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
                _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, msg1));

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
                _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

                const result = await promise;
                expect(result.messages.length).toBe(0);
            }),
        );

        it(
            'can be used to query for all messages in a certain timespan',
            mock.initConverse(converse, [], {}, async function (_converse) {
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
                api.archive.query({ mam: { start, end } });
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
                </iq>`,
                );
            }),
        );

        it(
            'throws a TypeError if an invalid date is provided',
            mock.initConverse(converse, [], {}, async function (_converse) {
                let promise;
                try {
                    promise = _converse.api.archive.query({ mam: { start: 'not a real date' } });
                    await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                    await promise;
                } catch (e) {
                    expect(() => {
                        throw e;
                    }).toThrow(new TypeError('archive.query: invalid date provided for: start'));
                }
            }),
        );

        it(
            'can be used to query for all messages after a certain time',
            mock.initConverse(converse, [], {}, async function (_converse) {
                await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                let sent_stanza, IQ_id;
                const sendIQ = _converse.api.connection.get().sendIQ;
                spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                if (!_converse.disco_entities.get(_converse.domain).features.findWhere({ 'var': Strophe.NS.MAM })) {
                    _converse.disco_entities.get(_converse.domain).features.create({ 'var': Strophe.NS.MAM });
                }
                const start = '2010-06-07T00:00:00Z';
                _converse.api.archive.query({ mam: { start } });
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
                </iq>`,
                );
            }),
        );

        it(
            'can be used to query for a limited set of results',
            mock.initConverse(converse, [], {}, async function (_converse) {
                await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                let sent_stanza, IQ_id;
                const sendIQ = _converse.api.connection.get().sendIQ;
                spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                const start = '2010-06-07T00:00:00Z';
                _converse.api.archive.query({ mam: { start }, rsm: { max: 10 } });
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
                </iq>`,
                );
            }),
        );

        it(
            'accepts "before" with an empty string as value to reverse the order',
            mock.initConverse(converse, [], {}, async function (_converse) {
                await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                let sent_stanza, IQ_id;
                const sendIQ = _converse.api.connection.get().sendIQ;
                spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                _converse.api.archive.query({ rsm: { before: '', max: 10 } });
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
                </iq>`,
                );
            }),
        );

        it(
            'returns an object which includes the messages and a _converse.RSM object',
            mock.initConverse(converse, [], {}, async function (_converse) {
                await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                let sent_stanza, IQ_id;
                const sendIQ = _converse.api.connection.get().sendIQ;
                spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                const promise = _converse.api.archive.query({ mam: { with: 'romeo@capulet.lit' }, rsm: { max: '10' } });

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
                _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, msg1));

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
                _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, msg2));

                const stanza = stx`<iq type='result' id='${IQ_id}' xmlns="jabber:client">
                <fin xmlns='urn:xmpp:mam:2'>
                    <set xmlns='http://jabber.org/protocol/rsm'>
                        <first index='0'>28482-98726-73623</first>
                        <last>09af3-cc343-b409f</last>
                        <count>16</count>
                    </set>
                </fin>
            </iq>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

                const result = await promise;
                expect(result.messages.length).toBe(2);
                expect(result.messages[0].outerHTML).toBe(msg1.nodeTree.outerHTML);
                expect(result.messages[1].outerHTML).toBe(msg2.nodeTree.outerHTML);
                expect(result.rsm.query.max).toBe('10');
                expect(result.rsm.result.count).toBe(16);
                expect(result.rsm.result.first).toBe('28482-98726-73623');
                expect(result.rsm.result.last).toBe('09af3-cc343-b409f');
            }),
        );

        it(
            'sends a full-text search as a field of the MAM form',
            mock.initConverse(converse, [], {}, async function (_converse) {
                await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                let sent_stanza, IQ_id;
                const sendIQ = _converse.api.connection.get().sendIQ;
                spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                _converse.api.archive.query({ mam: { fulltext: 'balcony' } });
                await u.waitUntil(() => sent_stanza);
                const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
                expect(sent_stanza).toEqualStanza(stx`
                <iq id="${IQ_id}" type="set" xmlns="jabber:client">
                    <query queryid="${queryid}" xmlns="urn:xmpp:mam:2">
                        <x type="submit" xmlns="jabber:x:data">
                            <field type="hidden" var="FORM_TYPE">
                                <value>urn:xmpp:mam:2</value>
                            </field>
                            <field var="{urn:xmpp:fulltext:0}fulltext">
                                <value>balcony</value>
                            </field>
                        </x>
                    </query>
                </iq>`);
            }),
        );
    });

    describe('The archive.search API', function () {
        it(
            'returns null when the server does not offer full-text search',
            mock.initConverse(converse, [], {}, async function (_converse) {
                await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                expect(await _converse.api.archive.search('balcony')).toBeNull();
            }),
        );

        /**
         * Answers the search that was sent with a match from each of `senders`,
         * then the <fin/>.
         * @param {import('../../../shared/_converse.js').ConversePrivateGlobal} _converse
         * @param {string[]} senders
         * @param {Object} [options]
         * @param {boolean} [options.malformed] - Whether to answer first with a result that forwards nothing
         */
        async function answerSearch(_converse, senders, { malformed = false } = {}) {
            const { api } = _converse;
            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [
                Strophe.NS.MAM,
                Strophe.NS.FULLTEXT,
            ]);
            const sent_stanzas = api.connection.get().sent_stanzas;
            const sent_stanza = await u.waitUntil(() =>
                sent_stanzas.filter((s) => sizzle(`[xmlns="${Strophe.NS.MAM}"]`, s).length).pop(),
            );
            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            const receive = (stanza) => api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
            if (malformed) {
                receive(stx`<message id='m0' to='romeo@montague.lit' xmlns="jabber:client">
                        <result xmlns='urn:xmpp:mam:2' queryid='${queryid}' id='archive-0'/>
                    </message>`);
            }
            senders.forEach((sender, i) =>
                receive(stx`<message id='m${i + 1}' to='romeo@montague.lit' xmlns="jabber:client">
                        <result xmlns='urn:xmpp:mam:2' queryid='${queryid}' id='archive-${i + 1}'>
                            <forwarded xmlns='urn:xmpp:forward:0'>
                                <delay xmlns='urn:xmpp:delay' stamp='2010-07-10T23:0${i}:25Z'/>
                                <message xmlns='jabber:client'
                                    to='romeo@montague.lit'
                                    from='${sender}/balcony'
                                    type='chat'>
                                    <body>Meet me on the balcony.</body>
                                </message>
                            </forwarded>
                        </result>
                    </message>`),
            );
            receive(stx`<iq type='result' id='${sent_stanza.getAttribute('id')}' xmlns="jabber:client">
                    <fin xmlns='urn:xmpp:mam:2' complete='true'/>
                </iq>`);
        }

        it(
            'holds each match in its conversation, where it can be found by the archive id',
            mock.initConverse(converse, ['rosterInitialized'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current');
                const promise = api.archive.search('balcony', { create: true });
                await answerSearch(_converse, ['mercutio@montague.lit'], { malformed: true });

                const result = await promise;
                expect(result.complete).toBe(true);
                expect(result.messages.map((m) => m.get('body'))).toEqual(['Meet me on the balcony.']);
                const [message] = result.messages;
                expect(message.get('stanza_id romeo@montague.lit')).toBe('archive-1');
                expect(message.collection.chatbox.get('jid')).toBe('mercutio@montague.lit');
            }),
        );

        it(
            "leaves out a match in a chat we don't have, rather than creating it",
            mock.initConverse(converse, ['rosterInitialized'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current');
                await api.chats.get('mercutio@montague.lit', {}, true);
                const promise = api.archive.search('balcony');
                await answerSearch(_converse, ['mercutio@montague.lit', 'benvolio@montague.lit']);

                const result = await promise;
                expect(result.messages.map((m) => m.collection.chatbox.get('jid'))).toEqual(['mercutio@montague.lit']);
                expect(await api.chats.get('benvolio@montague.lit')).toBeNull();
            }),
        );
    });
});
