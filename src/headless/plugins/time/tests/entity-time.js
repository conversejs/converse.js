import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { Strophe, sizzle, stx, u } = converse.env;

const NOW = new Date('2026-03-16T17:00:00Z');

/**
 * @param {Element[]} stanzas
 */
function findTimeIQ(stanzas) {
    return stanzas.find((iq) => sizzle(`time[xmlns="${Strophe.NS.TIME}"]`, iq).length);
}

/**
 * How many time queries we've sent all told.
 * @param {any} _converse
 * @returns {number}
 */
function countTimeQueries(_converse) {
    return _converse.api.connection.get().IQ_stanzas.filter((/** @type {Element} */ iq) => findTimeIQ([iq])).length;
}

/**
 * The time query addressed to a given contact, whichever resource it went to.
 * @param {Element[]} stanzas
 * @param {string} bare_jid
 */
function findTimeIQTo(stanzas, bare_jid) {
    return stanzas.find(
        (iq) =>
            sizzle(`time[xmlns="${Strophe.NS.TIME}"]`, iq).length &&
            Strophe.getBareJidFromJid(iq.getAttribute('to') ?? '') === bare_jid,
    );
}

/**
 * Opens a chat with the first mock contact, having announced a full JID for them.
 * @param {any} _converse
 */
async function openChatWithOnlineContact(_converse) {
    const { api } = _converse;
    await mock.waitForRoster(_converse, 'current', 1);

    const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
    const full_jid = `${contact_jid}/resource`;
    api.connection
        .get()
        ._dataRecv(
            mock.createRequest(
                _converse,
                stx`<presence from="${full_jid}" to="${_converse.jid}" xmlns="jabber:client"/>`,
            ),
        );

    const contact = await api.contacts.get(contact_jid);
    await u.waitUntil(() => contact.presence?.getHighestPriorityResource());

    const chat = await api.chats.open(contact_jid);
    return { chat, contact_jid, full_jid };
}

/**
 * Answers the pending query with the given offset.
 * @param {any} _converse
 * @param {string} full_jid
 * @param {string} tzo
 * @param {any} chat
 */
async function respondWithTZO(_converse, full_jid, tzo, chat) {
    const { api } = _converse;
    const sent_iq = await u.waitUntil(() => findTimeIQ(api.connection.get().IQ_stanzas));
    api.connection.get()._dataRecv(
        mock.createRequest(
            _converse,
            stx`<iq type="result" from="${full_jid}" to="${_converse.jid}"
                    id="${sent_iq.getAttribute('id')}" xmlns="jabber:client">
                    <time xmlns="urn:xmpp:time"><tzo>${tzo}</tzo><utc>2026-03-16T17:00:00Z</utc></time>
                </iq>`,
        ),
    );
    await u.waitUntil(() => api.time.contact.get(chat.contact));
    return sent_iq;
}

describe("Tracking a contact's entity time", function () {
    beforeEach(() => {
        vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(0);
        vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
    });

    afterEach(() => vi.useRealTimers());

    it(
        'queries the contact when the chat is opened and records their offset',
        mock.initConverse(converse, ['chatBoxesFetched'], { show_entity_time: true }, async function (_converse) {
            const { chat, full_jid } = await openChatWithOnlineContact(_converse);

            // A bare JID would be answered by the server rather than the contact.
            const sent_iq = await respondWithTZO(_converse, full_jid, '+06:00', chat);
            expect(sent_iq.getAttribute('to')).toBe(full_jid);
            expect(_converse.api.time.contact.get(chat.contact).tzo).toBe('+06:00');
        }),
    );

    it(
        'does not query for chats that are merely restored, only for open ones',
        mock.initConverse(converse, ['chatBoxesFetched'], { show_entity_time: true }, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 2);

            const [restored_jid, opened_jid] = mock.cur_names
                .slice(0, 2)
                .map((name) => `${name.replace(/ /g, '.').toLowerCase()}@montague.lit`);

            for (const jid of [restored_jid, opened_jid]) {
                api.connection
                    .get()
                    ._dataRecv(
                        mock.createRequest(
                            _converse,
                            stx`<presence from="${jid}/resource" to="${_converse.jid}" xmlns="jabber:client"/>`,
                        ),
                    );
            }

            // One chat restored from storage as it would be at login, one opened
            // by the user. Waiting for the opened one's query is what makes the
            // restored one's silence meaningful: both queries would travel the
            // same debounce and the same event loop, so by the time the second
            // has landed, the first would have too.
            await api.chats.create(restored_jid, { closed: true });
            await api.chats.open(opened_jid);

            await u.waitUntil(() => findTimeIQTo(api.connection.get().IQ_stanzas, opened_jid));
            expect(findTimeIQTo(api.connection.get().IQ_stanzas, restored_jid)).toBeUndefined();
        }),
    );

    it(
        'falls back to a full JID from message history when the contact is offline',
        mock.initConverse(converse, ['chatBoxesFetched'], { show_entity_time: true }, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);

            // No presence for them, so getFullJID has nothing to resolve.
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            expect(converse.env.u.getFullJID(contact_jid)).toBeNull();

            await _converse.handleMessageStanza(stx`
                <message from="${contact_jid}/laptop" to="${_converse.bare_jid}"
                         type="chat" id="${u.getUniqueId()}" xmlns="jabber:client">
                    <body>Still up?</body>
                </message>`);

            const chat = await api.chats.get(contact_jid);
            await u.waitUntil(() => chat.messages.length);

            const sent_iq = await u.waitUntil(() => findTimeIQ(api.connection.get().IQ_stanzas));
            expect(sent_iq.getAttribute('to')).toBe(`${contact_jid}/laptop`);
        }),
    );

    it(
        'sends no queries when show_entity_time is false',
        mock.initConverse(converse, ['chatBoxesFetched'], { show_entity_time: false }, async function (_converse) {
            await openChatWithOnlineContact(_converse);
            // Past the debounce on the virtual clock, so a query would have been
            // sent by now however slow the machine running this is.
            await vi.advanceTimersByTimeAsync(500);
            expect(findTimeIQ(_converse.api.connection.get().IQ_stanzas)).toBeUndefined();
        }),
    );

    it(
        'asks again when the chat is reopened, rather than trusting what it already knows',
        mock.initConverse(converse, ['chatBoxesFetched'], { show_entity_time: true }, async function (_converse) {
            const { chat, full_jid } = await openChatWithOnlineContact(_converse);
            await respondWithTZO(_converse, full_jid, '+06:00', chat);

            expect(countTimeQueries(_converse)).toBe(1);

            // An offset we already have is the one thing that would stop us
            // noticing that they had travelled or crossed a DST boundary, so
            // reopening the chat has to ask again.
            chat.set('closed', true);
            chat.set('closed', false);
            await vi.advanceTimersByTimeAsync(500); // past the debounce
            await u.waitUntil(() => countTimeQueries(_converse) === 2);

            // The one we knew is still there while the new answer is in flight.
            expect(_converse.api.time.contact.get(chat.contact).tzo).toBe('+06:00');
        }),
    );

    it(
        'asks nothing more once the chat is closed, however their presence flaps',
        mock.initConverse(converse, ['chatBoxesFetched'], { show_entity_time: true }, async function (_converse) {
            const { api } = _converse;
            const { chat, full_jid } = await openChatWithOnlineContact(_converse);
            await respondWithTZO(_converse, full_jid, '+06:00', chat);
            expect(countTimeQueries(_converse)).toBe(1);

            chat.set('closed', true);
            await vi.advanceTimersByTimeAsync(500);

            // Their presence changing is normally a reason to re-ask, but a
            // chat the user has shut is not a chat to announce ourselves in.
            api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<presence from="${full_jid}" to="${_converse.jid}" xmlns="jabber:client">
                            <show>away</show>
                        </presence>`,
                ),
            );

            await vi.advanceTimersByTimeAsync(500);
            expect(countTimeQueries(_converse)).toBe(1);
        }),
    );

    it(
        "doesn't ask our own devices what time it is",
        mock.initConverse(converse, ['chatBoxesFetched'], { show_entity_time: true }, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);

            // A note-to-self chat: the contact is our own profile, and the full
            // JID it would resolve to is one of our own resources.
            api.connection
                .get()
                ._dataRecv(
                    mock.createRequest(
                        _converse,
                        stx`<presence from="${_converse.bare_jid}/phone" to="${_converse.jid}" xmlns="jabber:client"/>`,
                    ),
                );
            const chat = await api.chats.open(_converse.bare_jid);
            expect(chat.contact).toBe(_converse.state.profile);

            await vi.advanceTimersByTimeAsync(500);
            expect(countTimeQueries(_converse)).toBe(0);
        }),
    );

    it(
        'holds on to a question asked while it was waiting for an answer',
        mock.initConverse(converse, ['chatBoxesFetched'], { show_entity_time: true }, async function (_converse) {
            const { chat, full_jid } = await openChatWithOnlineContact(_converse);
            await u.waitUntil(() => countTimeQueries(_converse) === 1);

            // Their client is slow to answer, and the user closes and reopens
            // the chat while we're still waiting.
            chat.set('closed', true);
            chat.set('closed', false);
            await vi.advanceTimersByTimeAsync(500);
            expect(countTimeQueries(_converse)).toBe(1); // one at a time on the wire

            // The reopening is a question of its own, so answering the first
            // one is not the end of it.
            await respondWithTZO(_converse, full_jid, '+06:00', chat);
            await vi.advanceTimersByTimeAsync(500);
            await u.waitUntil(() => countTimeQueries(_converse) === 2);
        }),
    );

    it(
        'asks again once what it knows is old enough to have gone stale',
        mock.initConverse(converse, ['chatBoxesFetched'], { show_entity_time: true }, async function (_converse) {
            const { api } = _converse;
            const { chat, full_jid } = await openChatWithOnlineContact(_converse);
            await respondWithTZO(_converse, full_jid, '+06:00', chat);
            expect(countTimeQueries(_converse)).toBe(1);

            // A chat left open sees none of the events that would prompt a
            // re-query, and the contact's DST boundary doesn't announce itself.
            vi.setSystemTime(new Date(NOW.getTime() + 2 * 60 * 60 * 1000));
            await vi.advanceTimersByTimeAsync(500);
            expect(countTimeQueries(_converse)).toBe(1); // nobody has looked

            // Reading it is what asks, so that only the contacts somebody is
            // actually looking at are asked again.
            expect(api.time.contact.get(chat.contact).tzo).toBe('+06:00');
            await vi.advanceTimersByTimeAsync(500);
            await u.waitUntil(() => countTimeQueries(_converse) === 2);
        }),
    );

    it(
        'keeps the offset out of the stored chat, where a later save would strand it',
        mock.initConverse(converse, ['chatBoxesFetched'], { show_entity_time: true }, async function (_converse) {
            const { chat, contact_jid, full_jid } = await openChatWithOnlineContact(_converse);
            await respondWithTZO(_converse, full_jid, '+06:00', chat);

            // What the composer does as the user types. `save()` writes every
            // attribute the chat holds, so an offset kept as one would reach
            // durable storage this way and be rehydrated on the next page load,
            // to be shown for a contact who may be offline and so unaskable.
            await chat.save({ draft: 'hello' });

            const stored = await _converse.state.chatboxes.browserStorage.findAll();
            const record = stored.find((r) => r.jid === contact_jid);

            expect(record.draft).toBe('hello'); // the save did happen
            expect('entity_time_tzo' in record).toBe(false);
            expect(_converse.api.time.contact.get(chat.contact).tzo).toBe('+06:00'); // still known, in memory
        }),
    );

    describe('api.time.contact.get', function () {
        it(
            'reports the contact as off-hours and worth warning about',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                { show_entity_time: true, entity_time_warning_start: 22, entity_time_warning_end: 7 },
                async function (_converse) {
                    const { chat, full_jid } = await openChatWithOnlineContact(_converse);
                    await respondWithTZO(_converse, full_jid, '+06:00', chat);

                    // 17:00 UTC for us, so 23:00 for them.
                    expect(_converse.api.time.contact.get(chat.contact)).toEqual({
                        tzo: '+06:00',
                        // How 23:00 is written depends on the locale, which is
                        // covered in time.js. What matters here is the hour.
                        time: u.time.formatRemoteTime(NOW, '+06:00'),
                        hour: 23,
                        differs_by_minutes: 360,
                        differs_enough: true,
                        is_off_hours: true,
                        should_warn: true,
                    });
                },
            ),
        );

        it(
            'reports working hours as not worth warning about',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                { show_entity_time: true, entity_time_warning_start: 22, entity_time_warning_end: 7 },
                async function (_converse) {
                    const { chat, full_jid } = await openChatWithOnlineContact(_converse);
                    await respondWithTZO(_converse, full_jid, '-04:00', chat);

                    const t = _converse.api.time.contact.get(chat.contact);
                    expect(t.time).toBe(u.time.formatRemoteTime(NOW, '-04:00'));
                    expect(t.hour).toBe(13);
                    // Far enough away to be worth warning about, but the hour
                    // is a perfectly reasonable one.
                    expect(t.differs_enough).toBe(true);
                    expect(t.is_off_hours).toBe(false);
                    expect(t.should_warn).toBe(false);
                },
            ),
        );

        it(
            'never warns about a contact in our own timezone',
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                { show_entity_time: true, entity_time_warning_start: 17, entity_time_warning_end: 18 },
                async function (_converse) {
                    const { chat, full_jid } = await openChatWithOnlineContact(_converse);
                    await respondWithTZO(_converse, full_jid, '+00:00', chat);

                    const t = _converse.api.time.contact.get(chat.contact);
                    expect(t.differs_by_minutes).toBe(0);
                    expect(t.differs_enough).toBe(false); // and so never worth a clock, either
                    expect(t.is_off_hours).toBe(true); // it *is* inside the window
                    expect(t.should_warn).toBe(false); // but our own clock already says so
                },
            ),
        );

        it(
            'honours entity_time_min_diff_hours',
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
                    const { chat, full_jid } = await openChatWithOnlineContact(_converse);
                    await respondWithTZO(_converse, full_jid, '+06:00', chat);

                    const t = _converse.api.time.contact.get(chat.contact);
                    expect(t.is_off_hours).toBe(true);
                    expect(t.should_warn).toBe(false); // only 6 hours away, threshold is 8
                },
            ),
        );

        it(
            'returns null while the offset is unknown',
            mock.initConverse(converse, ['chatBoxesFetched'], { show_entity_time: true }, async function (_converse) {
                const { chat } = await openChatWithOnlineContact(_converse);
                expect(_converse.api.time.contact.get(chat.contact)).toBeNull();
            }),
        );
    });
});
