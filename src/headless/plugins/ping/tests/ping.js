import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx } = converse.env;

describe('XMPP Ping', function () {
    describe('An IQ stanza', function () {
        it(
            'is returned when converse.js gets pinged',
            mock.initConverse(converse, ['statusInitialized'], {}, (_converse) => {
                const ping = stx`
                    <iq from="${_converse.domain}"
                        xmlns="jabber:client"
                        to="${_converse.jid}" id="s2c1" type="get">
                        <ping xmlns="urn:xmpp:ping"/>
                    </iq>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, ping));
                const sent_stanza = _converse.api.connection.get().IQ_stanzas.pop();
                expect(sent_stanza).toEqualStanza(
                    stx`<iq id="s2c1" to="${_converse.domain}" type="result" xmlns="jabber:client"/>`,
                );
            }),
        );

        it(
            'is sent out when converse.js pings a server',
            mock.initConverse(converse, ['statusInitialized'], {}, (_converse) => {
                _converse.api.ping();
                const sent_stanza = _converse.api.connection.get().IQ_stanzas.pop();
                expect(sent_stanza).toEqualStanza(
                    stx`<iq id="${sent_stanza.getAttribute('id')}" to="montague.lit" type="get" xmlns="jabber:client">
                            <ping xmlns="urn:xmpp:ping"/>
                        </iq>`,
                );
            }),
        );

        it(
            "is not sent out if we're not connected",
            mock.initConverse(converse, [], { auto_login: false }, async (_converse) => {
                spyOn(_converse.api.connection.get(), 'send');
                expect(await _converse.api.ping()).toBe(null);
                expect(_converse.api.connection.get().send.calls.count()).toBe(0);
            }),
        );
    });
});
