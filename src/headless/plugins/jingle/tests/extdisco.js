import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx, sizzle, u } = converse.env;
const { getIceServers, serviceToIceServer } = converse.env.u.jingle;
const EXTDISCO = 'urn:xmpp:extdisco:2';

/**
 * Wait for the `nth` outbound XEP-0215 query of the given kind (`services` or
 * `credentials`) and answer it with `children`.
 * @returns {Promise<Element>} the query
 */
async function answerExtdisco(_converse, kind, children, nth = 0) {
    const conn = _converse.api.connection.get();
    const sent = await u.waitUntil(
        () => conn.IQ_stanzas.filter((iq) => sizzle(`${kind}[xmlns="${EXTDISCO}"]`, iq).length)[nth],
    );
    const payload =
        kind === 'services'
            ? stx`<services xmlns="${EXTDISCO}">${children}</services>`
            : stx`<credentials xmlns="${EXTDISCO}">${children}</credentials>`;
    const result = stx`
        <iq xmlns="jabber:client" type="result" from="${_converse.domain}" to="${conn.jid}" id="${sent.getAttribute('id')}">
            ${payload}
        </iq>`;
    conn._dataRecv(mock.createRequest(_converse, result));
    return sent;
}

const answerServices = (_converse, services, nth) => answerExtdisco(_converse, 'services', services, nth);

/** Answer the `nth` outbound <services> query with an error. */
async function failServices(_converse, nth = 0) {
    const conn = _converse.api.connection.get();
    const sent = await u.waitUntil(
        () => conn.IQ_stanzas.filter((iq) => sizzle(`services[xmlns="${EXTDISCO}"]`, iq).length)[nth],
    );
    const error = stx`
        <iq xmlns="jabber:client" type="error" from="${_converse.domain}" to="${conn.jid}" id="${sent.getAttribute('id')}">
            <error type="wait"><internal-server-error xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error>
        </iq>`;
    conn._dataRecv(mock.createRequest(_converse, error));
}

async function confirmExtdisco(_converse) {
    await mock.waitUntilDiscoConfirmed(_converse, _converse.domain, [{ category: 'server', type: 'IM' }], [EXTDISCO]);
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

            await u.waitUntil(() => _converse.state.ice_servers?.servers.length);
            expect(_converse.state.ice_servers.servers).toEqual([
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
            expect(_converse.state.ice_servers.servers).toEqual([]);

            const conn = _converse.api.connection.get();
            expect(conn.IQ_stanzas.some((iq) => sizzle(`services[xmlns="${EXTDISCO}"]`, iq).length)).toBe(false);
        })
    );
});

describe('XEP-0215 credentials', function () {
    it(
        'are requested for a restricted relay that was advertised without them',
        mock.initConverse(converse, ['discoInitialized'], {}, async function (_converse) {
            await confirmExtdisco(_converse);
            await answerServices(
                _converse,
                stx`<service host="turn.montague.lit" port="3478" transport="udp" type="turn" restricted="true"/>`,
            );

            const request = await answerExtdisco(
                _converse,
                'credentials',
                stx`<service host="turn.montague.lit" port="3478" type="turn" username="romeo" password="s3cret"/>`,
            );
            const service = sizzle(`credentials > service`, request).pop();
            expect(service.getAttribute('host')).toBe('turn.montague.lit');
            expect(service.getAttribute('type')).toBe('turn');
            expect(service.getAttribute('port')).toBe('3478');

            await u.waitUntil(() => _converse.state.ice_servers?.servers.length);
            expect(_converse.state.ice_servers.servers).toEqual([
                { urls: 'turn:turn.montague.lit:3478?transport=udp', username: 'romeo', credential: 's3cret' },
            ]);
        }),
    );

    it(
        'are fetched again for a call once they are about to expire',
        mock.initConverse(converse, ['discoInitialized'], {}, async function (_converse) {
            await confirmExtdisco(_converse);
            const soon = new Date(Date.now() + 30_000).toISOString();
            await answerServices(
                _converse,
                stx`<service host="turn.montague.lit" port="3478" transport="udp" type="turn"
                        username="old" password="old" expires="${soon}"/>`,
            );
            await u.waitUntil(() => _converse.state.ice_servers?.servers.length);

            const servers = getIceServers();
            const later = new Date(Date.now() + 3_600_000).toISOString();
            await answerServices(
                _converse,
                stx`<service host="turn.montague.lit" port="3478" transport="udp" type="turn"
                        username="new" password="new" expires="${later}"/>`,
                1,
            );

            expect(await servers).toEqual([
                { urls: 'turn:turn.montague.lit:3478?transport=udp', username: 'new', credential: 'new' },
            ]);
            // Valid for another hour: the next call reuses them.
            const conn = _converse.api.connection.get();
            const queries = () => conn.IQ_stanzas.filter((iq) => sizzle(`services[xmlns="${EXTDISCO}"]`, iq)).length;
            const before = queries();
            expect((await getIceServers())[0].username).toBe('new');
            expect(queries()).toBe(before);
        }),
    );
});

describe('A failed XEP-0215 query', function () {
    it(
        'on connecting is tried again by the next call',
        mock.initConverse(converse, ['discoInitialized'], {}, async function (_converse) {
            await confirmExtdisco(_converse);
            await failServices(_converse);
            await u.waitUntil(() => _converse.state.ice_servers !== undefined);
            expect(_converse.state.ice_servers.servers).toEqual([]);

            const servers = getIceServers();
            await answerServices(
                _converse,
                stx`<service host="stun.montague.lit" port="3478" transport="udp" type="stun"/>`,
                1,
            );
            expect(await servers).toEqual([{ urls: 'stun:stun.montague.lit:3478' }]);
        }),
    );

    it(
        'for fresh credentials keeps the servers it had, and is tried again by the next call',
        mock.initConverse(converse, ['discoInitialized'], {}, async function (_converse) {
            await confirmExtdisco(_converse);
            const soon = new Date(Date.now() + 30_000).toISOString();
            await answerServices(
                _converse,
                stx`
                    <service host="stun.montague.lit" port="3478" transport="udp" type="stun"/>
                    <service host="turn.montague.lit" port="3478" transport="udp" type="turn"
                        username="old" password="old" expires="${soon}"/>`,
            );
            await u.waitUntil(() => _converse.state.ice_servers?.servers.length);
            const old_servers = _converse.state.ice_servers.servers;

            const first = getIceServers();
            await failServices(_converse, 1);
            expect(await first).toEqual(old_servers);

            const second = getIceServers();
            const later = new Date(Date.now() + 3_600_000).toISOString();
            await answerServices(
                _converse,
                stx`<service host="turn.montague.lit" port="3478" transport="udp" type="turn"
                        username="new" password="new" expires="${later}"/>`,
                2,
            );
            expect((await second)[0].username).toBe('new');
        }),
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
