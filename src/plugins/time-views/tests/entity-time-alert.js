/*global mock, converse */

const { Strophe, sizzle, stx, u } = converse.env;

/**
 * Helper to find a time IQ stanza in the IQ_stanzas array.
 * @param {Element[]} stanzas - Array of IQ stanzas
 * @returns {Element|undefined} The time IQ stanza if found
 */
function findTimeIQ(stanzas) {
    return stanzas.find(iq => sizzle(`time[xmlns="${Strophe.NS.TIME}"]`, iq).length);
}

describe('XEP-0202 Entity Time Views', function () {

    describe('The entity time alert', function () {
        // Mock local time to 17:00 UTC for all tests in this suite
        const MOCK_TIME = new Date('2026-03-16T17:00:00Z');
        let OriginalDate;

        beforeEach(function () {
            OriginalDate = Date;
            const MockDate = function (...args) {
                if (args.length === 0) {
                    return new OriginalDate(MOCK_TIME);
                }
                return new OriginalDate(...args);
            };
            MockDate.now = () => MOCK_TIME.getTime();
            MockDate.parse = OriginalDate.parse;
            MockDate.UTC = OriginalDate.UTC;
            MockDate.prototype = OriginalDate.prototype;
            // @ts-ignore
            window.Date = MockDate;
        });

        afterEach(function () {
            window.Date = OriginalDate;
        });

        it('shows a warning when contact is in off-hours',
            mock.initConverse(['chatBoxesFetched'], {
                show_entity_time: true,
                entity_time_warning_start: 22,
                entity_time_warning_end: 7,
            }, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.openControlBox(_converse);

                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                const full_jid = contact_jid + '/resource';

                // Send presence so the component can get the full JID
                const presence = stx`<presence from="${full_jid}" to="${_converse.jid}" xmlns="jabber:client"/>`;
                api.connection.get()._dataRecv(mock.createRequest(presence));

                // Wait for presence resource to be processed before opening chat
                const contact = await api.contacts.get(contact_jid);
                await u.waitUntil(() => contact.presence?.getHighestPriorityResource());

                await mock.openChatBoxFor(_converse, contact_jid);

                const view = _converse.chatboxviews.get(contact_jid);
                const alert_el = view.querySelector('converse-entity-time-alert');
                expect(alert_el).not.toBeNull();

                // Wait for the IQ to be sent
                const sent_iq = await u.waitUntil(() => findTimeIQ(api.connection.get().IQ_stanzas));

                expect(sent_iq.getAttribute('to')).toBe(full_jid);

                // Simulate response: contact is at UTC+06:00
                // Local time is 17:00 UTC, so contact's time is 23:00 (off-hours)
                const id = sent_iq.getAttribute('id');
                const response = stx`
                    <iq type="result" from="${full_jid}" to="${_converse.jid}" id="${id}" xmlns="jabber:client">
                        <time xmlns="urn:xmpp:time">
                            <tzo>+06:00</tzo>
                            <utc>2026-03-16T17:00:00Z</utc>
                        </time>
                    </iq>`;
                api.connection.get()._dataRecv(mock.createRequest(response));

                // Wait for alert to show
                await u.waitUntil(() => alert_el.querySelector('.entity-time-alert'));
                const alert_msg = alert_el.querySelector('.entity-time-alert__message');
                expect(alert_msg.textContent).toContain('23:00');
            })
        );

        it('does not show warning when contact is not in off-hours',
            mock.initConverse(['chatBoxesFetched'], {
                show_entity_time: true,
                entity_time_warning_start: 22,
                entity_time_warning_end: 7,
            }, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.openControlBox(_converse);

                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                const full_jid = contact_jid + '/resource';

                // Send presence so the component can get the full JID
                const presence = stx`<presence from="${full_jid}" to="${_converse.jid}" xmlns="jabber:client"/>`;
                api.connection.get()._dataRecv(mock.createRequest(presence));

                // Wait for presence resource to be processed
                const contact = await api.contacts.get(contact_jid);
                await u.waitUntil(() => contact.presence?.getHighestPriorityResource());

                await mock.openChatBoxFor(_converse, contact_jid);

                const view = _converse.chatboxviews.get(contact_jid);
                const alert_el = view.querySelector('converse-entity-time-alert');

                // Wait for the IQ to be sent
                const sent_iq = await u.waitUntil(() => findTimeIQ(api.connection.get().IQ_stanzas));

                // Simulate response: contact is at UTC+00:00
                // Local time is 17:00 UTC, so contact's time is also 17:00 (not off-hours)
                const id = sent_iq.getAttribute('id');
                const response = stx`
                    <iq type="result" from="${full_jid}" to="${_converse.jid}" id="${id}" xmlns="jabber:client">
                        <time xmlns="urn:xmpp:time">
                            <tzo>+00:00</tzo>
                            <utc>2026-03-16T17:00:00Z</utc>
                        </time>
                    </iq>`;
                api.connection.get()._dataRecv(mock.createRequest(response));

                // Give it time to process
                await u.waitUntil(() => alert_el.time_info !== null, 500);

                // Alert should not be visible (17:00 is not off-hours)
                expect(alert_el.querySelector('.entity-time-alert')).toBeNull();
            })
        );

        it('can be dismissed',
            mock.initConverse(['chatBoxesFetched'], {
                show_entity_time: true,
                entity_time_warning_start: 22,
                entity_time_warning_end: 7,
            }, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.openControlBox(_converse);

                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                const full_jid = contact_jid + '/resource';

                // Send presence so the component can get the full JID
                const presence = stx`<presence from="${full_jid}" to="${_converse.jid}" xmlns="jabber:client"/>`;
                api.connection.get()._dataRecv(mock.createRequest(presence));

                // Wait for presence resource to be processed
                const contact = await api.contacts.get(contact_jid);
                await u.waitUntil(() => contact.presence?.getHighestPriorityResource());

                await mock.openChatBoxFor(_converse, contact_jid);

                const view = _converse.chatboxviews.get(contact_jid);
                const alert_el = view.querySelector('converse-entity-time-alert');

                // Wait for the IQ to be sent
                const sent_iq = await u.waitUntil(() => findTimeIQ(api.connection.get().IQ_stanzas));

                // Simulate response: contact is at UTC+06:00
                // Local time is 17:00 UTC, so contact's time is 23:00 (off-hours)
                const id = sent_iq.getAttribute('id');
                const response = stx`
                    <iq type="result" from="${full_jid}" to="${_converse.jid}" id="${id}" xmlns="jabber:client">
                        <time xmlns="urn:xmpp:time">
                            <tzo>+06:00</tzo>
                            <utc>2026-03-16T17:00:00Z</utc>
                        </time>
                    </iq>`;
                api.connection.get()._dataRecv(mock.createRequest(response));

                // Wait for alert to show
                await u.waitUntil(() => alert_el.querySelector('.entity-time-alert'));

                // Click dismiss button
                const close_btn = alert_el.querySelector('.entity-time-alert__dismiss');
                close_btn.click();

                // Alert should be hidden
                await u.waitUntil(() => !alert_el.querySelector('.entity-time-alert'));

                // Model should have dismiss flag set
                const chatbox = _converse.state.chatboxes.get(contact_jid);
                expect(chatbox.get('entity_time_dismissed')).toBe(true);
            })
        );

        it('does not show if feature is disabled',
            mock.initConverse(['chatBoxesFetched'], {
                show_entity_time: false,
            }, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.openControlBox(_converse);

                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);

                const view = _converse.chatboxviews.get(contact_jid);
                const alert_el = view.querySelector('converse-entity-time-alert');

                // Give it time to initialize
                await new Promise(resolve => setTimeout(resolve, 100));

                // No IQ should have been sent
                const time_iqs = _converse.api.connection.get().IQ_stanzas.filter(
                    iq => sizzle(`time[xmlns="${Strophe.NS.TIME}"]`, iq).length
                );
                expect(time_iqs.length).toBe(0);

                // Alert should render nothing
                expect(alert_el.querySelector('.entity-time-alert')).toBeNull();
            })
        );

        it('handles entities that do not support XEP-0202',
            mock.initConverse(['chatBoxesFetched'], {
                show_entity_time: true,
            }, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.openControlBox(_converse);

                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                const full_jid = contact_jid + '/resource';

                // Send presence so the component can get the full JID
                const presence = stx`<presence from="${full_jid}" to="${_converse.jid}" xmlns="jabber:client"/>`;
                api.connection.get()._dataRecv(mock.createRequest(presence));

                // Wait for presence resource to be processed
                const contact = await api.contacts.get(contact_jid);
                await u.waitUntil(() => contact.presence?.getHighestPriorityResource());

                await mock.openChatBoxFor(_converse, contact_jid);

                const view = _converse.chatboxviews.get(contact_jid);
                const alert_el = view.querySelector('converse-entity-time-alert');

                // Wait for the IQ to be sent
                const sent_iq = await u.waitUntil(() => findTimeIQ(api.connection.get().IQ_stanzas));

                // Simulate error response (feature not supported)
                const id = sent_iq.getAttribute('id');
                const response = stx`
                    <iq type="error" from="${full_jid}" to="${_converse.jid}" id="${id}" xmlns="jabber:client">
                        <error type="cancel">
                            <service-unavailable xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                        </error>
                    </iq>`;
                api.connection.get()._dataRecv(mock.createRequest(response));

                // Give it time to process error
                await new Promise(resolve => setTimeout(resolve, 100));

                // Alert should not be visible
                expect(alert_el.querySelector('.entity-time-alert')).toBeNull();
            })
        );
    });
});
