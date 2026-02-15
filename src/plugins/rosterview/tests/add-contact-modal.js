/*global mock, converse */
const u = converse.env.utils;
const Strophe = converse.env.Strophe;
const sizzle = converse.env.sizzle;

describe("The 'Add Contact' widget", function () {

    beforeEach(() => {
        jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza });
        // Clear the XMPP providers cache before each test
        u.rosterview.clearXMPPProvidersCache();
    });

    it("opens up an add modal when you click on it",
            mock.initConverse([], {}, async function (_converse) {

        // Mock fetch to return empty providers (so test focuses on roster domains)
        spyOn(window, 'fetch').and.callFake((url) => {
            if (url.includes('providers')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([])
                });
            }
            return Promise.reject(new Error('Unknown URL'));
        });

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
            const json = () => [
                {"jid": "marty@mcfly.net", "fullname": "Marty McFly"},
                {"jid": "doc@brown.com", "fullname": "Doc Brown"}
            ];
            return Promise.resolve({ json });
        });

        await mock.openControlBox(_converse);
        const cbview = await u.waitUntil(() => _converse.api.controlbox.get());
        cbview.querySelector('.add-contact').click()
        const modal = _converse.api.modal.get('converse-add-contact-modal');
        await u.waitUntil(() => u.isVisible(modal), 1000);

        const input_el = modal.querySelector('input[name="jid"]');
        input_el.value = 'marty';
        input_el.dispatchEvent(new Event('input'));

        await u.waitUntil(() => modal.querySelector('.suggestion-box li'), 1000);
        expect(modal.querySelectorAll('.suggestion-box li').length).toBe(1);
        const suggestion = modal.querySelector('.suggestion-box li');
        expect(suggestion.textContent.trim()).toBe('Marty McFly <marty@mcfly.net>');

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

    it("shows XMPP provider suggestions when typing a JID",
            mock.initConverse([], {
                xmpp_providers_url: 'https://data.xmpp.net/providers/v2/providers-Ds.json'
            }, async function (_converse) {

        // Mock the providers API response
        const mockProviders = ['conversations.im', 'disroot.org', 'jabber.de', 'jabber.fr'];
        spyOn(window, 'fetch').and.callFake((url) => {
            if (url.includes('providers')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockProviders)
                });
            }
            return Promise.reject(new Error('Unknown URL'));
        });

        await mock.waitForRoster(_converse, 'all');
        await mock.openControlBox(_converse);

        const cbview = _converse.chatboxviews.get('controlbox');
        const dropdown = await u.waitUntil(() => cbview.querySelector('.dropdown--contacts'));
        dropdown.querySelector('.add-contact').click();

        const modal = _converse.api.modal.get('converse-add-contact-modal');
        await u.waitUntil(() => u.isVisible(modal), 1000);

        const input_jid = modal.querySelector('input[name="jid"]');

        // Type a partial JID with @ to trigger domain autocomplete
        input_jid.value = 'testuser@jab';
        input_jid.dispatchEvent(new Event('input'));

        // Wait for suggestions to appear (should include jabber.de and jabber.fr from providers)
        await u.waitUntil(() => modal.querySelectorAll('.suggestion-box li').length >= 1, 2000);

        const suggestions = Array.from(modal.querySelectorAll('.suggestion-box li'))
            .map(li => li.textContent.trim());

        // Should show provider suggestions that start with 'jab'
        expect(suggestions.some(s => s.includes('jabber.de'))).toBe(true);
        expect(suggestions.some(s => s.includes('jabber.fr'))).toBe(true);

        // Verify that selecting a suggestion works
        const jabberDeSuggestion = modal.querySelector('.suggestion-box li');
        const el = u.ancestor(jabberDeSuggestion, 'converse-autocomplete');
        el.auto_complete.select(jabberDeSuggestion);

        // Input should now have the full JID
        expect(input_jid.value).toMatch(/^testuser@jabber/);
    }));

    it("falls back to roster domains when providers API is unavailable",
            mock.initConverse([], {
                xmpp_providers_url: 'https://data.xmpp.net/providers/v2/providers-Ds.json'
            }, async function (_converse) {

        // Mock a failed providers API response
        spyOn(window, 'fetch').and.callFake(() => {
            return Promise.reject(new Error('Network error'));
        });

        await mock.waitForRoster(_converse, 'all');
        await mock.openControlBox(_converse);

        const cbview = _converse.chatboxviews.get('controlbox');
        const dropdown = await u.waitUntil(() => cbview.querySelector('.dropdown--contacts'));
        dropdown.querySelector('.add-contact').click();

        const modal = _converse.api.modal.get('converse-add-contact-modal');
        await u.waitUntil(() => u.isVisible(modal), 1000);

        const input_jid = modal.querySelector('input[name="jid"]');

        // Type a partial JID to trigger domain autocomplete
        // The roster mock includes contacts from montague.lit domain
        input_jid.value = 'someone@mon';
        input_jid.dispatchEvent(new Event('input'));

        // Should still show roster domain suggestion even though providers API failed
        await u.waitUntil(
            () => modal.querySelector('.suggestion-box li')?.textContent?.includes('montague.lit'),
            2000
        );

        const suggestion = modal.querySelector('.suggestion-box li');
        expect(suggestion.textContent.trim()).toBe('someone@montague.lit');
    }));

    it("allows disabling provider autocomplete by setting xmpp_providers_url to empty",
            mock.initConverse([], {
                xmpp_providers_url: ''
            }, async function (_converse) {

        // Track if providers URL was called
        const fetchSpy = spyOn(window, 'fetch').and.callFake((url) => {
            // Return empty response for any fetch call
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve([])
            });
        });

        await mock.waitForRoster(_converse, 'all');
        await mock.openControlBox(_converse);

        const cbview = _converse.chatboxviews.get('controlbox');
        const dropdown = await u.waitUntil(() => cbview.querySelector('.dropdown--contacts'));
        dropdown.querySelector('.add-contact').click();

        const modal = _converse.api.modal.get('converse-add-contact-modal');
        await u.waitUntil(() => u.isVisible(modal), 1000);

        const input_jid = modal.querySelector('input[name="jid"]');
        input_jid.value = 'someone@mon';
        input_jid.dispatchEvent(new Event('input'));

        // Wait for suggestions from roster domains only
        await u.waitUntil(
            () => modal.querySelector('.suggestion-box li')?.textContent?.includes('montague.lit'),
            2000
        );

        // Verify that no fetch was made to providers URL
        const providerFetchCalls = fetchSpy.calls.all()
            .filter(call => call.args[0]?.includes?.('providers'));
        expect(providerFetchCalls.length).toBe(0);
    }));
});
