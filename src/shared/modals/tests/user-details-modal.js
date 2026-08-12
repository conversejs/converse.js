import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, sizzle, stx, u } = converse.env;

describe('The User Details Modal', function () {
    it(
        "shows the contact's local time once it's known",
        mock.initConverse(converse, ['chatBoxesFetched'], { show_entity_time: true }, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            api.trigger('rosterContactsFetched');

            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const full_jid = `${contact_jid}/resource`;
            const presence = stx`<presence from="${full_jid}" to="${_converse.jid}" xmlns="jabber:client"/>`;
            api.connection.get()._dataRecv(mock.createRequest(_converse, presence));

            const contact = await api.contacts.get(contact_jid);
            await u.waitUntil(() => contact.presence?.getHighestPriorityResource());
            await mock.openChatBoxFor(_converse, contact_jid);
            await u.waitUntil(() => _converse.chatboxes.length > 1);

            const sent_iq = await u.waitUntil(() =>
                api.connection.get().IQ_stanzas.find((iq) => sizzle(`time[xmlns="${Strophe.NS.TIME}"]`, iq).length),
            );
            api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                        <iq type="result" from="${full_jid}" to="${_converse.jid}" id="${sent_iq.getAttribute('id')}" xmlns="jabber:client">
                            <time xmlns="urn:xmpp:time">
                                <tzo>+05:30</tzo>
                                <utc>2026-03-16T17:00:00Z</utc>
                            </time>
                        </iq>`,
                ),
            );

            const view = _converse.chatboxviews.get(contact_jid);
            await u.waitUntil(() => api.time.contact.get(view.model.contact));

            view.querySelector('.show-msg-author-modal').click();
            const modal = api.modal.get('converse-user-details-modal');
            await u.waitUntil(() => u.isVisible(modal));

            // Unlike the heading, the modal says so even for a contact in our
            // own timezone: someone went looking for it here.
            const row = await u.waitUntil(() => modal.querySelector('.local-time'));
            expect(row.querySelector('label').textContent).toContain('Local time');
            expect(row.textContent).toContain('UTC+05:30');
            expect(row.textContent).toContain(u.time.formatRemoteTime(new Date(), '+05:30'));

            // A clock face while their hour is a reasonable one, a moon while
            // it isn't. The window is moved around their current hour rather
            // than the clock being mocked, so the assertion holds whenever the
            // suite happens to run.
            const { hour } = api.time.contact.get(view.model.contact);
            const iconHref = () => modal.querySelector('.local-time converse-icon svg use')?.getAttribute('href');

            // Where the time itself begins, so that the glyph swap can be shown
            // not to move it.
            const timeTextLeft = () => {
                const cell = modal.querySelector('.local-time__value');
                const node = Array.from(cell.childNodes).find((n) => n.nodeType === 3 && n.textContent.trim());
                const range = document.createRange();
                range.selectNodeContents(node);
                return Math.round(range.getBoundingClientRect().left);
            };

            // Start inside the window whichever hour it is for them, so that
            // the swap back out of it is walked every time the suite runs. It's
            // the direction in which the colour goes away again, and a binding
            // that removes the attribute instead of emptying it leaves the icon
            // without one to read.
            api.settings.set('entity_time_warning_start', hour);
            api.settings.set('entity_time_warning_end', (hour + 1) % 24);
            modal.requestUpdate();
            await u.waitUntil(() => iconHref() === '#icon-moon');

            api.settings.set('entity_time_warning_start', (hour + 2) % 24);
            api.settings.set('entity_time_warning_end', (hour + 3) % 24);
            modal.requestUpdate();
            await u.waitUntil(() => iconHref() === '#icon-clock');
            const clock_text_left = timeTextLeft();

            api.settings.set('entity_time_warning_start', hour);
            api.settings.set('entity_time_warning_end', (hour + 1) % 24);
            modal.requestUpdate();
            await u.waitUntil(() => iconHref() === '#icon-moon');

            // The gap belongs to the row rather than to either glyph, so the
            // time stays put as the contact's day turns.
            expect(timeTextLeft()).toBe(clock_text_left);
        }),
    );

    it(
        "can be used to set a contact's name and groups",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            api.trigger('rosterContactsFetched');

            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            await u.waitUntil(() => _converse.chatboxes.length > 1);

            const view = _converse.chatboxviews.get(contact_jid);
            const show_modal_button = view.querySelector('.show-msg-author-modal');
            show_modal_button.click();
            const modal = api.modal.get('converse-user-details-modal');
            await u.waitUntil(() => u.isVisible(modal));
            modal.querySelector('#edit-tab').click();

            const name_input = await u.waitUntil(() => modal.querySelector('input[name="name"]'));
            expect(name_input.value).toBe('Mercutio');

            const groups_input = modal.querySelector('input[name="groups"]');
            expect(groups_input.value).toBe('Colleagues,friends & acquaintances');

            const sent_stanzas = _converse.api.connection.get().sent_stanzas;
            while (sent_stanzas.length) sent_stanzas.pop();

            name_input.value = 'New Name';
            groups_input.value = 'Other';
            modal.querySelector('button[type="submit"]').click();
            await u.waitUntil(() => modal.getAttribute('aria-hidden'));

            const sent_IQ = await u.waitUntil(() => sent_stanzas.pop());
            expect(sent_IQ).toEqualStanza(stx`
            <iq xmlns="jabber:client"
                    type="set"
                    id="${sent_IQ.getAttribute('id')}">
                <query xmlns="jabber:iq:roster">
                    <item jid="mercutio@montague.lit" name="New Name"><group>Other</group></item>
                </query>
            </iq>`);
        }),
    );

    it(
        'can be used to remove a contact',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            api.trigger('rosterContactsFetched');

            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            await u.waitUntil(() => _converse.chatboxes.length > 1);

            const view = _converse.chatboxviews.get(contact_jid);
            let show_modal_button = view.querySelector('.show-msg-author-modal');
            show_modal_button.click();
            let modal = api.modal.get('converse-user-details-modal');
            await u.waitUntil(() => u.isVisible(modal));
            modal.querySelector('#edit-tab').click();
            spyOn(view.model.contact, 'sendRosterRemoveStanza').and.callFake((callback) => callback());
            let remove_contact_button = await u.waitUntil(() => modal.querySelector('button.remove-contact'));
            remove_contact_button.click();

            modal = await u.waitUntil(() => document.querySelector('converse-confirm-modal'));
            modal.querySelector('.btn-primary').click();
            await u.waitUntil(() => modal.getAttribute('aria-hidden'));

            show_modal_button = view.querySelector('.show-msg-author-modal');
            show_modal_button.click();
            remove_contact_button = modal.querySelector('button.remove-contact');
            expect(remove_contact_button === null).toBeTruthy();
        }),
    );

    it(
        'shows an alert when an error happened while removing the contact',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            _converse.api.trigger('rosterContactsFetched');

            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            let show_modal_button = view.querySelector('.show-msg-author-modal');
            show_modal_button.click();
            let modal = _converse.api.modal.get('converse-user-details-modal');
            await u.waitUntil(() => u.isVisible(modal), 2000);
            modal.querySelector('#edit-tab').click();
            spyOn(_converse.api, 'confirm').and.returnValue(Promise.resolve(true));

            spyOn(view.model.contact, 'sendRosterRemoveStanza').and.callFake(() => {
                throw new Error('foo');
            });
            let remove_contact_button = await u.waitUntil(() => modal.querySelector('button.remove-contact'));
            expect(u.isVisible(remove_contact_button)).toBeTruthy();

            remove_contact_button.click();
            await u.waitUntil(() => !u.isVisible(modal));
            await u.waitUntil(() => u.isVisible(document.querySelector('.alert-danger')), 2000);

            const header = document.querySelector('.alert-danger .modal-title');
            expect(header.textContent).toBe('Error');
            expect(u.ancestor(header, '.modal-content').querySelector('.modal-body p').textContent.trim()).toBe(
                'Sorry, an error occurred while trying to remove Mercutio as a contact',
            );
            document.querySelector('.alert-danger .btn[aria-label="Close"]').click();

            show_modal_button = view.querySelector('.show-msg-author-modal');
            show_modal_button.click();
            modal = _converse.api.modal.get('converse-user-details-modal');
            await u.waitUntil(() => u.isVisible(modal), 2000);

            show_modal_button = view.querySelector('.show-msg-author-modal');
            show_modal_button.click();
            await u.waitUntil(() => u.isVisible(modal), 2000);

            modal.querySelector('#edit-tab').click();
            await u.waitUntil(() => u.isVisible(modal.querySelector('button.remove-contact')));
        }),
    );

    it(
        'can be used to accept a contact request',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.openControlBox(_converse);
            await mock.createContacts(_converse, 'requesting', 1);
            const name = mock.req_names.sort()[0];
            const contact_jid = name.replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const show_modal_button = view.querySelector('.show-msg-author-modal');
            show_modal_button.click();
            const modal = _converse.api.modal.get('converse-user-details-modal');
            expect(modal).toBeDefined();
            await u.waitUntil(() => u.isVisible(modal));
            modal.querySelector('.accept-contact-request').click();
            await u.waitUntil(() => document.querySelector('converse-accept-contact-request-modal'));
        }),
    );

    it(
        'can be used to decline a contact request',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitUntilDiscoConfirmed(
                _converse,
                _converse.domain,
                [{ 'category': 'server', 'type': 'IM' }],
                ['urn:xmpp:blocking'],
            );
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.openControlBox(_converse);
            await mock.createContacts(_converse, 'requesting', 1);
            const name = mock.req_names.sort()[0];
            const contact_jid = name.replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            const { roster } = _converse.state;
            const contact = roster.get(contact_jid);

            const show_modal_button = view.querySelector('.show-msg-author-modal');
            show_modal_button.click();
            const modal = _converse.api.modal.get('converse-user-details-modal');
            expect(modal).toBeDefined();

            spyOn(_converse.api, 'confirm').and.returnValue(Promise.resolve(true));
            spyOn(contact, 'unauthorize').and.callFake(function () {
                return contact;
            });
            await u.waitUntil(() => u.isVisible(modal));
            modal.querySelector('.decline-contact-request').click();
            await u.waitUntil(() => _converse.api.confirm.calls.count);
            await u.waitUntil(() => contact.unauthorize.calls.count());
        }),
    );
});
