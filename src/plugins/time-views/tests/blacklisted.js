import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, sizzle, stx, u } = converse.env;

/**
 * @param {Element[]} stanzas
 */
function findTimeIQ(stanzas) {
    return stanzas.find((iq) => sizzle(`time[xmlns="${Strophe.NS.TIME}"]`, iq).length);
}

/**
 * @param {any} _converse
 */
async function openChatWithOnlineContact(_converse) {
    const { api } = _converse;
    await mock.waitForRoster(_converse, 'current', 1);
    await mock.openControlBox(_converse);

    const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
    const presence = stx`<presence from="${contact_jid}/resource" to="${_converse.jid}" xmlns="jabber:client"/>`;
    api.connection.get()._dataRecv(mock.createRequest(_converse, presence));

    const contact = await api.contacts.get(contact_jid);
    await u.waitUntil(() => contact.presence?.getHighestPriorityResource());

    await mock.openChatBoxFor(_converse, contact_jid);
    return contact_jid;
}

// Deliberately its own spec file. Custom elements can't be un-registered once
// defined on a page, so a spec sharing a page with the enabled ones would find
// converse-entity-time-alert already registered and prove nothing.
describe('The XEP-0202 plugins', function () {
    // Only so that the debounce can be wound past deterministically below; the
    // wall clock is irrelevant to these specs.
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it(
        'keep querying when only the view plugin is blacklisted, since querying is headless',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { blacklisted_plugins: ['converse-time-views'], show_entity_time: true },
            async function (_converse) {
                const { api } = _converse;
                const contact_jid = await openChatWithOnlineContact(_converse);

                // No UI: the element was never defined, so the tag the chat
                // template refers to stays an inert unknown element.
                expect(customElements.get('converse-entity-time-alert')).toBeUndefined();
                const view = _converse.chatboxviews.get(contact_jid);
                const alert_el = view.querySelector('converse-entity-time-alert');
                expect(alert_el).not.toBeNull();
                expect(alert_el.childElementCount).toBe(0);

                // The protocol half is untouched, which is what lets a
                // non-browser client reuse it.
                const sent_iq = await u.waitUntil(() => findTimeIQ(api.connection.get().IQ_stanzas));
                expect(sent_iq.getAttribute('to')).toBe(`${contact_jid}/resource`);
            },
        ),
    );

    it(
        'send no queries when the headless plugin is blacklisted',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { blacklisted_plugins: ['converse-time', 'converse-time-views'], show_entity_time: true },
            async function (_converse) {
                const { api } = _converse;
                await openChatWithOnlineContact(_converse);

                // Past the debounce on the virtual clock, so a query would have
                // been sent by now. (`api.time` itself can't be asserted on:
                // `api` is a module singleton, so the namespace an earlier spec
                // on this page assigned is still there.)
                await vi.advanceTimersByTimeAsync(500);
                expect(findTimeIQ(api.connection.get().IQ_stanzas)).toBeUndefined();
            },
        ),
    );

    it(
        'keep answering time queries when only the view plugin is blacklisted',
        mock.initConverse(
            converse,
            ['statusInitialized'],
            { blacklisted_plugins: ['converse-time-views'], send_entity_time: 'public' },
            async function (_converse) {
                const { api } = _converse;
                expect(typeof api.time?.get).toBe('function');

                api.connection.get()._dataRecv(
                    mock.createRequest(
                        _converse,
                        stx`<iq from="juliet@capulet.lit/balcony" to="${_converse.jid}"
                                id="time-1" type="get" xmlns="jabber:client">
                                <time xmlns="urn:xmpp:time"/>
                            </iq>`,
                    ),
                );

                // Answering is asynchronous, since deciding whether we may can
                // mean waiting for the roster. An IQ reply carries the id of
                // the request it answers.
                const response = await u.waitUntil(() =>
                    api.connection
                        .get()
                        .IQ_stanzas.find((/** @type {Element} */ iq) => iq.getAttribute('id') === 'time-1'),
                );
                expect(response.getAttribute('type')).toBe('result');
                expect(response.querySelector('tzo')).not.toBeNull();
            },
        ),
    );
});
