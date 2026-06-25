import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx, u } = converse.env;

const original_timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;

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
                        ver="VQN2NgsmAtNozeP6nd9JHH3MIuE="
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
                <c hash="sha-1" node="https://conversejs.org" ver="VQN2NgsmAtNozeP6nd9JHH3MIuE=" xmlns="http://jabber.org/protocol/caps"/>
            </presence>`);

            api.settings.set('priority', undefined);
            pres = await profile.constructPresence({ show: 'dnd', status: 'Doing taxes' });
            expect(pres.node).toEqualStanza(stx`
            <presence xmlns="jabber:client">
                <show>dnd</show>
                <status>Doing taxes</status>
                <priority>0</priority>
                <x xmlns="vcard-temp:x:update"/>
                <c hash="sha-1" node="https://conversejs.org" ver="VQN2NgsmAtNozeP6nd9JHH3MIuE=" xmlns="http://jabber.org/protocol/caps"/>
            </presence>`);
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
        'is recorded in the in-memory caps map keyed by full JID',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current');

            const contact_jid = mock.cur_names[7].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const full_jid = `${contact_jid}/resource`;

            let stanza = stx`
                <presence xmlns="jabber:client"
                        to="romeo@montague.lit/converse.js-21770972"
                        from="${full_jid}">
                    <priority>1</priority>
                    <c xmlns="http://jabber.org/protocol/caps"
                        hash="sha-1"
                        node="http://conversations.im"
                        ver="QgayPKawpkPSDYmwT/WM94uAlu0="/>
                </presence>`;
            api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            await u.waitUntil(() => _converse.state.caps_map.has(full_jid));
            expect(_converse.state.caps_map.get(full_jid)).toEqual({
                hash: 'sha-1',
                node: 'http://conversations.im',
                ver: 'QgayPKawpkPSDYmwT/WM94uAlu0=',
            });

            // An unavailable presence removes the entry again
            stanza = stx`
                <presence xmlns="jabber:client" type="unavailable"
                        to="romeo@montague.lit/converse.js-21770972"
                        from="${full_jid}"/>`;
            api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            await u.waitUntil(() => !_converse.state.caps_map.has(full_jid));
            expect(_converse.state.caps_map.has(full_jid)).toBe(false);
        }),
    );
});
