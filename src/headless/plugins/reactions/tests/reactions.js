import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { Strophe, u, stx } = converse.env;

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
});
