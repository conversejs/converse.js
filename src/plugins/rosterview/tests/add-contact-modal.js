/*global mock, converse */
const u = converse.env.utils;
const Strophe = converse.env.Strophe;
const sizzle = converse.env.sizzle;

describe("The 'Add Contact' widget", function () {

    beforeEach(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it("opens up an add modal when you click on it",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'all');
        await mock.openControlBox(_converse);

        const cbview = _converse.chatboxviews.get('controlbox');

        const dropdown = await u.waitUntil(
            () => cbview.querySelector('.dropdown--contacts')
        );
        dropdown.querySelector('.add-contact').click()

        const modal = _converse.api.modal.get('converse-add-contact-modal');
        await u.waitUntil(() => u.isVisible(modal), 1000);
        expect(modal.querySelector('form.add-xmpp-contact')).not.toBe(null);

        const input_jid = modal.querySelector('input[name="jid"]');
        const input_name = modal.querySelector('input[name="name"]');
        input_jid.value = 'someone@';

        const groups_input = modal.querySelector('input[name="groups"]');
        groups_input.value = 'Friends, Countrymen';

        const evt = new Event('input');
        input_jid.dispatchEvent(evt);
        expect(modal.querySelector('.suggestion-box li').textContent).toBe('someone@montague.lit');
        input_jid.value = 'someone@montague.lit';
        input_name.value = 'Someone';
        modal.querySelector('button[type="submit"]').click();

        const sent_IQs = _converse.api.connection.get().IQ_stanzas;
        const sent_stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[type="set"] query[xmlns="${Strophe.NS.ROSTER}"]`)).pop());
        expect(sent_stanza).toEqualStanza(stx`
            <iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">
                <query xmlns="jabber:iq:roster">
                    <item jid="someone@montague.lit" name="Someone">
                        <group>Friends</group>
                        <group>Countrymen</group>
                    </item>
                </query>+
            </iq>`);
    }));

    it("can be configured to not provide search suggestions",
            mock.initConverse([], {'autocomplete_add_contact': false}, async function (_converse) {

        await mock.waitForRoster(_converse, 'all', 0);
        await mock.openControlBox(_converse);
        const cbview = _converse.chatboxviews.get('controlbox');
        cbview.querySelector('.add-contact').click()
        const modal = _converse.api.modal.get('converse-add-contact-modal');
        expect(modal.jid_auto_complete).toBe(undefined);
        expect(modal.name_auto_complete).toBe(undefined);

        await u.waitUntil(() => u.isVisible(modal), 1000);
        expect(modal.querySelector('form.add-xmpp-contact')).not.toBe(null);
        const input_jid = modal.querySelector('input[name="jid"]');
        input_jid.value = 'someone@montague.lit';
        modal.querySelector('button[type="submit"]').click();

        const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
        const sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle(`iq[type="set"] query[xmlns="${Strophe.NS.ROSTER}"]`, s).length).pop()
        );
        expect(Strophe.serialize(sent_stanza)).toEqual(
            `<iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                `<query xmlns="jabber:iq:roster"><item jid="someone@montague.lit"><group></group></item></query>`+
            `</iq>`
        );
    }));

    it("integrates with xhr_user_search_url to search for contacts",
            mock.initConverse([], { 'xhr_user_search_url': 'http://example.org/?' },
            async function (_converse) {

        await mock.waitForRoster(_converse, 'all', 0);

        spyOn(window, 'fetch').and.callFake(() => {
            const json = [
                {"jid": "marty@mcfly.net", "fullname": "Marty McFly"},
                {"jid": "doc@brown.com", "fullname": "Doc Brown"}
            ];
            return { json };
        });

        await mock.openControlBox(_converse);
        const cbview = _converse.chatboxviews.get('controlbox');
        cbview.querySelector('.add-contact').click()
        const modal = _converse.api.modal.get('converse-add-contact-modal');
        await u.waitUntil(() => u.isVisible(modal), 1000);

        // TODO: We only have autocomplete for the name input

        const input_el = modal.querySelector('input[name="name"]');
        input_el.value = 'marty';
        input_el.dispatchEvent(new Event('input'));
        await u.waitUntil(() => modal.querySelector('.suggestion-box li'), 1000);
        expect(modal.querySelectorAll('.suggestion-box li').length).toBe(1);
        const suggestion = modal.querySelector('.suggestion-box li');
        expect(suggestion.textContent).toBe('Marty McFly');
                return;

        // Mock selection
        modal.name_auto_complete.select(suggestion);

        expect(input_el.value).toBe('Marty McFly');
        expect(modal.querySelector('input[name="jid"]').value).toBe('marty@mcfly.net');
        modal.querySelector('button[type="submit"]').click();

        const sent_IQs = _converse.api.connection.get().IQ_stanzas;
        const sent_stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[type="set"] query[xmlns="${Strophe.NS.ROSTER}"]`)).pop());
        expect(Strophe.serialize(sent_stanza)).toEqual(
        `<iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
            `<query xmlns="jabber:iq:roster"><item jid="marty@mcfly.net" name="Marty McFly"/></query>`+
        `</iq>`);
        window.XMLHttpRequest = XMLHttpRequestBackup;
    }));

    it("can be configured to not provide search suggestions for XHR search results",
        mock.initConverse([],
            { 'autocomplete_add_contact': false,
              'xhr_user_search_url': 'http://example.org/?' },
            async function (_converse) {

        await mock.waitForRoster(_converse, 'all');
        await mock.openControlBox(_converse);

        spyOn(window, 'fetch').and.callFake(() => {
            let json;
            const value = modal.querySelector('input[name="name"]').value;
            if (value === 'existing') {
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                json = [{"jid": contact_jid, "fullname": mock.cur_names[0]}];
            } else if (value === 'romeo') {
                json = [{"jid": "romeo@montague.lit", "fullname": "Romeo Montague"}];
            } else if (value === 'ambiguous') {
                json = [
                    {"jid": "marty@mcfly.net", "fullname": "Marty McFly"},
                    {"jid": "doc@brown.com", "fullname": "Doc Brown"}
                ];
            } else if (value === 'insufficient') {
                json = [];
            } else {
                json = [{"jid": "marty@mcfly.net", "fullname": "Marty McFly"}];
            }
            return { json };
        });

        const cbview = _converse.chatboxviews.get('controlbox');
        cbview.querySelector('.add-contact').click()
        const modal = _converse.api.modal.get('converse-add-contact-modal');
        await u.waitUntil(() => u.isVisible(modal), 1000);

        expect(modal.jid_auto_complete).toBe(undefined);
        expect(modal.name_auto_complete).toBe(undefined);

        const input_el = modal.querySelector('input[name="name"]');
        input_el.value = 'ambiguous';
        modal.querySelector('button[type="submit"]').click();

        const feedback_el = await u.waitUntil(() => modal.querySelector('.alert-danger'));
        expect(feedback_el.textContent).toBe('Sorry, could not find a contact with that name');

        input_el.value = 'existing';
        modal.querySelector('button[type="submit"]').click();
        await u.waitUntil(() => feedback_el.textContent === 'This contact has already been added');

        input_el.value = 'insufficient';
        modal.querySelector('button[type="submit"]').click();
        await u.waitUntil(() => feedback_el.textContent === 'Sorry, could not find a contact with that name');

        input_el.value = 'Marty McFly';
        modal.querySelector('button[type="submit"]').click();

        const sent_IQs = _converse.api.connection.get().IQ_stanzas;
        const sent_stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[type="set"] query[xmlns="${Strophe.NS.ROSTER}"]`)).pop());
        expect(Strophe.serialize(sent_stanza)).toEqual(
        `<iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
            `<query xmlns="jabber:iq:roster"><item jid="marty@mcfly.net" name="Marty McFly"><group></group></item></query>`+
        `</iq>`);
    }));
});
