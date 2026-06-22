import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx, sizzle, u } = converse.env;
const { serviceToIceServer } = converse.env.jingle;
const EXTDISCO = 'urn:xmpp:extdisco:2';

/** Wait for the outbound XEP-0215 <services> query and answer it with `services`. */
async function answerServices(_converse, services) {
    const conn = _converse.api.connection.get();
    const sent = await u.waitUntil(() =>
        conn.IQ_stanzas.find((iq) => sizzle(`services[xmlns="${EXTDISCO}"]`, iq).length)
    );
    const result = stx`
        <iq xmlns="jabber:client" type="result" from="${_converse.domain}" to="${conn.jid}" id="${sent.getAttribute('id')}">
            <services xmlns="${EXTDISCO}">${services}</services>
        </iq>`;
    conn._dataRecv(mock.createRequest(_converse, result));
}

describe('XEP-0215 external service discovery', function () {
    it(
        "caches the server's STUN/TURN services as ICE servers once connected",
        mock.initConverse(converse, ['discoInitialized'], {}, async function (_converse) {
            await mock.waitUntilDiscoConfirmed(
                _converse,
                _converse.domain,
                [{ category: 'server', type: 'IM' }],
                [EXTDISCO]
            );
            await answerServices(
                _converse,
                stx`
                    <service host="stun.montague.lit" port="3478" transport="udp" type="stun"/>
                    <service host="turn.montague.lit" port="3478" transport="udp"
                        type="turn" username="romeo" password="s3cret"/>
                    <service host="files.montague.lit" port="5000" type="ftp"/>`
            );

            await u.waitUntil(() => _converse.state.ice_servers?.length);
            expect(_converse.state.ice_servers).toEqual([
                { urls: 'stun:stun.montague.lit:3478' },
                { urls: 'turn:turn.montague.lit:3478?transport=udp', username: 'romeo', credential: 's3cret' },
            ]);
        })
    );

    it(
        'caches an empty list when the server does not advertise the feature',
        mock.initConverse(converse, ['discoInitialized'], {}, async function (_converse) {
            await mock.waitUntilDiscoConfirmed(_converse, _converse.domain, [{ category: 'server', type: 'IM' }], []);

            await u.waitUntil(() => _converse.state.ice_servers !== undefined);
            expect(_converse.state.ice_servers).toEqual([]);

            const conn = _converse.api.connection.get();
            expect(conn.IQ_stanzas.some((iq) => sizzle(`services[xmlns="${EXTDISCO}"]`, iq).length)).toBe(false);
        })
    );
});

describe('serviceToIceServer', function () {
    const service = (attrs) => {
        const s = document.createElementNS(null, 'service');
        Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
        return s;
    };

    it('drops non-ICE types, incomplete entries and missing/bad transport', function () {
        expect(serviceToIceServer(service({ host: 'h', port: '1', transport: 'udp', type: 'ftp' }))).toBe(null);
        expect(serviceToIceServer(service({ port: '1', transport: 'udp', type: 'stun' }))).toBe(null);
        expect(serviceToIceServer(service({ host: 'h', transport: 'udp', type: 'turn' }))).toBe(null);
        expect(serviceToIceServer(service({ host: 'h', port: '3478', type: 'stun' }))).toBe(null);
        expect(serviceToIceServer(service({ host: 'h', port: '3478', transport: 'sctp', type: 'stun' }))).toBe(null);
    });

    it('drops a relay without credentials and a TLS service over UDP', function () {
        // turn(s) with no username/password make RTCPeerConnection throw.
        expect(serviceToIceServer(service({ host: 'h', port: '3478', transport: 'udp', type: 'turn' }))).toBe(null);
        expect(
            serviceToIceServer(service({ host: 'h', port: '3478', transport: 'udp', type: 'turn', username: 'u' }))
        ).toBe(null);
        // TLS can't run over UDP.
        expect(serviceToIceServer(service({ host: 'h', port: '5349', transport: 'udp', type: 'turns' }))).toBe(null);
        expect(serviceToIceServer(service({ host: 'h', port: '5349', transport: 'udp', type: 'stuns' }))).toBe(null);
    });

    it('builds STUN URLs without a query and TURN URLs with the transport', function () {
        expect(serviceToIceServer(service({ host: 'h', port: '3478', transport: 'udp', type: 'stun' }))).toEqual({
            urls: 'stun:h:3478',
        });
        expect(
            serviceToIceServer(
                service({ host: 'h', port: '5349', transport: 'tcp', type: 'turns', username: 'u', password: 'p' })
            )
        ).toEqual({ urls: 'turns:h:5349?transport=tcp', username: 'u', credential: 'p' });
        expect(
            serviceToIceServer(
                service({ host: 'h', port: '3478', transport: 'udp', type: 'turn', username: 'u', password: 'p' })
            )
        ).toEqual({ urls: 'turn:h:3478?transport=udp', username: 'u', credential: 'p' });
    });

    it('brackets a raw IPv6 host', function () {
        expect(serviceToIceServer(service({ host: '2001:db8::1', port: '3478', transport: 'udp', type: 'stun' }))).toEqual({
            urls: 'stun:[2001:db8::1]:3478',
        });
        expect(
            serviceToIceServer(
                service({ host: '::1', port: '3478', transport: 'udp', type: 'turn', username: 'u', password: 'p' })
            )
        ).toEqual({ urls: 'turn:[::1]:3478?transport=udp', username: 'u', credential: 'p' });
    });
});
