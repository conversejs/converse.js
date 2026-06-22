import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx, Strophe, u } = converse.env;

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

    it(
        'sends correct IQ for create',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api, state } = _converse;
            const own_jid = state.session.get('jid');
            const sent = api.connection.get().sent_stanzas;
            const service = 'pubsub.example.org';
            const node = 'newnode';
            const config = { access_model: 'open', max_items: '10' };
            const createPromise = api.pubsub.create(service, node, config);
            const stanza = await u.waitUntil(() => sent.filter((iq) => iq.querySelector('pubsub create')).pop());
            expect(stanza).toEqualStanza(stx`
                <iq type="set"
                    from="${own_jid}"
                    to="${service}"
                    xmlns="jabber:client"
                    id="${stanza.getAttribute('id')}">
                  <pubsub xmlns="${Strophe.NS.PUBSUB}">
                    <create node="${node}"/>
                    <configure>
                      <x xmlns="${Strophe.NS.XFORM}" type="submit">
                        <field var="FORM_TYPE" type="hidden">
                          <value>${Strophe.NS.PUBSUB}#node_config</value>
                        </field>
                        <field var="pubsub#access_model"><value>${config.access_model}</value></field>
                        <field var="pubsub#max_items"><value>${config.max_items}</value></field>
                      </x>
                    </configure>
                  </pubsub>
                </iq>`);

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                <iq type="result"
                    xmlns="jabber:client"
                    from="${service}"
                    to="${_converse.bare_jid}"
                    id="${stanza.getAttribute('id')}"/>
            `,
                ),
            );
            await createPromise;
        }),
    );

    it(
        'retrieves correct IQ for retrieve subscriptions',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api, state } = _converse;
            const service = 'pubsub.example.org';
            const bare_jid = state.session.get('jid');
            const subscriptionsPromise = api.pubsub.subscriptions(service);
            const stanza = api.connection
                .get()
                .sent_stanzas.filter((iq) => iq.querySelector('pubsub subscriptions'))
                .pop();
            expect(stanza).toEqualStanza(stx`
                <iq type="get"
                    from="${bare_jid}"
                    to="${service}"
                    xmlns="jabber:client"
                    id="${stanza.getAttribute('id')}">
                  <pubsub xmlns="${Strophe.NS.PUBSUB}">
                    <subscriptions/>
                  </pubsub>
                </iq>`);
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                <iq type="result"
                    xmlns="jabber:client"
                    from="${service}"
                    to="${bare_jid}"
                    id="${stanza.getAttribute('id')}">
                  <pubsub xmlns="${Strophe.NS.PUBSUB}">
                    <subscriptions>
                      <subscription node="node1" jid="${bare_jid}" subscription="subscribed"/>
                      <subscription node="node2" jid="${bare_jid}" subscription="unconfigured" subid="sid1"/>
                    </subscriptions>
                  </pubsub>
                </iq>
            `,
                ),
            );
            const subs = await subscriptionsPromise;
            expect(subs).toEqual([
                { node: 'node1', jid: bare_jid, subscription: 'subscribed', subid: undefined },
                { node: 'node2', jid: bare_jid, subscription: 'unconfigured', subid: 'sid1' },
            ]);
        })
    );
});

describe('pubsub items API', function () {
    it(
        'sends correct IQ to retrieve items and returns them',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api, state } = _converse;
            const own_jid = state.session.get('jid');
            const sent = api.connection.get().sent_stanzas;
            const service = 'pubsub.example.org';
            const node = 'urn:xmpp:microblog:0';
            const promise = api.pubsub.items.get(service, node, { max_items: 2 });

            const stanza = await u.waitUntil(() => sent.filter((iq) => iq.querySelector('pubsub items')).pop());
            expect(stanza).toEqualStanza(stx`
                <iq type="get"
                    from="${own_jid}"
                    to="${service}"
                    xmlns="jabber:client"
                    id="${stanza.getAttribute('id')}">
                  <pubsub xmlns="${Strophe.NS.PUBSUB}">
                    <items node="${node}" max_items="2"/>
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
                    id="${stanza.getAttribute('id')}">
                  <pubsub xmlns="${Strophe.NS.PUBSUB}">
                    <items node="${node}">
                      <item id="item1"><entry xmlns="http://www.w3.org/2005/Atom"><title>One</title></entry></item>
                      <item id="item2"><entry xmlns="http://www.w3.org/2005/Atom"><title>Two</title></entry></item>
                    </items>
                  </pubsub>
                </iq>`,
                ),
            );
            const result = await promise;
            expect(result.items.map((i) => i.getAttribute('id'))).toEqual(['item1', 'item2']);
            expect(result.items[0].querySelector('entry title').textContent).toBe('One');
            expect(result.rsm).toBeUndefined();
        })
    );

    it(
        'requests specific item ids when passed item_ids',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api, state } = _converse;
            const own_jid = state.session.get('jid');
            const sent = api.connection.get().sent_stanzas;
            const service = 'pubsub.example.org';
            const node = 'urn:xmpp:microblog:0';
            api.pubsub.items.get(service, node, { item_ids: ['a1', 'b2'] });

            const stanza = await u.waitUntil(() => sent.filter((iq) => iq.querySelector('pubsub items')).pop());
            expect(stanza).toEqualStanza(stx`
                <iq type="get"
                    from="${own_jid}"
                    to="${service}"
                    xmlns="jabber:client"
                    id="${stanza.getAttribute('id')}">
                  <pubsub xmlns="${Strophe.NS.PUBSUB}">
                    <items node="${node}">
                      <item id="a1"/>
                      <item id="b2"/>
                    </items>
                  </pubsub>
                </iq>`);
        })
    );

    it(
        'pages through items via RSM and parses the result set',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api, state } = _converse;
            const own_jid = state.session.get('jid');
            const sent = api.connection.get().sent_stanzas;
            const service = 'pubsub.example.org';
            const node = 'urn:xmpp:microblog:0';
            const promise = api.pubsub.items.get(service, node, { rsm: { max: 10 } });

            const stanza = await u.waitUntil(() => sent.filter((iq) => iq.querySelector('pubsub items')).pop());
            expect(stanza).toEqualStanza(stx`
                <iq type="get"
                    from="${own_jid}"
                    to="${service}"
                    xmlns="jabber:client"
                    id="${stanza.getAttribute('id')}">
                  <pubsub xmlns="${Strophe.NS.PUBSUB}">
                    <items node="${node}"/>
                    <set xmlns="${Strophe.NS.RSM}"><max>10</max></set>
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
                    id="${stanza.getAttribute('id')}">
                  <pubsub xmlns="${Strophe.NS.PUBSUB}">
                    <items node="${node}">
                      <item id="item1"><entry xmlns="http://www.w3.org/2005/Atom"><title>One</title></entry></item>
                    </items>
                    <set xmlns="${Strophe.NS.RSM}">
                      <first index="0">item1</first>
                      <last>item1</last>
                      <count>30</count>
                    </set>
                  </pubsub>
                </iq>`,
                ),
            );
            const result = await promise;
            expect(result.items.length).toBe(1);
            expect(result.rsm.result.count).toBe(30);
            expect(result.rsm.result.last).toBe('item1');
        })
    );
});
