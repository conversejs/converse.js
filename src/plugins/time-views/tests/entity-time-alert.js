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
 * Starts the user typing, which is what the warning waits for. Goes through
 * the composer rather than setting the chat state directly, so that the path a
 * user actually takes is the one under test.
 * @param {any} view
 */
async function startComposing(view) {
    await mock.pressComposerKey(view, 'C');
    await u.waitUntil(() => view.model.get('chat_state') === 'composing');
}

/**
 * Opens a chat with the first mock contact after announcing a full JID for
 * them, which is what the alert needs in order to address its query.
 * @param {any} _converse
 * @returns {Promise<{contact_jid: string, full_jid: string, view: any, alert_el: any}>}
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
    return { contact_jid, full_jid, view, alert_el };
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
    // The offset is recorded on the chat by the headless plugin, not on the element.
    await u.waitUntil(() => _converse.api.time.contact.get(alert_el.model.contact));
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
                    const { full_jid, view, alert_el } = await openChatWithOnlineContact(_converse);
                    expect(alert_el).not.toBeNull();

                    // We're at 17:00 UTC+00:00, so a contact at +06:00 is at
                    // 23:00, inside the 22:00-07:00 window.
                    await respondWithTZO(_converse, full_jid, '+06:00', alert_el);
                    await startComposing(view);

                    await u.waitUntil(() => alert_el.querySelector('.entity-time-alert'));
                    const alert_msg = alert_el.querySelector('.entity-time-alert__message');

                    // How 23:00 is written depends on the locale, which is
                    // covered in the headless suite. What's asserted here is
                    // that the bar shows their time and not ours.
                    expect(alert_msg.textContent).toContain(u.time.formatRemoteTime(NOW, '+06:00'));
                    expect(alert_msg.textContent).not.toContain(u.time.formatRemoteTime(NOW, '+00:00'));
                },
            ),
        );

        it(
            'stays out of the way until the user starts writing',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                {
                    show_entity_time: true,
                    entity_time_warning_start: 22,
                    entity_time_warning_end: 7,
                },
                async function (_converse) {
                    const { full_jid, view, alert_el } = await openChatWithOnlineContact(_converse);

                    // 23:00 for them, so there is something to warn about, but
                    // opening a chat to read it is not the moment to say so.
                    await respondWithTZO(_converse, full_jid, '+06:00', alert_el);
                    await u.waitUntil(() => _converse.api.time.contact.get(alert_el.model.contact));
                    expect(alert_el.querySelector('.entity-time-alert')).toBeNull();

                    await startComposing(view);
                    await u.waitUntil(() => alert_el.querySelector('.entity-time-alert'));
                },
            ),
        );

        it(
            'goes away once the message has been sent',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                {
                    show_entity_time: true,
                    entity_time_warning_start: 22,
                    entity_time_warning_end: 7,
                },
                async function (_converse) {
                    const { full_jid, view, alert_el } = await openChatWithOnlineContact(_converse);
                    await respondWithTZO(_converse, full_jid, '+06:00', alert_el);
                    await startComposing(view);
                    await u.waitUntil(() => alert_el.querySelector('.entity-time-alert'));

                    // Sending is the user answering the warning, and it puts the
                    // chat back into the 'active' state. Silently, to keep a
                    // redundant chat state notification off the wire, which is
                    // why the sent message has to be what tells us.
                    await mock.sendMessage(_converse, view, 'Are you still up?');

                    await u.waitUntil(() => !alert_el.querySelector('.entity-time-alert'));
                },
            ),
        );

        it(
            'is painted with a background that the themes actually define',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                {
                    show_entity_time: true,
                    entity_time_warning_start: 22,
                    entity_time_warning_end: 7,
                },
                async function (_converse) {
                    const { full_jid, view, alert_el } = await openChatWithOnlineContact(_converse);
                    await respondWithTZO(_converse, full_jid, '+06:00', alert_el);
                    await startComposing(view);

                    const bar = await u.waitUntil(() => alert_el.querySelector('.entity-time-alert'));

                    // A var() naming a custom property no theme defines is
                    // invalid at computed-value time, which leaves the bar
                    // transparent rather than failing loudly anywhere else.
                    const bg = getComputedStyle(bar).backgroundColor;
                    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
                    expect(bg).not.toBe('transparent');
                },
            ),
        );

        it(
            'paints the icon in the warning colour rather than the default',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                {
                    show_entity_time: true,
                    entity_time_warning_start: 22,
                    entity_time_warning_end: 7,
                },
                async function (_converse) {
                    const { full_jid, view, alert_el } = await openChatWithOnlineContact(_converse);
                    await respondWithTZO(_converse, full_jid, '+06:00', alert_el);
                    await startComposing(view);

                    const svg = await u.waitUntil(() => alert_el.querySelector('.entity-time-alert__icon svg'));

                    // converse-icon fills its glyph from a custom property of
                    // its own, so an inherited `color` never reaches it. Both
                    // colours are read off a probe, since a computed `fill` and
                    // a computed `color` are written the same way and a raw
                    // custom property isn't.
                    const probe = document.createElement('span');
                    alert_el.appendChild(probe);
                    probe.style.color = 'var(--warning-color)';
                    const warning_color = getComputedStyle(probe).color;
                    probe.style.color = 'var(--secondary-color)';
                    const default_icon_color = getComputedStyle(probe).color;
                    probe.remove();

                    expect(warning_color).not.toBe(default_icon_color);
                    expect(getComputedStyle(svg).fill).toBe(warning_color);
                },
            ),
        );

        it(
            'gives both timezones in its title',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                {
                    show_entity_time: true,
                    entity_time_warning_start: 22,
                    entity_time_warning_end: 7,
                },
                async function (_converse) {
                    const { full_jid, view, alert_el } = await openChatWithOnlineContact(_converse);
                    await respondWithTZO(_converse, full_jid, '+06:00', alert_el);
                    await startComposing(view);

                    const bar = await u.waitUntil(() => alert_el.querySelector('.entity-time-alert'));

                    // The bar itself is one truncating line, so the detail that
                    // answers "says who?" lives on the tooltip.
                    const title = bar.getAttribute('title');
                    expect(title).toContain('UTC+06:00');
                    expect(title).toContain('UTC+00:00');

                    // The dismiss control is the only thing on the bar to aim
                    // at, and WCAG 2.2 asks for 24px of it.
                    const dismiss = bar.querySelector('.entity-time-alert__dismiss').getBoundingClientRect();
                    expect(dismiss.width).toBeGreaterThanOrEqual(24);
                    expect(dismiss.height).toBeGreaterThanOrEqual(24);
                },
            ),
        );

        it(
            'is a live region even while it has nothing to say',
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

                    // 13:00 for them, so nothing to warn about. The region has
                    // to be in the DOM ahead of the warning all the same: some
                    // screen readers only announce changes to regions they
                    // already knew about.
                    const region = await u.waitUntil(() => alert_el.querySelector('[role="status"]'));
                    await respondWithTZO(_converse, full_jid, '-04:00', alert_el);

                    expect(region.getAttribute('aria-live')).toBe('polite');
                    expect(region.textContent.trim()).toBe('');
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
                    const { full_jid, view, alert_el } = await openChatWithOnlineContact(_converse);

                    // A contact at -04:00 is at 13:00. Their offset differs from
                    // ours by 4 hours, and the user is typing, so it's the
                    // off-hours check alone that suppresses the alert here.
                    await respondWithTZO(_converse, full_jid, '-04:00', alert_el);
                    await startComposing(view);

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
                    const { full_jid, view, alert_el } = await openChatWithOnlineContact(_converse);

                    // 23:00 for them, so off-hours, but only 6 hours away from us.
                    await respondWithTZO(_converse, full_jid, '+06:00', alert_el);
                    await startComposing(view);

                    expect(alert_el.querySelector('.entity-time-alert')).toBeNull();
                },
            ),
        );

        it(
            'shows a warning for a contact only half an hour away',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                {
                    show_entity_time: true,
                    entity_time_warning_start: 17,
                    entity_time_warning_end: 18,
                },
                async function (_converse) {
                    const { full_jid, view, alert_el } = await openChatWithOnlineContact(_converse);

                    // 17:30 for them against our 17:00. Half-hour zones are real
                    // (India vs Pakistan), so a 30 minute difference counts.
                    await respondWithTZO(_converse, full_jid, '+00:30', alert_el);
                    await startComposing(view);

                    await u.waitUntil(() => alert_el.querySelector('.entity-time-alert'));
                    expect(alert_el.querySelector('.entity-time-alert__message').textContent).toContain(
                        u.time.formatRemoteTime(NOW, '+00:30'),
                    );
                },
            ),
        );

        it(
            'does not show a warning for a contact in our own timezone',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                {
                    show_entity_time: true,
                    // A window that our own local time falls inside, so only the
                    // zero timezone difference can be suppressing the alert.
                    entity_time_warning_start: 17,
                    entity_time_warning_end: 18,
                },
                async function (_converse) {
                    const { full_jid, view, alert_el } = await openChatWithOnlineContact(_converse);
                    await respondWithTZO(_converse, full_jid, '+00:00', alert_el);
                    await startComposing(view);

                    expect(alert_el.querySelector('.entity-time-alert')).toBeNull();
                },
            ),
        );

        it(
            'can be dismissed, and stays dismissed when the element is re-attached',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                {
                    show_entity_time: true,
                    entity_time_warning_start: 22,
                    entity_time_warning_end: 7,
                },
                async function (_converse) {
                    const { full_jid, view, alert_el } = await openChatWithOnlineContact(_converse);
                    await respondWithTZO(_converse, full_jid, '+06:00', alert_el);
                    await startComposing(view);

                    await u.waitUntil(() => alert_el.querySelector('.entity-time-alert'));
                    alert_el.querySelector('.entity-time-alert__dismiss').click();

                    await u.waitUntil(() => !alert_el.querySelector('.entity-time-alert'));

                    expect(alert_el.dismissed).toBe(true);

                    // Moving the element re-runs initialize(), which must not
                    // resurrect the warning the user just dismissed.
                    const parent = alert_el.parentElement;
                    alert_el.remove();
                    parent.appendChild(alert_el);
                    await u.waitUntil(() => alert_el.dismissed === true);

                    expect(alert_el.dismissed).toBe(true);
                    expect(alert_el.querySelector('.entity-time-alert')).toBeNull();
                },
            ),
        );

        it(
            'forgets a dismissal once the off-hours window has passed',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                {
                    show_entity_time: true,
                    entity_time_warning_start: 22,
                    entity_time_warning_end: 23,
                },
                async function (_converse) {
                    const { full_jid, view, alert_el } = await openChatWithOnlineContact(_converse);

                    // 22:45 for a contact in Nepal, inside the window.
                    await respondWithTZO(_converse, full_jid, '+05:45', alert_el);
                    await startComposing(view);
                    await u.waitUntil(() => alert_el.querySelector('.entity-time-alert'));

                    alert_el.querySelector('.entity-time-alert__dismiss').click();
                    await u.waitUntil(() => !alert_el.querySelector('.entity-time-alert'));

                    expect(alert_el.dismissed).toBe(true);

                    // Jumped rather than advanced, because advancing fake time
                    // runs every interval in Converse along the way, and this
                    // only cares about the minute their window ends.
                    vi.setSystemTime(new Date('2026-03-16T17:14:00Z')); // 22:59 for them

                    // Their clock reaches 23:00 and leaves the window. A
                    // dismissal silences the window it was made in, not every
                    // window from here on, so it's forgotten at that point.
                    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
                    await u.waitUntil(() => alert_el.dismissed === false);

                    // Rather than advance a whole day of fake timers, the window
                    // is moved to where their clock now is and the user starts
                    // typing again. What's being asserted is that the earlier
                    // dismissal is no longer suppressing anything.
                    _converse.api.settings.set('entity_time_warning_start', 23);
                    _converse.api.settings.set('entity_time_warning_end', 0);
                    await startComposing(view);

                    await u.waitUntil(() => alert_el.querySelector('.entity-time-alert'));
                },
            ),
        );

        it(
            'runs no clock for a contact it could never warn about',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                {
                    show_entity_time: true,
                    // A window our own local time falls inside, so the hour is
                    // never what's suppressing the warning here.
                    entity_time_warning_start: 17,
                    entity_time_warning_end: 18,
                },
                async function (_converse) {
                    const { full_jid, alert_el } = await openChatWithOnlineContact(_converse);

                    // Same timezone as us: no hour of any day can produce a
                    // warning, so there's nothing for a per-minute timer to
                    // discover. Their offset changing is an event the element
                    // listens for instead.
                    await respondWithTZO(_converse, full_jid, '+00:00', alert_el);

                    expect(alert_el._sync_timeout).toBeNull();
                    expect(alert_el._update_interval).toBeNull();
                },
            ),
        );

        it(
            'does not query for the time when show_entity_time is false',
            mock.initConverse(converse, ['chatBoxesFetched'], { show_entity_time: false }, async function (_converse) {
                const { alert_el } = await openChatWithOnlineContact(_converse);

                // Past the debounce on the virtual clock, so the query this
                // would otherwise send has had its chance.
                await vi.advanceTimersByTimeAsync(500);

                expect(findTimeIQ(_converse.api.connection.get().IQ_stanzas)).toBeUndefined();
                expect(alert_el.querySelector('.entity-time-alert')).toBeNull();
            }),
        );

        it(
            'shows nothing for entities that do not support XEP-0202',
            mock.initConverse(converse, ['chatBoxesFetched'], { show_entity_time: true }, async function (_converse) {
                const { api } = _converse;
                const { full_jid, alert_el } = await openChatWithOnlineContact(_converse);

                const sent_iq = await u.waitUntil(() => findTimeIQ(api.connection.get().IQ_stanzas));

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

                // The error leaves us without an offset, so there's nothing to warn about.
                await u.waitUntil(() => api.time.contact.get(alert_el.model.contact) === null);
                expect(api.time.contact.get(alert_el.model.contact)).toBeNull();
                expect(alert_el.querySelector('.entity-time-alert')).toBeNull();
            }),
        );
    });
});
