import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { Strophe, stx, u, sizzle } = converse.env;

const original_timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;

/**
 * Wait until the caps advertised by `full_jid` have been stored on its resource.
 * @param {any} _converse
 * @param {string} full_jid
 */
function waitForCaps(_converse, full_jid) {
    const bare = Strophe.getBareJidFromJid(full_jid);
    const resource = Strophe.getResourceFromJid(full_jid);
    return u.waitUntil(() => _converse.state.presences.get(bare)?.resources.get(resource)?.get('caps'));
}

describe('A sent presence stanza', function () {
    beforeEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = 7000));
    afterEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = original_timeout));

    it(
        'includes an entity capabilities node',
        mock.initConverse(converse, [], {}, async (_converse) => {
            await mock.waitForRoster(_converse, 'current', 0);
            _converse.api.disco.own.identities.clear();
            _converse.api.disco.own.features.clear();

            _converse.api.disco.own.identities.add('client', 'pc', 'Exodus 0.9.1');
            _converse.api.disco.own.features.add('http://jabber.org/protocol/caps');
            _converse.api.disco.own.features.add('http://jabber.org/protocol/disco#info');
            _converse.api.disco.own.features.add('http://jabber.org/protocol/disco#items');
            _converse.api.disco.own.features.add('http://jabber.org/protocol/muc');

            const { profile } = _converse.state;

            const presence = await profile.constructPresence();
            expect(presence.node).toEqualStanza(stx`
            <presence xmlns="jabber:client">
                <priority>0</priority>
                <x xmlns="vcard-temp:x:update"/>
                <c hash="sha-1"
                    node="https://conversejs.org"
                    ver="QgayPKawpkPSDYmwT/WM94uAlu0="
                    xmlns="http://jabber.org/protocol/caps"/>
            </presence>`);
        }),
    );

    it(
        'has a given priority',
        mock.initConverse(converse, ['statusInitialized'], {}, async (_converse) => {
            const { api } = _converse;
            const { profile } = _converse.state;
            let pres = await profile.constructPresence({ status: 'Hello world' });
            expect(pres.node).toEqualStanza(stx`
                <presence xmlns="jabber:client">
                    <status>Hello world</status>
                    <priority>0</priority>
                    <x xmlns="vcard-temp:x:update"/>
                    <c hash="sha-1"
                        node="https://conversejs.org"
                        ver="xqrvXUjvW3ZKAuQ9ZRYZqosP7wE="
                        xmlns="http://jabber.org/protocol/caps"/>
                </presence>`);

            api.settings.set('priority', 2);
            pres = await profile.constructPresence({ show: 'away', status: 'Going jogging' });
            expect(pres.node).toEqualStanza(stx`
            <presence xmlns="jabber:client">
                <show>away</show>
                <status>Going jogging</status>
                <priority>2</priority>
                <x xmlns="vcard-temp:x:update"/>
                <c hash="sha-1" node="https://conversejs.org" ver="xqrvXUjvW3ZKAuQ9ZRYZqosP7wE=" xmlns="http://jabber.org/protocol/caps"/>
            </presence>`);

            api.settings.set('priority', undefined);
            pres = await profile.constructPresence({ show: 'dnd', status: 'Doing taxes' });
            expect(pres.node).toEqualStanza(stx`
            <presence xmlns="jabber:client">
                <show>dnd</show>
                <status>Doing taxes</status>
                <priority>0</priority>
                <x xmlns="vcard-temp:x:update"/>
                <c hash="sha-1" node="https://conversejs.org" ver="xqrvXUjvW3ZKAuQ9ZRYZqosP7wE=" xmlns="http://jabber.org/protocol/caps"/>
            </presence>`);
        }),
    );

    it(
        'omits a redundant capabilities node when the server supports Caps Optimization',
        mock.initConverse(converse, ['statusInitialized'], {}, async (_converse) => {
            const { api } = _converse;
            const { profile } = _converse.state;
            const ns = 'http://jabber.org/protocol/caps';

            // Simulate a server that supports Caps Optimization (§ 8.4). The
            // connection-time detection never overwrites this here: the mock
            // server doesn't answer disco#info for the domain, so its support
            // check stays pending and leaves caps_optimize untouched.
            _converse.state.caps_optimize = true;
            _converse.state.caps_last_sent_ver = null;

            // The first broadcast presence must carry the annotation so the
            // server learns our caps.
            let pres = await profile.constructPresence({ status: 'online' });
            expect(sizzle(`c[xmlns="${ns}"]`, pres.node).length).toBe(1);

            // A subsequent presence with an unchanged `ver` omits the redundant <c/>.
            pres = await profile.constructPresence({ status: 'still online' });
            expect(sizzle(`c[xmlns="${ns}"]`, pres.node).length).toBe(0);

            // When our capabilities change (new `ver`), it is advertised again...
            api.disco.own.features.add('urn:example:caps-optimization-test');
            pres = await profile.constructPresence({ status: 'online again' });
            expect(sizzle(`c[xmlns="${ns}"]`, pres.node).length).toBe(1);

            // ...and omitted again on the next unchanged presence.
            pres = await profile.constructPresence({ status: 'yet again' });
            expect(sizzle(`c[xmlns="${ns}"]`, pres.node).length).toBe(0);
        }),
    );

    it(
        'always annotates directed presence even when optimization is active',
        mock.initConverse(converse, ['statusInitialized'], {}, async (_converse) => {
            const { profile } = _converse.state;
            const ns = 'http://jabber.org/protocol/caps';

            _converse.state.caps_optimize = true;
            _converse.state.caps_last_sent_ver = null;

            // A broadcast presence records the ver and is then optimized away
            // on the next unchanged broadcast.
            let pres = await profile.constructPresence({ status: 'online' });
            expect(sizzle(`c[xmlns="${ns}"]`, pres.node).length).toBe(1);
            pres = await profile.constructPresence({ status: 'still online' });
            expect(sizzle(`c[xmlns="${ns}"]`, pres.node).length).toBe(0);

            // Directed presence (with a `to`) is never optimized: § 8.4
            // broadcast stripping doesn't apply to it, so the recipient — who
            // may not be a presence subscriber — must still receive our caps.
            pres = await profile.constructPresence({ to: 'mercutio@montague.lit', status: 'still online' });
            expect(sizzle(`c[xmlns="${ns}"]`, pres.node).length).toBe(1);

            // It also leaves the broadcast send-side state untouched, so the
            // next unchanged broadcast is still optimized away.
            pres = await profile.constructPresence({ status: 'still online' });
            expect(sizzle(`c[xmlns="${ns}"]`, pres.node).length).toBe(0);
        }),
    );
});

describe('A received presence stanza', function () {
    it(
        "has the sender's entity capabilities added to the parsed attributes",
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current');

            const contact_jid = mock.cur_names[5].replace(/ /g, '.').toLowerCase() + '@montague.lit';

            let parsed;
            api.listen.on('parsePresence', (_stanza, attrs) => {
                parsed = attrs;
                return attrs;
            });

            let stanza = stx`
                <presence xmlns="jabber:client"
                        to="romeo@montague.lit/converse.js-21770972"
                        from="${contact_jid}/resource">
                    <priority>1</priority>
                    <c xmlns="http://jabber.org/protocol/caps"
                        hash="sha-1"
                        node="http://conversations.im"
                        ver="QgayPKawpkPSDYmwT/WM94uAlu0="/>
                </presence>`;
            api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            await u.waitUntil(() => parsed !== undefined);
            expect(parsed.caps).toEqual({
                hash: 'sha-1',
                node: 'http://conversations.im',
                ver: 'QgayPKawpkPSDYmwT/WM94uAlu0=',
            });

            // without entity capabilities leaves the parsed attributes unchanged
            stanza = stx`
                <presence xmlns="jabber:client"
                        to="romeo@montague.lit/converse.js-21770972"
                        from="${contact_jid}/resource">
                    <priority>1</priority>
                </presence>`;
            api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            await u.waitUntil(() => parsed.caps === undefined);
            expect(parsed.caps).toBeUndefined();
        }),
    );

    it(
        'is forgotten when the advertising resource goes offline',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current');

            const contact_jid = mock.cur_names[7].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const contact = await api.contacts.get(contact_jid);

            api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                <presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="${contact_jid}/resource">
                    <priority>1</priority>
                    <c xmlns="http://jabber.org/protocol/caps"
                        hash="sha-1" node="http://conversations.im" ver="QgayPKawpkPSDYmwT/WM94uAlu0="/>
                </presence>`,
                ),
            );

            await u.waitUntil(() => contact.presence.resources.get('resource')?.get('caps'));

            // An unavailable presence drops the resource, so its caps are forgotten.
            api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<presence xmlns="jabber:client" type="unavailable"
                        to="romeo@montague.lit/orchard" from="${contact_jid}/resource"/>`,
                ),
            );

            await u.waitUntil(() => !contact.presence.resources.get('resource'));
        }),
    );

    it(
        'is persisted on the presence resource so it survives a reload',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current');

            const contact_jid = mock.cur_names[4].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const contact = await api.contacts.get(contact_jid);
            const caps = { hash: 'sha-1', node: 'http://conversations.im', ver: 'QgayPKawpkPSDYmwT/WM94uAlu0=' };

            api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                <presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="${contact_jid}/phone">
                    <priority>1</priority>
                    <c xmlns="http://jabber.org/protocol/caps" hash="${caps.hash}" node="${caps.node}" ver="${caps.ver}"/>
                </presence>`,
                ),
            );

            const resource = await u.waitUntil(() => contact.presence.resources.get('phone'));
            // The advertised caps are stored on the resource (session storage),
            // so a reload can rehydrate them...
            expect(resource.get('caps')).toEqual(caps);
            // ...from a store distinct from the disco entity's identities store,
            // which would otherwise collide on the contact's bare JID.
            expect(contact.presence.resources.storage.name).toBe(`converse.resources-${contact_jid}`);
        }),
    );
});

describe('The entity capabilities cache', function () {
    it(
        'stores and retrieves verified disco info keyed by hash and ver',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            await api.waitUntil('capsInitialized');

            const cache = _converse.state.caps_cache;
            expect(cache.getCachedInfo('sha-1', 'QgayPKawpkPSDYmwT/WM94uAlu0=')).toBeUndefined();

            const caps = { hash: 'sha-1', node: 'http://conversations.im', ver: 'QgayPKawpkPSDYmwT/WM94uAlu0=' };
            const info = {
                identities: [{ category: 'client', type: 'pc', name: 'Conversations' }],
                features: ['http://jabber.org/protocol/muc', 'urn:xmpp:ping'],
                dataforms: [],
            };
            cache.store(caps, info);

            const cached = cache.getCachedInfo('sha-1', 'QgayPKawpkPSDYmwT/WM94uAlu0=');
            expect(cached).toBeDefined();
            // It's keyed by `${hash}/${ver}`, independently of the node.
            expect(cached).toBe(cache.get('sha-1/QgayPKawpkPSDYmwT/WM94uAlu0='));
            expect(cached.get('node')).toBe('http://conversations.im');
            expect(cached.get('features')).toEqual(['http://jabber.org/protocol/muc', 'urn:xmpp:ping']);
            expect(cached.get('identities')).toEqual([{ category: 'client', type: 'pc', name: 'Conversations' }]);
        }),
    );

    it(
        'updates an existing entry instead of duplicating it',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            await api.waitUntil('capsInitialized');

            const cache = _converse.state.caps_cache;
            const caps = { hash: 'sha-1', node: 'http://conversations.im', ver: 'abc=' };

            cache.store(caps, { identities: [], features: ['urn:xmpp:ping'], dataforms: [] });
            cache.store(caps, { identities: [], features: ['urn:xmpp:ping', 'urn:xmpp:time'], dataforms: [] });

            expect(cache.length).toBe(1);
            expect(cache.getCachedInfo('sha-1', 'abc=').get('features')).toEqual(['urn:xmpp:ping', 'urn:xmpp:time']);
        }),
    );

    it(
        'evicts least-recently-used entries when over the size limit',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            await api.waitUntil('capsInitialized');

            const cache = _converse.state.caps_cache;
            api.settings.set('caps_cache_size', 3);

            const put = (ver) =>
                cache.store(
                    { hash: 'sha-1', node: 'https://conversejs.org', ver },
                    { identities: [], features: [], dataforms: [] },
                );

            put('a');
            put('b');
            put('c');
            // Give the three entries an explicit recency ordering: a < b < c.
            cache.get('sha-1/a').set('last_used', 10);
            cache.get('sha-1/b').set('last_used', 20);
            cache.get('sha-1/c').set('last_used', 30);

            // A fourth entry pushes us over the limit, evicting the coldest ('a').
            put('d');
            expect(cache.length).toBe(3);
            expect(cache.get('sha-1/a')).toBeUndefined();
            ['b', 'c', 'd'].forEach((v) => expect(cache.get(`sha-1/${v}`)).toBeDefined());

            // Reading 'b' refreshes its recency, so the next overflow evicts 'c'.
            cache.getCachedInfo('sha-1', 'b');
            put('e');
            expect(cache.length).toBe(3);
            expect(cache.get('sha-1/c')).toBeUndefined();
            ['b', 'd', 'e'].forEach((v) => expect(cache.get(`sha-1/${v}`)).toBeDefined());
        }),
    );
});

describe('XEP-0115 disco integration', function () {
    /**
     * Waits for a disco#info query to the given JID and returns the sent <iq>.
     * @param {object} _converse
     * @param {string} jid
     */
    async function waitForDiscoInfoQuery(_converse, jid) {
        const { IQ_stanzas } = _converse.api.connection.get();
        const sel = `iq[to="${jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`;
        await u.waitUntil(() => IQ_stanzas.filter((iq) => sizzle(sel, iq).length).length);
        return IQ_stanzas.find((iq) => sizzle(sel, iq).length);
    }

    it(
        'queries with the caps node, verifies and caches the result on a cache miss',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            await mock.waitForRoster(_converse, 'current');
            await api.waitUntil('capsInitialized');

            const contact_jid = mock.cur_names[5].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const full_jid = `${contact_jid}/exodus`;
            const node = 'http://code.google.com/p/exodus';
            const ver = 'QgayPKawpkPSDYmwT/WM94uAlu0=';

            // 1. Receive presence advertising caps we haven't seen before.
            connection._dataRecv(
                mock.createRequest(_converse, stx`
                <presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="${full_jid}">
                    <c xmlns="http://jabber.org/protocol/caps" hash="sha-1" node="${node}" ver="${ver}"/>
                </presence>`),
            );
            await waitForCaps(_converse, full_jid);

            // 2. Asking disco about the JID triggers a disco#info query (cache miss).
            api.disco.entities.get(full_jid, true);
            const iq = await waitForDiscoInfoQuery(_converse, full_jid);

            // 3. The query carries the caps node (XEP-0115 § 6.2).
            expect(sizzle(`iq[to="${full_jid}"] query`, iq).pop().getAttribute('node')).toBe(`${node}#${ver}`);

            // 4. Respond with the matching disco#info (XEP-0115 § 5.2 example).
            const id = connection.IQ_ids[connection.IQ_stanzas.indexOf(iq)];
            connection._dataRecv(
                mock.createRequest(_converse, stx`
                <iq xmlns="jabber:client" type="result" from="${full_jid}" to="romeo@montague.lit/orchard" id="${id}">
                    <query xmlns="http://jabber.org/protocol/disco#info" node="${node}#${ver}">
                        <identity category="client" type="pc" name="Exodus 0.9.1"/>
                        <feature var="http://jabber.org/protocol/caps"/>
                        <feature var="http://jabber.org/protocol/disco#info"/>
                        <feature var="http://jabber.org/protocol/disco#items"/>
                        <feature var="http://jabber.org/protocol/muc"/>
                    </query>
                </iq>`),
            );

            // 5. The verified result is cached.
            await u.waitUntil(() => _converse.state.caps_cache.getCachedInfo('sha-1', ver));
            const cached = _converse.state.caps_cache.getCachedInfo('sha-1', ver);
            expect(cached.get('node')).toBe(node);
            expect(cached.get('features')).toContain('http://jabber.org/protocol/muc');
        }),
    );

    it(
        'verifies and caches caps that include a XEP-0128 data form',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            await mock.waitForRoster(_converse, 'current');
            await api.waitUntil('capsInitialized');

            const contact_jid = mock.cur_names[6].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const full_jid = `${contact_jid}/psi`;
            const node = 'http://psi-im.org';
            const ver = 'q07IKJEyjvHSyhy//CH0CxmKi8w=';

            connection._dataRecv(
                mock.createRequest(_converse, stx`
                <presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="${full_jid}">
                    <c xmlns="http://jabber.org/protocol/caps" hash="sha-1" node="${node}" ver="${ver}"/>
                </presence>`),
            );
            await waitForCaps(_converse, full_jid);

            api.disco.entities.get(full_jid, true);
            const iq = await waitForDiscoInfoQuery(_converse, full_jid);
            const id = connection.IQ_ids[connection.IQ_stanzas.indexOf(iq)];

            // XEP-0115 § 5.3 complex example (multiple identities + a data form).
            connection._dataRecv(
                mock.createRequest(_converse, stx`
                <iq xmlns="jabber:client" type="result" from="${full_jid}" to="romeo@montague.lit/orchard" id="${id}">
                    <query xmlns="http://jabber.org/protocol/disco#info" node="${node}#${ver}">
                        <identity xml:lang="en" category="client" name="Psi 0.11" type="pc"/>
                        <identity xml:lang="el" category="client" name="Ψ 0.11" type="pc"/>
                        <feature var="http://jabber.org/protocol/caps"/>
                        <feature var="http://jabber.org/protocol/disco#info"/>
                        <feature var="http://jabber.org/protocol/disco#items"/>
                        <feature var="http://jabber.org/protocol/muc"/>
                        <x xmlns="jabber:x:data" type="result">
                            <field var="FORM_TYPE" type="hidden"><value>urn:xmpp:dataforms:softwareinfo</value></field>
                            <field var="ip_version" type="text-multi"><value>ipv4</value><value>ipv6</value></field>
                            <field var="os"><value>Mac</value></field>
                            <field var="os_version"><value>10.5.1</value></field>
                            <field var="software"><value>Psi</value></field>
                            <field var="software_version"><value>0.11</value></field>
                        </x>
                    </query>
                </iq>`),
            );

            await u.waitUntil(() => _converse.state.caps_cache.getCachedInfo('sha-1', ver));
            const cached = _converse.state.caps_cache.getCachedInfo('sha-1', ver);
            expect(cached.get('features')).toContain('http://jabber.org/protocol/muc');
            expect(cached.get('dataforms').length).toBe(1);
        }),
    );

    it(
        'populates a disco entity from the cache without querying on a cache hit',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            await mock.waitForRoster(_converse, 'current');
            await api.waitUntil('capsInitialized');

            const node = 'http://code.google.com/p/exodus';
            const ver = 'QgayPKawpkPSDYmwT/WM94uAlu0=';
            _converse.state.caps_cache.store(
                { hash: 'sha-1', node, ver },
                {
                    identities: [{ category: 'client', type: 'pc', name: 'Exodus 0.9.1' }],
                    features: ['http://jabber.org/protocol/muc'],
                    dataforms: [],
                },
            );

            const contact_jid = mock.cur_names[7].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const full_jid = `${contact_jid}/exodus`;
            connection._dataRecv(
                mock.createRequest(_converse, stx`
                <presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="${full_jid}">
                    <c xmlns="http://jabber.org/protocol/caps" hash="sha-1" node="${node}" ver="${ver}"/>
                </presence>`),
            );
            await waitForCaps(_converse, full_jid);

            const supported = await api.disco.supports('http://jabber.org/protocol/muc', full_jid);
            expect(supported).toBe(true);

            // No disco#info query was sent for this JID.
            const sel = `iq[to="${full_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`;
            expect(connection.IQ_stanzas.filter((iq) => sizzle(sel, iq).length).length).toBe(0);
        }),
    );

    it(
        'restores XEP-0128 field values from the cache but not the typed dataforms collection',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            await mock.waitForRoster(_converse, 'current');
            await api.waitUntil('capsInitialized');

            const node = 'http://psi-im.org';
            const ver = 'cached-with-form=';
            // The cached dataforms carry field values but no field `type`,
            // because `type` is not part of the XEP-0115 verification hash.
            _converse.state.caps_cache.store(
                { hash: 'sha-1', node, ver },
                {
                    identities: [{ category: 'client', type: 'pc', name: 'Psi' }],
                    features: ['http://jabber.org/protocol/muc'],
                    dataforms: [
                        {
                            FORM_TYPE: ['urn:xmpp:dataforms:softwareinfo'],
                            os: ['Mac'],
                            software: ['Psi'],
                        },
                    ],
                },
            );

            const contact_jid = mock.cur_names[6].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const full_jid = `${contact_jid}/psi`;
            connection._dataRecv(
                mock.createRequest(_converse, stx`
                <presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="${full_jid}">
                    <c xmlns="http://jabber.org/protocol/caps" hash="sha-1" node="${node}" ver="${ver}"/>
                </presence>`),
            );
            await waitForCaps(_converse, full_jid);

            // The flattened XEP-0128 field values are restored and exposed via getFields.
            const fields = await api.disco.getFields(full_jid);
            expect(fields.findWhere({ var: 'software' })?.get('value')).toBe('Psi');
            expect(fields.findWhere({ var: 'os' })?.get('value')).toBe('Mac');

            // ...but the typed per-form `dataforms` collection is left empty,
            // since the cache can't vouch for field types (not hashed into ver).
            const entity = await api.disco.entities.get(full_jid);
            expect(entity.dataforms.length).toBe(0);

            // ...and still no disco#info query was needed.
            const sel = `iq[to="${full_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`;
            expect(connection.IQ_stanzas.filter((iq) => sizzle(sel, iq).length).length).toBe(0);
        }),
    );

    it(
        'does not cache a response whose hash does not match the advertised ver',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            await mock.waitForRoster(_converse, 'current');
            await api.waitUntil('capsInitialized');

            const contact_jid = mock.cur_names[8].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const full_jid = `${contact_jid}/spoofed`;
            const node = 'http://spoofed.example';
            const ver = 'AAAAAAAAAAAAAAAAAAAAAAAAAAA='; // does not match the response

            connection._dataRecv(
                mock.createRequest(_converse, stx`
                <presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="${full_jid}">
                    <c xmlns="http://jabber.org/protocol/caps" hash="sha-1" node="${node}" ver="${ver}"/>
                </presence>`),
            );
            await waitForCaps(_converse, full_jid);

            api.disco.entities.get(full_jid, true);
            const iq = await waitForDiscoInfoQuery(_converse, full_jid);
            const id = connection.IQ_ids[connection.IQ_stanzas.indexOf(iq)];
            connection._dataRecv(
                mock.createRequest(_converse, stx`
                <iq xmlns="jabber:client" type="result" from="${full_jid}" to="romeo@montague.lit/orchard" id="${id}">
                    <query xmlns="http://jabber.org/protocol/disco#info" node="${node}#${ver}">
                        <identity category="client" type="pc" name="Exodus 0.9.1"/>
                        <feature var="http://jabber.org/protocol/muc"/>
                    </query>
                </iq>`),
            );

            // The live result is still usable for this JID...
            expect(await api.disco.supports('http://jabber.org/protocol/muc', full_jid)).toBe(true);
            // ...but the unverified ver is never cached.
            expect(_converse.state.caps_cache.getCachedInfo('sha-1', ver)).toBeUndefined();
        }),
    );
});
