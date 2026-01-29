/*global mock, converse */

const original_timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;

describe("A sent presence stanza", function () {

    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));
    beforeEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = 7000));
    afterEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = original_timeout));

    it("includes the saved status message",
        mock.initConverse([], {}, async (_converse) => {

        const { u, Strophe } = converse.env;
        mock.openControlBox(_converse);
        spyOn(_converse.api.connection.get(), 'send').and.callThrough();

        const cbview = await u.waitUntil(() => _converse.api.controlbox.get());
        const change_status_el = await u.waitUntil(() => cbview.querySelector('.change-status'));
        change_status_el.click()
        let modal = _converse.api.modal.get('converse-profile-modal');
        await u.waitUntil(() => u.isVisible(modal), 1000);
        const msg = 'My custom status';
        modal.querySelector('input[name="status_message"]').value = msg;
        modal.querySelector('[type="submit"]').click();

        const sent_stanzas = _converse.api.connection.get().sent_stanzas;
        let sent_presence = await u.waitUntil(() => sent_stanzas.filter(s => Strophe.serialize(s).match('presence')).pop());
        expect(sent_presence).toEqualStanza(stx`
            <presence xmlns="jabber:client">
                <status>My custom status</status>
                <priority>0</priority>
                <x xmlns="${Strophe.NS.VCARD_UPDATE}"></x>
                <c hash="sha-1" node="https://conversejs.org" ver="H63l6q0hnLTdpFJt2JA5AOAGl/o=" xmlns="http://jabber.org/protocol/caps"/>
            </presence>`)

        cbview.querySelector('.change-status').click()
        modal = _converse.api.modal.get('converse-profile-modal');
        await u.waitUntil(() => modal.getAttribute('aria-hidden') === "false", 1000);
        modal.querySelector('label[for="radio-busy"]').click(); // Change status to "dnd"
        modal.querySelector('[type="submit"]').click();

        await u.waitUntil(() => sent_stanzas.filter(s => Strophe.serialize(s).match('presence')).length === 2);
        sent_presence = sent_stanzas.filter(s => Strophe.serialize(s).match('presence')).pop();
        expect(sent_presence)
            .toEqualStanza(stx`
                <presence xmlns="jabber:client">
                    <show>dnd</show>
                    <status>My custom status</status>
                    <priority>0</priority>
                    <x xmlns="${Strophe.NS.VCARD_UPDATE}"></x>
                    <c hash="sha-1" node="https://conversejs.org" ver="H63l6q0hnLTdpFJt2JA5AOAGl/o=" xmlns="http://jabber.org/protocol/caps"/>
                </presence>`)
    }));
});
