import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { sizzle, stx, u } = converse.env;

describe('XEP-0092 Software Version', function () {
    it(
        'can be queried via api.version.get()',
        mock.initConverse(converse, ['statusInitialized'], {}, async (_converse) => {
            const conn = _converse.api.connection.get();
            const promise = _converse.api.version.get();

            const sent_iq = await u.waitUntil(() =>
                conn.IQ_stanzas.filter((iq) => sizzle('query[xmlns="jabber:iq:version"]', iq).length).pop()
            );
            expect(sent_iq).toEqualStanza(stx`
                <iq id="${sent_iq.getAttribute('id')}" to="montague.lit" type="get" xmlns="jabber:client">
                    <query xmlns="jabber:iq:version"/>
                </iq>`);

            const result = stx`
                <iq from="montague.lit" to="${_converse.jid}" id="${sent_iq.getAttribute('id')}" type="result" xmlns="jabber:client">
                    <query xmlns="jabber:iq:version">
                        <name>Prosody</name>
                        <version>0.12.0</version>
                        <os>Debian GNU/Linux</os>
                    </query>
                </iq>`;
            conn._dataRecv(mock.createRequest(_converse, result));

            const version = await promise;
            expect(version).toEqual({ name: 'Prosody', version: '0.12.0', os: 'Debian GNU/Linux' });
        })
    );

    it(
        'returns null when the entity responds with an error',
        mock.initConverse(converse, ['statusInitialized'], {}, async (_converse) => {
            const conn = _converse.api.connection.get();
            const promise = _converse.api.version.get('shakespeare.lit');

            const sent_iq = await u.waitUntil(() =>
                conn.IQ_stanzas
                    .filter((iq) => iq.getAttribute('to') === 'shakespeare.lit')
                    .filter((iq) => sizzle('query[xmlns="jabber:iq:version"]', iq).length)
                    .pop()
            );

            const error = stx`
                <iq from="shakespeare.lit" to="${_converse.jid}" id="${sent_iq.getAttribute('id')}" type="error" xmlns="jabber:client">
                    <query xmlns="jabber:iq:version"/>
                    <error type="cancel">
                        <service-unavailable xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                    </error>
                </iq>`;
            conn._dataRecv(mock.createRequest(_converse, error));

            expect(await promise).toBe(null);
        })
    );
});
