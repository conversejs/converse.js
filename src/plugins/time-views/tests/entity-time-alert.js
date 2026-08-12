import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, sizzle, stx, u } = converse.env;

// Both the wall clock and the browser's timezone are pinned, because the alert
// compares the contact's offset against ours. Without pinning, a runner in
// UTC+06:00 (or the half-hour zones) sees a zero timezone difference for the
// fixtures below and the alert is correctly suppressed, failing the suite for
// no reason other than where it ran.
const NOW = new Date('2026-03-16T17:00:00Z');
const LOCAL_TZ_OFFSET = 0; // as getTimezoneOffset() reports it: minutes behind UTC

/**
 * Helper to find a time IQ stanza in the IQ_stanzas array.
 * @param {Element[]} stanzas - Array of IQ stanzas
 * @returns {Element|undefined} The time IQ stanza if found
 */
function findTimeIQ(stanzas) {
    return stanzas.find((iq) => sizzle(`time[xmlns="${Strophe.NS.TIME}"]`, iq).length);
}

/**
 * Opens a chat with the first mock contact after announcing a full JID for
 * them, which is what the alert needs in order to address its query.
 * @param {any} _converse
 * @returns {Promise<{contact_jid: string, full_jid: string, alert_el: any}>}
 */
async function openChatWithOnlineContact(_converse) {
    const { api } = _converse;
    await mock.waitForRoster(_converse, 'current', 1);
    await mock.openControlBox(_converse);

    const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
    const full_jid = `${contact_jid}/resource`;

    const presence = stx`<presence from="${full_jid}" to="${_converse.jid}" xmlns="jabber:client"/>`;
    api.connection.get()._dataRecv(mock.createRequest(_converse, presence));

    const contact = await api.contacts.get(contact_jid);
    await u.waitUntil(() => contact.presence?.getHighestPriorityResource());

    await mock.openChatBoxFor(_converse, contact_jid);

    const view = _converse.chatboxviews.get(contact_jid);
    const alert_el = view.querySelector('converse-entity-time-alert');
    return { contact_jid, full_jid, alert_el };
}

/**
 * Answers the pending XEP-0202 query with the given offset and waits for the
 * component to finish processing it.
 * @param {any} _converse
 * @param {string} full_jid
 * @param {string} tzo
 * @param {any} alert_el
 */
async function respondWithTZO(_converse, full_jid, tzo, alert_el) {
    const { api } = _converse;
    const sent_iq = await u.waitUntil(() => findTimeIQ(api.connection.get().IQ_stanzas));
    expect(sent_iq.getAttribute('to')).toBe(full_jid);

    const id = sent_iq.getAttribute('id');
    api.connection.get()._dataRecv(
        mock.createRequest(
            _converse,
            stx`
                <iq type="result" from="${full_jid}" to="${_converse.jid}" id="${id}" xmlns="jabber:client">
                    <time xmlns="urn:xmpp:time">
                        <tzo>${tzo}</tzo>
                        <utc>2026-03-16T17:00:00Z</utc>
                    </time>
                </iq>`,
        ),
    );
    await u.waitUntil(() => alert_el.time_info !== null);
}

describe('XEP-0202 Entity Time Views', function () {
    describe('The entity time alert', function () {
        beforeEach(() => {
            vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(LOCAL_TZ_OFFSET);
            vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
        });

        afterEach(() => vi.useRealTimers());

        it(
            'shows a warning when it is off-hours for the contact',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                {
                    show_entity_time: true,
                    entity_time_warning_start: 22,
                    entity_time_warning_end: 7,
                },
                async function (_converse) {
                    const { full_jid, alert_el } = await openChatWithOnlineContact(_converse);
                    expect(alert_el).not.toBeNull();

                    // We're at 17:00 UTC+00:00, so a contact at +06:00 is at
                    // 23:00, inside the 22:00-07:00 window.
                    await respondWithTZO(_converse, full_jid, '+06:00', alert_el);

                    await u.waitUntil(() => alert_el.querySelector('.entity-time-alert'));
                    const alert_msg = alert_el.querySelector('.entity-time-alert__message');
                    expect(alert_msg.textContent).toContain('23:00');
                },
            ),
        );

        it(
            'does not show a warning when it is working hours for the contact',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                {
                    show_entity_time: true,
                    entity_time_warning_start: 22,
                    entity_time_warning_end: 7,
                },
                async function (_converse) {
                    const { full_jid, alert_el } = await openChatWithOnlineContact(_converse);

                    // A contact at -04:00 is at 13:00. Their offset differs from
                    // ours by 4 hours, so it's the off-hours check alone that
                    // suppresses the alert here.
                    await respondWithTZO(_converse, full_jid, '-04:00', alert_el);

                    expect(alert_el.querySelector('.entity-time-alert')).toBeNull();
                },
            ),
        );

        it(
            'does not show a warning when the timezone difference is below entity_time_min_diff_hours',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                {
                    show_entity_time: true,
                    entity_time_warning_start: 22,
                    entity_time_warning_end: 7,
                    entity_time_min_diff_hours: 8,
                },
                async function (_converse) {
                    const { full_jid, alert_el } = await openChatWithOnlineContact(_converse);

                    // 23:00 for them, so off-hours, but only 6 hours away from us.
                    await respondWithTZO(_converse, full_jid, '+06:00', alert_el);

                    expect(alert_el.querySelector('.entity-time-alert')).toBeNull();
                },
            ),
        );

        it(
            'can be dismissed',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                {
                    show_entity_time: true,
                    entity_time_warning_start: 22,
                    entity_time_warning_end: 7,
                },
                async function (_converse) {
                    const { contact_jid, full_jid, alert_el } = await openChatWithOnlineContact(_converse);
                    await respondWithTZO(_converse, full_jid, '+06:00', alert_el);

                    await u.waitUntil(() => alert_el.querySelector('.entity-time-alert'));
                    alert_el.querySelector('.entity-time-alert__dismiss').click();

                    await u.waitUntil(() => !alert_el.querySelector('.entity-time-alert'));

                    const chatbox = _converse.state.chatboxes.get(contact_jid);
                    expect(chatbox.get('entity_time_dismissed')).toBe(true);
                },
            ),
        );

        it(
            'does not query for the time when show_entity_time is false',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                { show_entity_time: false },
                async function (_converse) {
                    const { alert_el } = await openChatWithOnlineContact(_converse);

                    // fetchEntityTime debounces by 300ms, so give the query it
                    // would otherwise send time to appear.
                    await new Promise((resolve) => setTimeout(resolve, 500));

                    expect(findTimeIQ(_converse.api.connection.get().IQ_stanzas)).toBeUndefined();
                    expect(alert_el.querySelector('.entity-time-alert')).toBeNull();
                },
            ),
        );

        it(
            'shows nothing for entities that do not support XEP-0202',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                { show_entity_time: true },
                async function (_converse) {
                    const { api } = _converse;
                    const { full_jid, alert_el } = await openChatWithOnlineContact(_converse);

                    const sent_iq = await u.waitUntil(() => findTimeIQ(api.connection.get().IQ_stanzas));
                    await u.waitUntil(() => alert_el.loading);

                    const id = sent_iq.getAttribute('id');
                    api.connection.get()._dataRecv(
                        mock.createRequest(
                            _converse,
                            stx`
                                <iq type="error" from="${full_jid}" to="${_converse.jid}" id="${id}" xmlns="jabber:client">
                                    <error type="cancel">
                                        <service-unavailable xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                                    </error>
                                </iq>`,
                        ),
                    );

                    await u.waitUntil(() => !alert_el.loading);
                    expect(alert_el.time_info).toBeNull();
                    expect(alert_el.querySelector('.entity-time-alert')).toBeNull();
                },
            ),
        );
    });
});
