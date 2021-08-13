/*global mock */


const original_timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;

describe("A sent presence stanza", function () {

    beforeEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = 7000));
    afterEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = original_timeout));

    it("includes a entity capabilities node",
            mock.initConverse([], {}, async (_converse) => {

        await mock.waitForRoster(_converse, 'current', 0);
        _converse.api.disco.own.identities.clear();
        _converse.api.disco.own.features.clear();

        _converse.api.disco.own.identities.add("client", "pc", "Exodus 0.9.1");
        _converse.api.disco.own.features.add("http://jabber.org/protocol/caps");
        _converse.api.disco.own.features.add("http://jabber.org/protocol/disco#info");
        _converse.api.disco.own.features.add("http://jabber.org/protocol/disco#items");
        _converse.api.disco.own.features.add("http://jabber.org/protocol/muc");

        const presence = await _converse.xmppstatus.constructPresence();
        expect(presence.toLocaleString()).toBe(
            `<presence xmlns="jabber:client">`+
                `<priority>0</priority>`+
                `<c hash="sha-1" node="https://conversejs.org" ver="QgayPKawpkPSDYmwT/WM94uAlu0=" xmlns="http://jabber.org/protocol/caps"/>`+
            `</presence>`)
    }));

    it("has a given priority", mock.initConverse(['statusInitialized'], {}, async (_converse) => {
        const { api } = _converse;
        let pres = await _converse.xmppstatus.constructPresence('online', null, 'Hello world');
        expect(pres.toLocaleString()).toBe(
            `<presence xmlns="jabber:client">`+
                `<status>Hello world</status>`+
                `<priority>0</priority>`+
                `<c hash="sha-1" node="https://conversejs.org" ver="TfHz9vOOfqIG0Z9lW5CuPaWGnrQ=" xmlns="http://jabber.org/protocol/caps"/>`+
            `</presence>`
        );

        api.settings.set('priority', 2);
        pres = await _converse.xmppstatus.constructPresence('away', null, 'Going jogging');
        expect(pres.toLocaleString()).toBe(
            `<presence xmlns="jabber:client">`+
                `<show>away</show>`+
                `<status>Going jogging</status>`+
                `<priority>2</priority>`+
                `<c hash="sha-1" node="https://conversejs.org" ver="TfHz9vOOfqIG0Z9lW5CuPaWGnrQ=" xmlns="http://jabber.org/protocol/caps"/>`+
            `</presence>`
        );

        api.settings.set('priority', undefined);
        pres = await _converse.xmppstatus.constructPresence('dnd', null, 'Doing taxes');
        expect(pres.toLocaleString()).toBe(
            `<presence xmlns="jabber:client">`+
                `<show>dnd</show>`+
                `<status>Doing taxes</status>`+
                `<priority>0</priority>`+
                `<c hash="sha-1" node="https://conversejs.org" ver="TfHz9vOOfqIG0Z9lW5CuPaWGnrQ=" xmlns="http://jabber.org/protocol/caps"/>`+
            `</presence>`
        );
    }));
});
