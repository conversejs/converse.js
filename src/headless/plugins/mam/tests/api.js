import mock from '../../../tests/mock.js';
import converse, { MAMPlaceholderMessage } from '../../../dist/converse-headless.js';

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
         * Answers the search that was sent with each of `matches`, then the <fin/>.
         * A match is the JID of its sender, or says what it is. The i-th has the id
         * `msg-i` (counting from 1), by which a later one can correct it. A match
         * that's `in_room` is a private message in a room (XEP-0045).
         * @param {import('../../../shared/_converse.js').ConversePrivateGlobal} _converse
         * @param {(string|{ from: string, to?: string, body?: string, replace?: string, in_room?: boolean })[]} matches
         * @param {Object} [options]
         * @param {boolean} [options.malformed] - Whether to answer first with a result that forwards nothing
         */
        async function answerSearch(_converse, matches, { malformed = false } = {}) {
            const { api } = _converse;
            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [
                Strophe.NS.MAM,
                Strophe.NS.FULLTEXT,
            ]);
            const sent_stanzas = api.connection.get().sent_stanzas;
            // Not just any archive query, as a chat that's opened makes its own.
            const sent_stanza = await u.waitUntil(() =>
                sent_stanzas.filter((s) => sizzle(`field[var="{${Strophe.NS.FULLTEXT}}fulltext"]`, s).length).pop(),
            );
            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            const receive = (stanza) => api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
            if (malformed) {
                receive(stx`<message id='m0' to='romeo@montague.lit' xmlns="jabber:client">
                        <result xmlns='urn:xmpp:mam:2' queryid='${queryid}' id='archive-0'/>
                    </message>`);
            }
            matches.forEach((match, i) => {
                const {
                    from,
                    to = 'romeo@montague.lit',
                    body = 'Meet me on the balcony.',
                    replace,
                    in_room,
                } = typeof match === 'string' ? { from: match } : match;
                receive(stx`<message id='m${i + 1}' to='romeo@montague.lit' xmlns="jabber:client">
                        <result xmlns='urn:xmpp:mam:2' queryid='${queryid}' id='archive-${i + 1}'>
                            <forwarded xmlns='urn:xmpp:forward:0'>
                                <delay xmlns='urn:xmpp:delay' stamp='2010-07-10T23:0${i}:25Z'/>
                                <message xmlns='jabber:client'
                                    id='msg-${i + 1}'
                                    to='${to}'
                                    from='${from}/balcony'
                                    type='chat'>
                                    <body>${body}</body>
                                    ${replace ? stx`<replace xmlns='urn:xmpp:message-correct:0' id='${replace}'/>` : ''}
                                    ${in_room ? stx`<x xmlns='http://jabber.org/protocol/muc#user'/>` : ''}
                                </message>
                            </forwarded>
                        </result>
                    </message>`);
            });
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
            'leaves out a private message in a room, rather than creating a chat with the room',
            mock.initConverse(converse, ['rosterInitialized'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current');
                const promise = api.archive.search('balcony', { create: true });
                await answerSearch(_converse, [
                    { from: 'lounge@montague.lit', in_room: true },
                    { from: 'romeo@montague.lit', to: 'lounge@montague.lit/juliet', in_room: true },
                    'mercutio@montague.lit',
                ]);

                const result = await promise;
                expect(result.messages.map((m) => m.collection.chatbox.get('jid'))).toEqual(['mercutio@montague.lit']);
                expect(await api.chats.get('lounge@montague.lit')).toBeNull();
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

        /** The placeholders for history that hasn't been fetched yet, as the archive queries they'd make. */
        const placeholders = (chat) =>
            chat.messages
                .filter((m) => m instanceof MAMPlaceholderMessage)
                .map((m) => ({ before: m.get('before'), start: m.get('start'), end: m.get('end') }));

        it(
            "holds a match that's a correction as the message it corrects",
            mock.initConverse(converse, ['rosterInitialized'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current');
                const chat = await api.chats.get('mercutio@montague.lit', {}, true);
                await chat.messages.fetched;
                const original = chat.messages.create({
                    msgid: 'original',
                    body: 'Meet me at noon.',
                    type: 'chat',
                    from: 'mercutio@montague.lit/balcony',
                    time: '2010-07-10T22:00:00.000Z',
                    'stanza_id romeo@montague.lit': 'held-1',
                });

                const promise = api.archive.search('balcony');
                await answerSearch(_converse, [{ from: 'mercutio@montague.lit', replace: 'original' }]);

                expect((await promise).messages).toEqual([original]);
                expect(original.get('body')).toBe('Meet me on the balcony.');
                expect(placeholders(chat)).toEqual([]);
            }),
        );

        it(
            'returns a message once, when both it and its correction match',
            mock.initConverse(converse, ['rosterInitialized'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current');
                const promise = api.archive.search('balcony', { create: true });
                await answerSearch(_converse, [
                    'mercutio@montague.lit',
                    { from: 'mercutio@montague.lit', body: 'Meet me on the balcony, at noon.', replace: 'msg-1' },
                ]);

                const { messages } = await promise;
                expect(messages.map((m) => m.get('body'))).toEqual(['Meet me on the balcony, at noon.']);
                expect(placeholders(messages[0].collection.chatbox)).toEqual([]);
            }),
        );

        it(
            'marks the history between matches in a conversation as not yet fetched',
            mock.initConverse(converse, ['rosterInitialized'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current');
                const promise = api.archive.search('balcony', { create: true });
                await answerSearch(_converse, ['mercutio@montague.lit', 'mercutio@montague.lit']);
                await promise;

                const chat = await api.chats.get('mercutio@montague.lit');
                expect(placeholders(chat)).toEqual([
                    { before: 'archive-2', start: chat.messages.at(0).get('time'), end: undefined },
                ]);
                // In between the two matches
                expect(chat.messages.at(1) instanceof MAMPlaceholderMessage).toBe(true);
            }),
        );

        it(
            'marks the history between a match and the messages held as not yet fetched',
            mock.initConverse(converse, ['rosterInitialized'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current');
                const chat = await api.chats.get('mercutio@montague.lit', {}, true);
                await chat.messages.fetched;
                const held = [
                    { msgid: 'h1', body: 'Is it late?', time: '2010-07-11T10:00:00.000Z' },
                    { msgid: 'h2', body: 'Very late.', time: '2010-07-11T11:00:00.000Z' },
                ];
                // The first was archived, the second not (yet)
                chat.messages.create({
                    ...held[0],
                    type: 'chat',
                    from: 'mercutio@montague.lit/balcony',
                    'stanza_id romeo@montague.lit': 'held-1',
                });
                chat.messages.create({ ...held[1], type: 'chat', from: 'mercutio@montague.lit/balcony' });

                const promise = api.archive.search('balcony');
                await answerSearch(_converse, ['mercutio@montague.lit']);
                const [match] = (await promise).messages;

                expect(placeholders(chat)).toEqual([{ before: 'held-1', start: match.get('time'), end: undefined }]);
                expect(chat.messages.indexOf(match)).toBe(0);
                expect(chat.messages.at(1) instanceof MAMPlaceholderMessage).toBe(true);
            }),
        );

        it(
            "pages from a held message's time, rather than its archive id, when it has none",
            mock.initConverse(converse, ['rosterInitialized'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current');
                const chat = await api.chats.get('mercutio@montague.lit', {}, true);
                await chat.messages.fetched;
                const time = '2010-07-11T11:00:00.000Z';
                chat.messages.create({
                    msgid: 'h1',
                    body: 'Very late.',
                    type: 'chat',
                    from: 'mercutio@montague.lit/balcony',
                    time,
                });

                const promise = api.archive.search('balcony');
                await answerSearch(_converse, ['mercutio@montague.lit']);
                const [match] = (await promise).messages;
                expect(placeholders(chat)).toEqual([{ before: undefined, start: match.get('time'), end: time }]);
            }),
        );

        it(
            'adds no placeholder for a match that was already held',
            mock.initConverse(converse, ['rosterInitialized'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current');
                const chat = await api.chats.get('mercutio@montague.lit', {}, true);
                await chat.messages.fetched;
                chat.messages.create({
                    msgid: 'm1',
                    body: 'Meet me on the balcony.',
                    type: 'chat',
                    from: 'mercutio@montague.lit/balcony',
                    time: '2010-07-10T23:00:25.000Z',
                    'stanza_id romeo@montague.lit': 'archive-1',
                });
                chat.messages.create({
                    msgid: 'h1',
                    body: 'Is it late?',
                    type: 'chat',
                    from: 'mercutio@montague.lit/balcony',
                    time: '2010-07-11T10:00:00.000Z',
                    'stanza_id romeo@montague.lit': 'held-1',
                });

                const promise = api.archive.search('balcony');
                await answerSearch(_converse, ['mercutio@montague.lit']);
                expect((await promise).messages.map((m) => m.get('msgid'))).toEqual(['m1']);
                expect(placeholders(chat)).toEqual([]);
            }),
        );

        /**
         * Holds the messages in a chat with Mercutio, as though from the local
         * cache, and reloads them from it, as after a reload of the page.
         * @returns The chat
         */
        async function holdMessages(_converse, messages) {
            const chat = await _converse.api.chats.get('mercutio@montague.lit', {}, true);
            await chat.messages.fetched;
            messages.forEach((attrs, i) =>
                chat.messages.create({
                    msgid: `h${i}`,
                    body: 'Is it late?',
                    type: 'chat',
                    from: 'mercutio@montague.lit/balcony',
                    ...attrs,
                }),
            );
            await reload(chat);
            return chat;
        }

        /** Reloads a chat's messages from the local cache, as after a reload of the page. */
        async function reload(chat) {
            chat.initMessages();
            await chat.fetchMessages();
        }

        it(
            'keeps the gaps around a match across a reload',
            mock.initConverse(converse, ['rosterInitialized'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current');
                const older = '2010-07-09T10:00:00.000Z';
                const newer = '2010-07-11T10:00:00.000Z';
                const chat = await holdMessages(_converse, [
                    { time: older, 'stanza_id romeo@montague.lit': 'held-0' },
                    { time: newer, 'stanza_id romeo@montague.lit': 'held-1' },
                ]);
                const scrollup = { before: 'held-0', start: undefined, end: undefined };
                expect(placeholders(chat)).toEqual([scrollup]);

                const promise = api.archive.search('balcony');
                await answerSearch(_converse, ['mercutio@montague.lit']);
                const [match] = (await promise).messages;
                const gaps = [
                    { before: 'archive-1', start: older, end: undefined },
                    { before: 'held-1', start: match.get('time'), end: undefined },
                ];
                expect(placeholders(chat)).toEqual([scrollup, ...gaps]);

                await reload(chat);
                expect(placeholders(chat)).toEqual([scrollup, ...gaps]);
            }),
        );

        it(
            'splits the gap that a match falls in, rather than adding another',
            mock.initConverse(converse, ['rosterInitialized'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current');
                const older = '2010-07-09T10:00:00.000Z';
                const chat = await holdMessages(_converse, [
                    { time: older, 'stanza_id romeo@montague.lit': 'held-0' },
                    {
                        time: '2010-07-11T10:00:00.000Z',
                        'stanza_id romeo@montague.lit': 'held-1',
                        mam_gap: { start: older },
                    },
                ]);
                const scrollup = { before: 'held-0', start: undefined, end: undefined };
                expect(placeholders(chat)).toEqual([scrollup, { before: 'held-1', start: older, end: undefined }]);

                const promise = api.archive.search('balcony');
                await answerSearch(_converse, ['mercutio@montague.lit']);
                const [match] = (await promise).messages;
                const gaps = [
                    { before: 'archive-1', start: older, end: undefined },
                    { before: 'held-1', start: match.get('time'), end: undefined },
                ];
                expect(placeholders(chat)).toEqual([scrollup, ...gaps]);
                await reload(chat);
                expect(placeholders(chat)).toEqual([scrollup, ...gaps]);
            }),
        );

        it(
            'splits the gap before the oldest message, which has no older limit, when a match is older still',
            mock.initConverse(converse, ['rosterInitialized'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current');
                const chat = await holdMessages(_converse, [
                    { time: '2010-07-11T10:00:00.000Z', 'stanza_id romeo@montague.lit': 'held-1' },
                ]);
                expect(placeholders(chat)).toEqual([{ before: 'held-1', start: undefined, end: undefined }]);

                const promise = api.archive.search('balcony');
                await answerSearch(_converse, ['mercutio@montague.lit']);
                const [match] = (await promise).messages;
                const expected = [
                    { before: 'archive-1', start: undefined, end: undefined },
                    { before: 'held-1', start: match.get('time'), end: undefined },
                ];
                expect(placeholders(chat)).toEqual(expected);
                // In between the match and the message held
                expect(chat.messages.at(2) instanceof MAMPlaceholderMessage).toBe(true);
                await reload(chat);
                expect(placeholders(chat)).toEqual(expected);
            }),
        );

        it(
            "forgets a gap once it's been fetched, but not if fetching it failed",
            mock.initConverse(converse, ['rosterInitialized'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current');
                const older = '2010-07-09T10:00:00.000Z';
                const chat = await holdMessages(_converse, [
                    { time: older, 'stanza_id romeo@montague.lit': 'held-0' },
                    {
                        time: '2010-07-11T10:00:00.000Z',
                        'stanza_id romeo@montague.lit': 'held-1',
                        mam_gap: { start: older },
                    },
                ]);
                const gap_of = () => chat.messages.findWhere({ msgid: 'h1' }).get('mam_gap');
                const gap = () => chat.messages.find((m) => m instanceof MAMPlaceholderMessage && m.get('start'));
                const fetch = vi.spyOn(u.mam, 'fetchArchivedMessages');

                fetch.mockResolvedValueOnce({ messages: [], error: new Error('timeout') });
                await gap().fetchMissingMessages();
                expect(gap_of()).toEqual({ start: older });

                await reload(chat);
                fetch.mockResolvedValueOnce({ messages: [], complete: true });
                await gap().fetchMissingMessages();
                expect(fetch).toHaveBeenLastCalledWith(chat, {
                    rsm: { before: 'held-1' },
                    mam: { start: older, end: undefined },
                });
                expect(gap_of()).toBeNull();
                await reload(chat);
                expect(gap()).toBeUndefined();
            }),
        );
    });
});
