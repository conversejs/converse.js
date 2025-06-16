const { sizzle, u } = converse.env;

describe('Requesting Contacts', function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it(
        'can be added to the roster and they will be sorted alphabetically',
        mock.initConverse([], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.openControlBox(_converse);
            let names = [];
            const addName = function (item) {
                if (!u.hasClass('request-actions', item)) {
                    names.push(item.textContent.replace(/^\s+|\s+$/g, ''));
                }
            };
            const rosterview = document.querySelector('converse-roster');
            await Promise.all(
                mock.req_names.map((name) => {
                    const contact = _converse.roster.create({
                        jid: name.replace(/ /g, '.').toLowerCase() + '@montague.lit',
                        subscription: 'none',
                        ask: null,
                        requesting: true,
                        nickname: name,
                    });
                    return u.waitUntil(() => contact.initialized);
                })
            );
            await u.waitUntil(() => rosterview.querySelectorAll(`ul[data-group="Contact requests"] li`).length, 700);
            // Check that they are sorted alphabetically
            const children = rosterview.querySelectorAll(
                `ul[data-group="Contact requests"] .requesting-xmpp-contact .contact-name`
            );
            names = [];
            Array.from(children).forEach(addName);
            expect(names.join('')).toEqual(
                mock.req_names
                    .slice(0, mock.req_names.length + 1)
                    .sort()
                    .join('')
            );
        })
    );

    it(
        'can have their requests accepted via a dropdown in the roster',
        mock.initConverse([], { lazy_load_vcards: false }, async function (_converse) {
            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.createContacts(_converse, 'requesting', 1);
            const roster_el = document.querySelector('converse-roster');
            const accept_btn = roster_el.querySelector('.dropdown-item.accept-xmpp-request');
            accept_btn.click();
            await u.waitUntil(() => document.querySelector('converse-accept-contact-request-modal'));
        })
    );

    it(
        'can have their requests declined via a dropdown in the roster',
        mock.initConverse([], {}, async function (_converse) {
            await mock.waitUntilDiscoConfirmed(
                _converse,
                _converse.domain,
                [{ 'category': 'server', 'type': 'IM' }],
                ['urn:xmpp:blocking']
            );
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.openControlBox(_converse);
            await mock.createContacts(_converse, 'requesting', 1);
            const name = mock.req_names.sort()[0];
            const jid = name.replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const { roster } = _converse;
            const contact = roster.get(jid);
            spyOn(_converse.api, 'confirm').and.returnValue(Promise.resolve(true));
            spyOn(contact, 'unauthorize').and.callFake(() => contact);
            const roster_el = document.querySelector('converse-roster');
            const decline_btn = roster_el.querySelector('.dropdown-item.decline-xmpp-request');
            decline_btn.click();
            await u.waitUntil(() => _converse.api.confirm.calls.count);
            await u.waitUntil(() => contact.unauthorize.calls.count());
        })
    );

    it(
        "do not have a header if there aren't any",
        mock.initConverse([], { show_self_in_roster: false }, async function (_converse) {
            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilDiscoConfirmed(
                _converse,
                _converse.domain,
                [{ 'category': 'server', 'type': 'IM' }],
                ['urn:xmpp:blocking']
            );

            const name = mock.req_names[0];
            spyOn(_converse.api, 'confirm').and.returnValue(Promise.resolve(true));
            _converse.roster.create({
                'jid': name.replace(/ /g, '.').toLowerCase() + '@montague.lit',
                'subscription': 'none',
                'ask': null,
                'requesting': true,
                'nickname': name,
            });
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('.roster-group', rosterview).filter(u.isVisible).length, 900);
            expect(u.isVisible(rosterview.querySelector(`ul[data-group="Contact requests"]`))).toEqual(true);
            expect(
                sizzle('.roster-group', rosterview)
                    .filter(u.isVisible)
                    .map((e) => e.querySelector('li')).length
            ).toBe(1);
            sizzle('.roster-group', rosterview)
                .filter(u.isVisible)
                .map((e) => e.querySelector('li .decline-xmpp-request'))[0]
                .click();

            await u.waitUntil(() => _converse.api.confirm.calls.count);
            await u.waitUntil(() => rosterview.querySelector(`ul[data-group="Contact requests"]`) === null);
        })
    );

    it(
        'can be collapsed under their own header',
        mock.initConverse([], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            mock.createContacts(_converse, 'requesting');
            await mock.openControlBox(_converse);
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('.roster-group', rosterview).filter(u.isVisible).length, 700);
            const el = await u.waitUntil(() => rosterview.querySelector(`ul[data-group="Contact requests"]`));
            await mock.checkHeaderToggling.apply(_converse, [el.parentElement]);
        })
    );

    it(
        'can have their requests accepted by the user',
        mock.initConverse([], { lazy_load_vcards: false }, async function (_converse) {
            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.createContacts(_converse, 'requesting');
            const name = mock.req_names.sort()[0];
            const jid = name.replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const { api, roster } = _converse;
            const contact = roster.get(jid);
            spyOn(contact, 'authorize').and.callThrough();
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => rosterview.querySelectorAll('.roster-group li').length);

            const req_contact = sizzle(`.contact-name:contains("${contact.getDisplayName()}")`, rosterview).pop();
            req_contact.parentElement.parentElement.querySelector('.accept-xmpp-request').click();

            const modal = _converse.api.modal.get('converse-accept-contact-request-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000);

            expect(modal.querySelector('input[name="name"]')?.value).toBe('Escalus, prince of Verona');
            const groups_input = modal.querySelector('input[name="groups"]');
            groups_input.value = 'Princes, Veronese';

            const sent_stanzas = _converse.api.connection.get().sent_stanzas;
            while (sent_stanzas.length) sent_stanzas.pop();

            modal.querySelector('button[type="submit"]').click();

            let stanza = await u.waitUntil(() => sent_stanzas.filter((s) => s.matches('iq[type="set"]')).pop());
            expect(stanza).toEqualStanza(
                stx`<iq type="set" xmlns="jabber:client" id="${stanza.getAttribute('id')}">
                        <query xmlns="jabber:iq:roster">
                            <item jid="${contact.get('jid')}" name="Escalus, prince of Verona">
                                <group>Princes</group>
                                <group>Veronese</group>
                            </item>
                        </query>
                    </iq>`
            );

            const result = stx`
                <iq to="${api.connection.get().jid}" type="result" id="${stanza.getAttribute('id')}" xmlns="jabber:client"/>`;
            api.connection.get()._dataRecv(mock.createRequest(result));

            stanza = await u.waitUntil(() =>
                sent_stanzas.filter((s) => s.matches('presence[type="subscribed"]')).pop()
            );
            expect(stanza).toEqualStanza(
                stx`<presence to="${contact.get('jid')}" type="subscribed" xmlns="jabber:client"/>`
            );

            await u.waitUntil(() => contact.authorize.calls.count());
            expect(contact.authorize).toHaveBeenCalled();
            expect(contact.get('groups')).toEqual(['Princes', 'Veronese']);
        })
    );

    it(
        'can have their requests denied by the user',
        mock.initConverse([], {}, async function (_converse) {
            await mock.waitUntilDiscoConfirmed(
                _converse,
                _converse.domain,
                [{ 'category': 'server', 'type': 'IM' }],
                ['urn:xmpp:blocking']
            );
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.createContacts(_converse, 'requesting');
            await mock.openControlBox(_converse);
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('.roster-group li', rosterview).length, 700);
            const name = mock.req_names.sort()[1];
            const jid = name.replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const contact = _converse.roster.get(jid);
            spyOn(_converse.api, 'confirm').and.returnValue(Promise.resolve(true));
            spyOn(contact, 'unauthorize').and.callFake(() => contact);
            const req_contact = await u.waitUntil(() =>
                sizzle(".contact-name:contains('" + name + "')", rosterview).pop()
            );
            req_contact.parentElement.parentElement.querySelector('.decline-xmpp-request').click();
            await u.waitUntil(() => _converse.api.confirm.calls.count);
            await u.waitUntil(() => contact.unauthorize.calls.count());
            // There should now be one less contact
            expect(_converse.roster.length).toEqual(mock.req_names.length - 1);
        })
    );

    it(
        "are persisted even if other contacts' change their presence ",
        mock.initConverse([], {}, async function (_converse) {
            await mock.openControlBox(_converse);

            const { IQ_stanzas } = _converse.api.connection.get();
            const stanza = await u.waitUntil(() =>
                IQ_stanzas.filter((iq) => sizzle('iq query[xmlns="jabber:iq:roster"]', iq).length).pop()
            );

            // Taken from the spec
            // https://xmpp.org/rfcs/rfc3921.html#rfc.section.7.3
            const result = stx`
                <iq to="${_converse.api.connection.get().jid}" type="result" id="${stanza.getAttribute('id')}" xmlns="jabber:client">
                    <query xmlns="jabber:iq:roster">
                        <item jid="juliet@example.net" name="Juliet" subscription="both">
                            <group>Friends</group>
                        </item>
                        <item jid="mercutio@example.org" name="Mercutio" subscription="from">
                            <group>Friends</group>
                        </item>
                    </query>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(result));

            const pres = $pres({ from: 'data@enterprise/resource', type: 'subscribe' });
            _converse.api.connection.get()._dataRecv(mock.createRequest(pres));

            expect(_converse.roster.pluck('jid').length).toBe(1);
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('a:contains("Contact requests")', rosterview).length, 700);
            expect(_converse.roster.pluck('jid').includes('data@enterprise')).toBeTruthy();

            const roster_push = stx`
                <iq type="set" to="${_converse.api.connection.get().jid}" xmlns="jabber:client">
                    <query xmlns="jabber:iq:roster" ver="ver34">
                        <item jid="benvolio@example.org" name="Benvolio" subscription="both">
                            <group>Friends</group>
                        </item>
                    </query>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(roster_push));
            expect(_converse.roster.data.get('version')).toBe('ver34');
            expect(_converse.roster.models.length).toBe(4);
            expect(_converse.roster.pluck('jid').includes('data@enterprise')).toBeTruthy();
        })
    );
});

describe('A chat with a requesting contact', function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it(
        'shows an approval alert when chatting with a requesting contact',
        mock.initConverse([], { lazy_load_vcards: false }, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.createContacts(_converse, 'requesting', 1);
            const name = mock.req_names[0];
            const jid = mock.req_jids[0];

            // Open chat with requesting contact
            const view = await mock.openChatBoxFor(_converse, jid);
            await u.waitUntil(() => view.querySelector('converse-contact-approval-alert'));

            const alert = view.querySelector('converse-contact-approval-alert');
            expect(alert).toBeTruthy();
            expect(alert.textContent).toContain(`${name} would like to be your contact`);
            expect(alert.querySelector('.btn-success')).toBeTruthy();
            expect(alert.querySelector('.btn-danger')).toBeTruthy();
        })
    );

    it(
        'can approve a contact request via the approval alert',
        mock.initConverse([], { lazy_load_vcards: false }, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.createContacts(_converse, 'requesting', 1);
            const jid = mock.req_jids[0];
            const contact = _converse.roster.get(jid);
            spyOn(contact, 'authorize').and.callThrough();

            const view = await mock.openChatBoxFor(_converse, jid);
            await u.waitUntil(() => view.querySelector('converse-contact-approval-alert'));

            const alert = view.querySelector('converse-contact-approval-alert');
            alert.querySelector('.btn-success').click();

            const modal = api.modal.get('converse-accept-contact-request-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000);

            // Submit the approval modal
            const sent_stanzas = api.connection.get().sent_stanzas;
            while (sent_stanzas.length) sent_stanzas.pop();
            modal.querySelector('button[type="submit"]').click();

            let stanza = await u.waitUntil(() => sent_stanzas.filter((s) => s.matches('iq[type="set"]')).pop());
            expect(stanza).toEqualStanza(
                stx`<iq type="set" xmlns="jabber:client" id="${stanza.getAttribute('id')}">
                        <query xmlns="jabber:iq:roster">
                            <item jid="${contact.get('jid')}" name="Escalus, prince of Verona"></item>
                        </query>
                    </iq>`
            );

            const result = stx`
                <iq to="${api.connection.get().jid}" type="result" id="${stanza.getAttribute('id')}" xmlns="jabber:client"/>`;
            api.connection.get()._dataRecv(mock.createRequest(result));

            stanza = await u.waitUntil(() =>
                sent_stanzas.filter((s) => s.matches('presence[type="subscribed"]')).pop()
            );
            expect(stanza).toEqualStanza(
                stx`<presence to="${contact.get('jid')}" type="subscribed" xmlns="jabber:client"/>`
            );

            await u.waitUntil(() => contact.authorize.calls.count());
            expect(contact.authorize).toHaveBeenCalled();
        })
    );

    it(
        'can deny a contact request via the approval alert',
        mock.initConverse([], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitUntilDiscoConfirmed(
                _converse,
                _converse.domain,
                [{ 'category': 'server', 'type': 'IM' }],
                ['urn:xmpp:blocking']
            );
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.createContacts(_converse, 'requesting', 1);
            const jid = mock.req_jids[0];
            spyOn(api, 'confirm').and.returnValue(Promise.resolve(true));

            const view = await mock.openChatBoxFor(_converse, jid);
            await u.waitUntil(() => view.querySelector('converse-contact-approval-alert'));

            const sent_stanzas = api.connection.get().sent_stanzas;
            while (sent_stanzas.length) sent_stanzas.pop();

            const alert = view.querySelector('converse-contact-approval-alert');
            alert.querySelector('.btn-danger').click();

            await u.waitUntil(() => api.confirm.calls.count());

            let stanza = await u.waitUntil(() =>
                sent_stanzas.filter((s) => s.matches('presence[type="unsubscribed"]')).pop()
            );
            expect(stanza).toEqualStanza(stx`<presence to="${jid}" type="unsubscribed" xmlns="jabber:client"/>`);
            await u.waitUntil(() => !view.querySelector('converse-contact-approval-alert').childElementCound);
        })
    );
});
