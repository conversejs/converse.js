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
        await u.waitUntil(() => modal.querySelector('.suggestion-box li')?.textContent === 'someone@montague.lit');
        input_jid.value = 'someone@montague.lit';
        input_name.value = 'Someone';
        modal.querySelector('button[type="submit"]').click();

        const sent_IQs = _converse.api.connection.get().IQ_stanzas;
        const sent_stanza = await u.waitUntil(() => sent_IQs.filter(
            iq => sizzle(`iq[type="set"] query[xmlns="${Strophe.NS.ROSTER}"]`, iq).length).pop());
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

    it("integrates with xhr_user_search_url to search for contacts",
            mock.initConverse([], { xhr_user_search_url: 'http://example.org/?' },
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

        const input_el = modal.querySelector('input[name="jid"]');
        input_el.value = 'marty';
        input_el.dispatchEvent(new Event('input'));

        await u.waitUntil(() => modal.querySelector('.suggestion-box li'), 1000);
        expect(modal.querySelectorAll('.suggestion-box li').length).toBe(1);
        const suggestion = modal.querySelector('.suggestion-box li');
        expect(suggestion.textContent).toBe('Marty McFly <marty@mcfly.net>');

        const el = u.ancestor(suggestion, 'converse-autocomplete');
        el.auto_complete.select(suggestion);

        expect(input_el.value.trim()).toBe('Marty McFly <marty@mcfly.net>');

        modal.querySelector('button[type="submit"]').click();

        const sent_IQs = _converse.api.connection.get().IQ_stanzas;
        const sent_stanza = await u.waitUntil(() => sent_IQs.filter(
            iq => sizzle(`iq[type="set"] query[xmlns="${Strophe.NS.ROSTER}"]`, iq).length).pop());

        expect(sent_stanza).toEqualStanza(stx`
            <iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">
                <query xmlns="jabber:iq:roster"><item jid="marty@mcfly.net" name="Marty McFly"/></query>
            </iq>`);
    }));
});
