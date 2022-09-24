/*global mock, converse */

const u = converse.env.utils;
const Strophe = converse.env.Strophe;
const sizzle = converse.env.sizzle;

describe("The 'Add Contact' widget", function () {

    it("opens up an add modal when you click on it",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'all');
        await mock.openControlBox(_converse);

        const cbview = _converse.chatboxviews.get('controlbox');
        cbview.querySelector('.add-contact').click()
        const modal = _converse.api.modal.get('converse-add-contact-modal');
        await u.waitUntil(() => u.isVisible(modal), 1000);
        expect(modal.querySelector('form.add-xmpp-contact')).not.toBe(null);

        const input_jid = modal.querySelector('input[name="jid"]');
        const input_name = modal.querySelector('input[name="name"]');
        input_jid.value = 'someone@';

        const evt = new Event('input');
        input_jid.dispatchEvent(evt);
        expect(modal.querySelector('.suggestion-box li').textContent).toBe('someone@montague.lit');
        input_jid.value = 'someone@montague.lit';
        input_name.value = 'Someone';
        modal.querySelector('button[type="submit"]').click();

        const sent_IQs = _converse.connection.IQ_stanzas;
        const sent_stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[type="set"] query[xmlns="${Strophe.NS.ROSTER}"]`)).pop());
        expect(Strophe.serialize(sent_stanza)).toEqual(
            `<iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                `<query xmlns="jabber:iq:roster"><item jid="someone@montague.lit" name="Someone"/></query>`+
            `</iq>`);
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

        const IQ_stanzas = _converse.connection.IQ_stanzas;
        const sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle(`iq[type="set"] query[xmlns="${Strophe.NS.ROSTER}"]`, s).length).pop()
        );
        expect(Strophe.serialize(sent_stanza)).toEqual(
            `<iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                `<query xmlns="jabber:iq:roster"><item jid="someone@montague.lit"/></query>`+
            `</iq>`
        );
    }));

    it("integrates with xhr_user_search_url to search for contacts",
            mock.initConverse([], { 'xhr_user_search_url': 'http://example.org/?' },
            async function (_converse) {

        await mock.waitForRoster(_converse, 'all', 0);

        class MockXHR extends XMLHttpRequest {
            open () {} // eslint-disable-line
            responseText  = ''
            send () {
                this.responseText = JSON.stringify([
                    {"jid": "marty@mcfly.net", "fullname": "Marty McFly"},
                    {"jid": "doc@brown.com", "fullname": "Doc Brown"}
                ]);
                this.onload();
            }
        }
        const XMLHttpRequestBackup = window.XMLHttpRequest;
        window.XMLHttpRequest = MockXHR;

        await mock.openControlBox(_converse);
        const cbview = _converse.chatboxviews.get('controlbox');
        cbview.querySelector('.add-contact').click()
        const modal = _converse.api.modal.get('converse-add-contact-modal');
        await u.waitUntil(() => u.isVisible(modal), 1000);

        // We only have autocomplete for the name input
        expect(modal.jid_auto_complete).toBe(undefined);
        expect(modal.name_auto_complete instanceof _converse.AutoComplete).toBe(true);

        const input_el = modal.querySelector('input[name="name"]');
        input_el.value = 'marty';
        input_el.dispatchEvent(new Event('input'));
        await u.waitUntil(() => modal.querySelector('.suggestion-box li'), 1000);
        expect(modal.querySelectorAll('.suggestion-box li').length).toBe(1);
        const suggestion = modal.querySelector('.suggestion-box li');
        expect(suggestion.textContent).toBe('Marty McFly');

        // Mock selection
        modal.name_auto_complete.select(suggestion);

        expect(input_el.value).toBe('Marty McFly');
        expect(modal.querySelector('input[name="jid"]').value).toBe('marty@mcfly.net');
        modal.querySelector('button[type="submit"]').click();

        const sent_IQs = _converse.connection.IQ_stanzas;
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

        class MockXHR extends XMLHttpRequest {
            open () {} // eslint-disable-line
            responseText  = ''
            send () {
                const value = modal.querySelector('input[name="name"]').value;
                if (value === 'existing') {
                    const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    this.responseText = JSON.stringify([{"jid": contact_jid, "fullname": mock.cur_names[0]}]);
                } else if (value === 'romeo') {
                    this.responseText = JSON.stringify([{"jid": "romeo@montague.lit", "fullname": "Romeo Montague"}]);
                } else if (value === 'ambiguous') {
                    this.responseText = JSON.stringify([
                        {"jid": "marty@mcfly.net", "fullname": "Marty McFly"},
                        {"jid": "doc@brown.com", "fullname": "Doc Brown"}
                    ]);
                } else if (value === 'insufficient') {
                    this.responseText = JSON.stringify([]);
                } else {
                    this.responseText = JSON.stringify([{"jid": "marty@mcfly.net", "fullname": "Marty McFly"}]);
                }
                this.onload();
            }
        }

        const XMLHttpRequestBackup = window.XMLHttpRequest;
        window.XMLHttpRequest = MockXHR;

        const cbview = _converse.chatboxviews.get('controlbox');
        cbview.querySelector('.add-contact').click()
        const modal = _converse.api.modal.get('converse-add-contact-modal');
        await u.waitUntil(() => u.isVisible(modal), 1000);

        expect(modal.jid_auto_complete).toBe(undefined);
        expect(modal.name_auto_complete).toBe(undefined);

        const input_el = modal.querySelector('input[name="name"]');
        input_el.value = 'ambiguous';
        modal.querySelector('button[type="submit"]').click();
        let feedback_el = modal.querySelector('.invalid-feedback');
        expect(feedback_el.textContent).toBe('Sorry, could not find a contact with that name');
        feedback_el.textContent = '';

        input_el.value = 'insufficient';
        modal.querySelector('button[type="submit"]').click();
        feedback_el = modal.querySelector('.invalid-feedback');
        expect(feedback_el.textContent).toBe('Sorry, could not find a contact with that name');
        feedback_el.textContent = '';

        input_el.value = 'existing';
        modal.querySelector('button[type="submit"]').click();
        feedback_el = modal.querySelector('.invalid-feedback');
        expect(feedback_el.textContent).toBe('This contact has already been added');

        input_el.value = 'Marty McFly';
        modal.querySelector('button[type="submit"]').click();

        const sent_IQs = _converse.connection.IQ_stanzas;
        const sent_stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[type="set"] query[xmlns="${Strophe.NS.ROSTER}"]`)).pop());
        expect(Strophe.serialize(sent_stanza)).toEqual(
        `<iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
            `<query xmlns="jabber:iq:roster"><item jid="marty@mcfly.net" name="Marty McFly"/></query>`+
        `</iq>`);
        window.XMLHttpRequest = XMLHttpRequestBackup;
    }));
});
