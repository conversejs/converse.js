import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx } = converse.env;

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
