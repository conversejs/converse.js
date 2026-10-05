import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { Strophe, sizzle, u, stx } = converse.env;

describe('Message Reactions (XEP-0444)', function () {
    it(
        'does not overwrite from_real_jid or occupant_id on the target message when a different occupant reacts',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);

            const juliet_jid = 'juliet@capulet.lit';
            const juliet_occupant_id = 'juliet-stable-oc-id';
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                    <presence from="${muc_jid}/juliet"
                              id="${u.getUniqueId()}"
                              to="${_converse.bare_jid}"
                              xmlns="jabber:client">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item jid="${juliet_jid}" affiliation="member" role="participant"/>
                        </x>
                        <occupant-id xmlns="${Strophe.NS.OCCUPANTID}" id="${juliet_occupant_id}"/>
                    </presence>`,
                ),
            );
            await u.waitUntil(() => model.getOccupantByNickname('juliet')?.get('jid'));

            const benvolio_jid = 'benvolio@montague.lit';
            const benvolio_occupant_id = 'benvolio-stable-oc-id';
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                    <presence from="${muc_jid}/benvolio"
                              id="${u.getUniqueId()}"
                              to="${_converse.bare_jid}"
                              xmlns="jabber:client">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item jid="${benvolio_jid}" affiliation="member" role="participant"/>
                        </x>
                        <occupant-id xmlns="${Strophe.NS.OCCUPANTID}" id="${benvolio_occupant_id}"/>
                    </presence>`,
                ),
            );
            await u.waitUntil(() => model.getOccupantByNickname('benvolio')?.get('jid'));

            await model.handleMessageStanza(stx`
                <message xmlns="jabber:client"
                         from="${muc_jid}/juliet"
                         to="${_converse.bare_jid}"
                         type="groupchat"
                         id="juliet-original-msg">
                    <body>Hello from juliet</body>
                    <stanza-id xmlns="urn:xmpp:sid:0" id="juliet-stanza-id" by="${muc_jid}"/>
                    <occupant-id xmlns="${Strophe.NS.OCCUPANTID}" id="${juliet_occupant_id}"/>
                </message>`);

            await u.waitUntil(() => model.messages.length === 1);
            const msg = model.messages.at(0);
            expect(msg.get('from_real_jid')).toBe(juliet_jid);
            expect(msg.get('occupant_id')).toBe(juliet_occupant_id);

            await model.handleMessageStanza(stx`
                <message xmlns="jabber:client"
                         from="${muc_jid}/benvolio"
                         to="${_converse.bare_jid}"
                         type="groupchat"
                         id="benvolio-reaction">
                    <reactions xmlns="urn:xmpp:reactions:0" id="juliet-original-msg">
                        <reaction>👍</reaction>
                    </reactions>
                    <occupant-id xmlns="${Strophe.NS.OCCUPANTID}" id="${benvolio_occupant_id}"/>
                </message>`);

            await u.waitUntil(() => msg.get('reactions')?.[benvolio_occupant_id]?.length);
            expect(msg.get('from_real_jid')).toBe(juliet_jid);
            expect(msg.get('occupant_id')).toBe(juliet_occupant_id);
        }),
    );
    it(
        "does not change the target message's time when an archived reaction is received",
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { api } = _converse;
            const muc_jid = 'lounge@montague.lit';
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');

            await model.handleMessageStanza(stx`
                <message xmlns="jabber:client"
                         from="${muc_jid}/juliet"
                         to="${_converse.bare_jid}"
                         type="groupchat"
                         id="original-msg">
                    <body>Hello from juliet</body>
                    <delay xmlns="urn:xmpp:delay" stamp="2026-01-01T10:00:00Z"/>
                    <stanza-id xmlns="urn:xmpp:sid:0" id="original-stanza-id" by="${muc_jid}"/>
                </message>`);

            await u.waitUntil(() => model.messages.length === 1);
            const msg = model.messages.at(0);
            const original_time = msg.get('time');
            expect(original_time).toBe('2026-01-01T10:00:00.000Z');

            const sent_stanzas = api.connection.get().sent_stanzas;
            const num_sent = sent_stanzas.length;
            const promise = u.mam.fetchArchivedMessages(model);
            const sent_stanza = await u.waitUntil(() =>
                sent_stanzas
                    .slice(num_sent)
                    .filter((s) => sizzle(`query[xmlns="${Strophe.NS.MAM}"]`, s).length)
                    .pop(),
            );
            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');

            api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                    <message xmlns="jabber:client" to="${_converse.jid}" from="${muc_jid}" id="${u.getUniqueId()}">
                        <result xmlns="urn:xmpp:mam:2" queryid="${queryid}" id="reaction-stanza-id">
                            <forwarded xmlns="urn:xmpp:forward:0">
                                <delay xmlns="urn:xmpp:delay" stamp="2026-01-01T10:05:00Z"/>
                                <message xmlns="jabber:client"
                                         from="${muc_jid}/benvolio"
                                         type="groupchat"
                                         id="benvolio-reaction">
                                    <reactions xmlns="urn:xmpp:reactions:0" id="original-stanza-id">
                                        <reaction>👍</reaction>
                                    </reactions>
                                </message>
                            </forwarded>
                        </result>
                    </message>`,
                ),
            );
            api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                    <iq type="result" id="${sent_stanza.getAttribute('id')}" xmlns="jabber:client">
                        <fin xmlns="urn:xmpp:mam:2" complete="true">
                            <set xmlns="http://jabber.org/protocol/rsm">
                                <first index="0">reaction-stanza-id</first>
                                <last>reaction-stanza-id</last>
                            </set>
                        </fin>
                    </iq>`,
                ),
            );

            await promise;
            await u.waitUntil(() => Object.keys(msg.get('reactions') || {}).length);
            expect(Object.values(msg.get('reactions'))).toEqual([['👍']]);
            expect(msg.get('time')).toBe(original_time);
        }),
    );
});
