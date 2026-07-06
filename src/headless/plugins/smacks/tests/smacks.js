import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx, Strophe, Stanza, u } = converse.env;

// XEP-0198 Stream Management is implemented natively by Strophe and is
// websocket-only, so these tests run the mock connection over the websocket
// transport instead of the default (mock-)BOSH one.
const SETTINGS = {
    auto_login: false,
    enable_smacks: true,
    show_controlbox_by_default: true,
    smacks_max_unacked_stanzas: 2,
    websocket_url: 'ws://montague.lit/ws',
};

describe('XEP-0198 Stream Management', function () {
    it(
        'gets enabled with an <enable> stanza and resumed with a <resume> stanza',
        mock.initConverse(
            converse,
            ['chatBoxesInitialized'],
            {
                ...SETTINGS,
                blacklisted_plugins: ['converse-blocklist', 'converse-omemo'],
            },
            async function (_converse) {
                await _converse.api.user.login('romeo@montague.lit/orchard', 'secret');
                const conn = _converse.api.connection.get();

                const { sent_stanzas } = conn;
                let stanza = await u.waitUntil(() => sent_stanzas.filter((s) => s.tagName === 'enable', 1000).pop());

                expect(conn.isStreamManagementEnabled()).toBe(false);
                expect(stanza).toEqualStanza(stx`<enable resume="true" xmlns="urn:xmpp:sm:3"/>`);

                let result = stx`<enabled xmlns="urn:xmpp:sm:3" id="some-long-sm-id" resume="true"/>`;
                conn._dataRecv(mock.createRequest(_converse, result));
                expect(conn.isStreamManagementEnabled()).toBe(true);
                expect(conn.sm.state.id).toBe('some-long-sm-id');

                await mock.waitUntilDiscoConfirmed(_converse, 'montague.lit', [], [Strophe.NS.CARBONS]);

                let IQ_stanzas = conn.IQ_stanzas;
                await u.waitUntil(() => IQ_stanzas.length === 5);

                const disco_iq = IQ_stanzas[0];
                expect(disco_iq).toEqualStanza(stx`
                    <iq xmlns="jabber:client" type="get" from="romeo@montague.lit" to="romeo@montague.lit" id="${disco_iq.getAttribute('id')}">
                        <pubsub xmlns="http://jabber.org/protocol/pubsub">
                            <items node="urn:xmpp:reactions:popular:0" max_items="1"/>
                        </pubsub>
                    </iq>`);

                expect(IQ_stanzas[1]).toEqualStanza(stx`
                    <iq from="romeo@montague.lit/orchard" id="${IQ_stanzas[1].getAttribute('id')}" to="montague.lit" type="get" xmlns="jabber:client">
                        <query xmlns="http://jabber.org/protocol/disco#info"/></iq>`);
                await mock.waitForRoster(_converse, 'current', 1);

                expect(IQ_stanzas[2]).toEqualStanza(stx`
                    <iq id="${IQ_stanzas[2].getAttribute('id')}" type="get" xmlns="jabber:client">
                        <query xmlns="jabber:iq:roster"/></iq>`);

                expect(IQ_stanzas[3]).toEqualStanza(stx`
                    <iq from="romeo@montague.lit/orchard" id="${IQ_stanzas[3].getAttribute('id')}" to="romeo@montague.lit" type="get" xmlns="jabber:client">
                        <query xmlns="http://jabber.org/protocol/disco#info"/></iq>`);

                expect(IQ_stanzas[4]).toEqualStanza(stx`
                    <iq from="romeo@montague.lit/orchard" id="${IQ_stanzas[4].getAttribute('id')}" type="set" xmlns="jabber:client">
                        <enable xmlns="urn:xmpp:carbons:2"/></iq>`);

                await u.waitUntil(() => sent_stanzas.filter((s) => s.nodeName === 'presence').length);

                expect(sent_stanzas.filter((s) => s.nodeName === 'r').length).toBe(3);
                expect(conn.sm.state.unacked.length).toBe(6);

                // test handling of acks
                let ack = stx`<a xmlns="urn:xmpp:sm:3" h="2"/>`;
                conn._dataRecv(mock.createRequest(_converse, ack));
                expect(conn.sm.state.unacked.length).toBe(4);

                // test handling of ack requests
                let r = stx`<r xmlns="urn:xmpp:sm:3"/>`;
                conn._dataRecv(mock.createRequest(_converse, r));

                ack = await u.waitUntil(() => sent_stanzas.filter((s) => s.nodeName === 'a').pop());
                expect(ack).toEqualStanza(stx`<a h="2" xmlns="urn:xmpp:sm:3"/>`);

                const disco_result = stx`
                    <iq xmlns="jabber:client" type="result" from="montague.lit" to="romeo@montague.lit/orchard" id="${disco_iq.getAttribute('id')}">
                        <query xmlns="http://jabber.org/protocol/disco#info">
                            <identity category="server" type="im"/>
                            <feature var="http://jabber.org/protocol/disco#info"/>
                            <feature var="http://jabber.org/protocol/disco#items"/>
                        </query>
                    </iq>`;
                conn._dataRecv(mock.createRequest(_converse, disco_result));

                ack = stx`<a xmlns="urn:xmpp:sm:3" h="2"/>`;
                conn._dataRecv(mock.createRequest(_converse, ack));
                expect(conn.sm.state.unacked.length).toBe(4);

                const unacked_stanzas = conn.sm.state.unacked.map((entry) => Stanza.fromString(entry.stanza));
                expect(unacked_stanzas[0]).toEqualStanza(IQ_stanzas[2]);
                expect(unacked_stanzas[1]).toEqualStanza(IQ_stanzas[3]);
                expect(unacked_stanzas[2]).toEqualStanza(IQ_stanzas[4]);
                expect(unacked_stanzas[3]).toEqualStanza(
                    stx`<presence xmlns="jabber:client"><priority>0</priority><x xmlns="vcard-temp:x:update"/>
                        <c hash="sha-1" node="https://conversejs.org" ver="lvcDSoElfrbbjpiLJQNl0mi9Q18=" xmlns="http://jabber.org/protocol/caps"/>
                        </presence>`,
                );

                r = stx`<r xmlns="urn:xmpp:sm:3"/>`;
                conn._dataRecv(mock.createRequest(_converse, r));

                ack = await u.waitUntil(() =>
                    sent_stanzas.filter((s) => s.nodeName === 'a' && s.getAttribute('h') === '3').pop(),
                );

                expect(ack).toEqualStanza(stx`<a h="3" xmlns="urn:xmpp:sm:3"/>`);
                await _converse.api.waitUntil('rosterInitialized');

                // test session resumption
                conn.IQ_stanzas = [];
                IQ_stanzas = conn.IQ_stanzas;
                await _converse.api.connection.reconnect();
                stanza = await u.waitUntil(() => sent_stanzas.filter((s) => s.tagName === 'resume').pop(), 1000);
                expect(stanza).toEqualStanza(stx`<resume h="3" previd="some-long-sm-id" xmlns="urn:xmpp:sm:3"/>`);

                const num_sent = sent_stanzas.length;
                result = stx`<resumed xmlns="urn:xmpp:sm:3" h="another-sequence-number" previd="some-long-sm-id"/>`;
                conn._dataRecv(mock.createRequest(_converse, result));

                // Another <enable> stanza doesn't get sent out
                expect(sent_stanzas.filter((s) => s.tagName === 'enable').length).toBe(1);
                expect(conn.isStreamManagementEnabled()).toBe(true);
                expect(conn.hasResumed()).toBe(true);

                // The unacked stanzas were re-sent out, in order (from Strophe's
                // SM queue, so unlike before they don't pass through sendIQ and
                // don't show up in IQ_stanzas). The resend strips each stanza's
                // root `from` (Strophe does this so a resumed stream can't be
                // rejected as invalid-from), so compare against the from-less form.
                const resent_stanzas = sent_stanzas.slice(num_sent);
                expect(resent_stanzas.length).toBe(5);
                unacked_stanzas.forEach((s, i) => {
                    const expected = s.tree().cloneNode(true);
                    expected.removeAttribute('from');
                    expect(resent_stanzas[i]).toEqualStanza(expected);
                });
                // ...followed by an ack request covering them
                expect(resent_stanzas[4].nodeName).toBe('r');

                await new Promise((resolve) => _converse.api.listen.once('reconnected', resolve));
            },
        ),
    );

    it(
        'does not send a duplicate presence when a session is successfully resumed',
        mock.initConverse(
            converse,
            ['chatBoxesInitialized'],
            {
                ...SETTINGS,
                blacklisted_plugins: ['converse-blocklist', 'converse-reactions'],
            },
            async function (_converse) {
                await _converse.api.user.login('romeo@montague.lit/orchard', 'secret');
                const conn = _converse.api.connection.get();

                const { sent_stanzas } = conn;
                let stanza = await u.waitUntil(() => sent_stanzas.filter((s) => s.tagName === 'enable').pop(), 1000);
                expect(stanza).toEqualStanza(stx`<enable resume="true" xmlns="urn:xmpp:sm:3"/>`);

                let result = stx`<enabled xmlns="urn:xmpp:sm:3" id="some-long-sm-id" resume="true"/>`;
                conn._dataRecv(mock.createRequest(_converse, result));

                await mock.waitUntilDiscoConfirmed(_converse, 'montague.lit', [], [Strophe.NS.CARBONS]);
                await mock.waitForRoster(_converse, 'current', 1);
                await u.waitUntil(() => sent_stanzas.filter((s) => s.nodeName === 'presence').length);

                // Reconnect and successfully resume the SMACKS session
                await _converse.api.connection.reconnect();
                stanza = await u.waitUntil(() => sent_stanzas.filter((s) => s.tagName === 'resume').pop(), 1000);

                result = stx`<resumed xmlns="urn:xmpp:sm:3" h="another-sequence-number" previd="some-long-sm-id"/>`;
                conn._dataRecv(mock.createRequest(_converse, result));

                // Strophe's <resumed/> handler sets connection.restored = true
                // then synchronously calls _changeConnectStatus(CONNECTED),
                // which clears send_initial_presence before onConnected()
                // fires. This is fully synchronous so we can assert immediately.
                expect(conn.send_initial_presence).toBe(false);
            },
        ),
    );

    it(
        'might not resume and the session will then be reset',
        mock.initConverse(converse, ['chatBoxesInitialized'], { ...SETTINGS }, async function (_converse) {
            await _converse.api.user.login('romeo@montague.lit/orchard', 'secret');
            const conn = _converse.api.connection.get();

            const { sent_stanzas } = conn;
            let stanza = await u.waitUntil(() => sent_stanzas.filter((s) => s.tagName === 'enable').pop());
            expect(stanza).toEqualStanza(stx`<enable resume="true" xmlns="urn:xmpp:sm:3"/>`);
            let result = stx`<enabled xmlns="urn:xmpp:sm:3" id="some-long-sm-id" resume="true"/>`;
            conn._dataRecv(mock.createRequest(_converse, result));

            await mock.waitForRoster(_converse, 'current', 1);

            // test session resumption
            await _converse.api.connection.reconnect();
            stanza = await u.waitUntil(() => sent_stanzas.filter((s) => s.tagName === 'resume').pop());
            expect(stanza).toEqualStanza(stx`<resume h="1" previd="some-long-sm-id" xmlns="urn:xmpp:sm:3"/>`);

            // Subscribe before injecting <failed/>: unlike the old
            // plugin, Strophe does not block the connected flow on the
            // <enabled/> round-trip, so 'reconnected' fires as soon as
            // the fallback resource binding completes.
            const reconnected = new Promise((resolve) => _converse.api.listen.once('reconnected', resolve));

            result = stx`
            <failed xmlns="urn:xmpp:sm:3" h="another-sequence-number">
                <item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
            </failed>`;
            conn._dataRecv(mock.createRequest(_converse, result));

            // The SM state gets reset
            expect(conn.isStreamManagementEnabled()).toBe(false);
            expect(conn.hasResumed()).toBe(false);
            expect(conn.sm.state.id).toBe(null);
            expect(conn.sm.state.hIn).toBe(0);
            expect(conn.sm.state.hOutAcked).toBe(0);
            expect(conn.sm.state.unacked.length).toBe(0);
            // The roster cache was invalidated (via streamResumptionFailed)
            expect(_converse.session.get('roster_cached')).toBeFalsy();

            await u.waitUntil(() => sent_stanzas.filter((s) => s.tagName === 'enable').length === 2);
            stanza = sent_stanzas.filter((s) => s.tagName === 'enable').pop();
            expect(stanza).toEqualStanza(stx`<enable resume="true" xmlns="urn:xmpp:sm:3"/>`);

            result = stx`<enabled xmlns="urn:xmpp:sm:3" id="another-long-sm-id" resume="true"/>`;
            conn._dataRecv(mock.createRequest(_converse, result));
            expect(conn.isStreamManagementEnabled()).toBe(true);
            expect(conn.sm.state.id).toBe('another-long-sm-id');

            // Check that the roster gets fetched
            await mock.waitForRoster(_converse, 'current', 1);
            await reconnected;
        }),
    );

    it(
        'can cause MUC messages to be received before chatboxes are initialized',
        mock.initConverse(
            converse,
            ['chatBoxesInitialized'],
            {
                ...SETTINGS,
                'blacklisted_plugins': 'converse-mam',
                'muc_fetch_members': false,
                // Seed resumable XEP-0198 state, as persisted by Strophe's SM
                // engine before the (simulated) page reload.
                'connection_options': {
                    'streamManagement': {
                        'storage': (() => {
                            const storage = new Strophe.MemoryStorageBackend();
                            storage.save('strophe-sm:romeo@montague.lit', {
                                'id': 'some-long-sm-id',
                                'resumeSupported': true,
                                'boundJid': 'romeo@montague.lit/converse.js-100020907',
                                'enableSent': true,
                                'enabled': true,
                                'hIn': 580,
                                'hOutAcked': 525,
                                'unacked': [],
                            });
                            return storage;
                        })(),
                    },
                },
            },
            async function (_converse) {
                const { api } = _converse;

                const key =
                    'converse-test-session/converse.session-romeo@montague.lit-converse.session-romeo@montague.lit';
                sessionStorage.setItem(
                    key,
                    JSON.stringify({
                        'id': 'converse.session-romeo@montague.lit',
                        'jid': 'romeo@montague.lit/converse.js-100020907',
                        'bare_jid': 'romeo@montague.lit',
                        'resource': 'converse.js-100020907',
                        'domain': 'montague.lit',
                        'active': false,
                        'push_enabled': ['romeo@montague.lit'],
                        'roster_cached': true,
                    }),
                );

                const muc_jid = 'lounge@montague.lit';
                const chatkey = `converse.chatboxes-romeo@montague.lit-${muc_jid}`;
                sessionStorage.setItem('converse.chatboxes-romeo@montague.lit', JSON.stringify([chatkey]));
                sessionStorage.setItem(
                    chatkey,
                    JSON.stringify({
                        hidden: false,
                        message_type: 'groupchat',
                        name: 'lounge',
                        num_unread: 0,
                        type: 'chatroom',
                        jid: muc_jid,
                        id: muc_jid,
                        box_id: 'box-YXJnQGNvbmZlcmVuY2UuY2hhdC5leGFtcGxlLm9yZw==',
                        nick: 'romeo',
                    }),
                );

                const proto = Object.getPrototypeOf(api.connection.get());
                const _changeConnectStatus = proto._changeConnectStatus;
                let count = 0;
                spyOn(proto, '_changeConnectStatus').and.callFake((status) => {
                    if (status === Strophe.Status.CONNECTED && count === 0) {
                        // Don't trigger CONNECTED
                        count++;
                        return;
                    }
                    _changeConnectStatus.call(api.connection.get(), status);
                });

                await api.user.login('romeo@montague.lit', 'secret');
                const conn = api.connection.get();

                const { sent_stanzas } = conn;
                const stanza = await u.waitUntil(() => sent_stanzas.filter((s) => s.tagName === 'resume').pop());
                expect(stanza).toEqualStanza(stx`<resume h="580" previd="some-long-sm-id" xmlns="urn:xmpp:sm:3"/>`);

                const result = stx`<resumed
                    xmlns="urn:xmpp:sm:3"
                    h="another-sequence-number"
                    previd="some-long-sm-id"/>`;
                conn._dataRecv(mock.createRequest(_converse, result));
                expect(conn.isStreamManagementEnabled()).toBe(true);
                expect(conn.jid).toBe('romeo@montague.lit/converse.js-100020907');

                const nick = 'romeo';
                const func = _converse.chatboxes.onChatBoxesFetched;
                spyOn(_converse.chatboxes, 'onChatBoxesFetched').and.callFake((collection) => {
                    const muc = new _converse.ChatRoom(
                        { 'jid': muc_jid, 'id': muc_jid, nick },
                        { 'collection': _converse.chatboxes },
                    );
                    _converse.chatboxes.add(muc);
                    func.call(_converse.chatboxes, collection);
                });

                // A MUC message gets received
                const msg = stx`
                    <message from="${muc_jid}/juliet"
                             id="${u.getUniqueId()}"
                             to="romeo@montague.lit"
                             type="groupchat"
                             xmlns="jabber:client">
                        <body>First message</body>
                    </message>`;

                conn._dataRecv(mock.createRequest(_converse, msg));

                // Release the held-back CONNECTED. With native SM there is
                // exactly one CONNECTED emission (on <resumed/>) (the old
                // plugin's blocked bind produced a second one) so the spy
                // suppressed it above to let the MUC message arrive first,
                // and we re-emit it here.
                conn._changeConnectStatus(Strophe.Status.CONNECTED, null);

                await api.waitUntil('chatBoxesFetched');
                const muc = _converse.chatboxes.get(muc_jid);
                await mock.waitForMUCDiscoInfo(_converse, muc_jid);
                await mock.receiveOwnMUCPresence(_converse, muc_jid, nick);
                await u.waitUntil(() => muc.session.get('connection_status') === converse.ROOMSTATUS.ENTERED);
                await muc.messages.fetched;
                await u.waitUntil(() => muc.messages.length);
                expect(muc.messages.at(0).get('message')).toBe('First message');
            },
        ),
    );
});
