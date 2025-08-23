import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx, Strophe } = converse.env;

describe('pubsub subscribe/unsubscribe API', function () {
    it(
        'sends correct IQ for subscribe',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api, state } = _converse;
            const own_jid = state.session.get('jid');
            const sent = api.connection.get().sent_stanzas;
            const service = 'pubsub.example.org';
            const node = 'testnode';
            const subscribePromise = api.pubsub.subscribe(service, node);

            const stanza = sent.filter((iq) => iq.querySelector('pubsub subscribe')).pop();
            expect(stanza).toEqualStanza(stx`
                <iq type="set"
                    from="${own_jid}"
                    to="${service}"
                    xmlns="jabber:client"
                    id="${stanza.getAttribute('id')}">
                  <pubsub xmlns="${Strophe.NS.PUBSUB}">
                    <subscribe node="${node}" jid="${own_jid}"/>
                  </pubsub>
                </iq>`);

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                <iq type="result"
                    xmlns="jabber:client"
                    from="${service}"
                    to="${own_jid}"
                    id="${stanza.getAttribute('id')}"/>
            `,
                ),
            );
            await subscribePromise;
        }),
    );

    it(
        'sends correct IQ for unsubscribe',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api, state } = _converse;
            const own_jid = state.session.get('jid');
            const sent = api.connection.get().sent_stanzas;
            const service = 'pubsub.example.org';
            const node = 'testnode';
            const unsubscribePromise = api.pubsub.unsubscribe(service, node);
            const stanza = sent.filter((iq) => iq.querySelector('pubsub unsubscribe')).pop();
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                <iq type="result"
                    xmlns="jabber:client"
                    from="${service}"
                    to="${own_jid}"
                    id="${stanza.getAttribute('id')}"/>
            `,
                ),
            );
            await unsubscribePromise;
            expect(stanza).toEqualStanza(stx`
                <iq type="set"
                    from="${own_jid}"
                    to="${service}"
                    xmlns="jabber:client"
                    id="${stanza.getAttribute('id')}">
                  <pubsub xmlns="${Strophe.NS.PUBSUB}">
                    <unsubscribe node="${node}" jid="${own_jid}"/>
                  </pubsub>
                </iq>`);
        }),
    );
});
