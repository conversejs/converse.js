/* global converse */
import mock from '../../../tests/mock.js';

const { Strophe, sizzle, stx, u } = converse.env;

describe('Popular Emojis', function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    describe('PopularEmojis Model', function () {
        it(
            'records usage timestamps correctly',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const popular_emojis = _converse.state.popular_emojis;
                expect(popular_emojis).toBeDefined();
                expect(Object.keys(popular_emojis.get('timestamps'))).toEqual([]);

                const before = new Date().toISOString();
                // Unicode input is stored as-is (preserving variation selectors)
                popular_emojis.recordUsage(['👍', '❤️', '🎉']);
                const after = new Date().toISOString();

                const timestamps = popular_emojis.get('timestamps');
                expect(timestamps['👍']).toBeDefined();
                expect(timestamps['❤️']).toBeDefined();
                expect(timestamps['🎉']).toBeDefined();

                // All timestamps should be within the test window
                for (const emoji of ['👍', '❤️', '🎉']) {
                    expect(timestamps[emoji] >= before).toBeTrue();
                    expect(timestamps[emoji] <= after).toBeTrue();
                }
            }),
        );

        it(
            'records shortname usage as unicode',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const popular_emojis = _converse.state.popular_emojis;

                // Shortname input is converted to unicode before storage
                popular_emojis.recordUsage([':thumbsup:', ':heart:', ':tada:']);

                const timestamps = popular_emojis.get('timestamps');
                expect(timestamps['👍']).toBeDefined();
                expect(timestamps['❤️']).toBeDefined();
                expect(timestamps['🎉']).toBeDefined();
                expect(timestamps[':thumbsup:']).toBeUndefined();
                expect(timestamps[':heart:']).toBeUndefined();
                expect(timestamps[':tada:']).toBeUndefined();
            }),
        );

        it(
            'returns emojis sorted by most recently used first',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const popular_emojis = _converse.state.popular_emojis;

                // Set timestamps directly to control ordering (unicode keys)
                popular_emojis.save({
                    timestamps: {
                        '😂': '2026-03-29T10:00:00.000Z',
                        '❤️': '2026-03-29T12:00:00.000Z',
                        '👍': '2026-03-29T11:00:00.000Z',
                        '😮': '2026-03-29T09:00:00.000Z',
                    },
                });

                // Most recent first
                const sorted = popular_emojis.getSortedEmojis();
                expect(sorted).toEqual(['❤️', '👍', '😂', '😮']);

                // Respects maxLength
                const limited = popular_emojis.getSortedEmojis(2);
                expect(limited).toEqual(['❤️', '👍']);
            }),
        );

        it(
            'overwrites the previous timestamp when an emoji is used again',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const popular_emojis = _converse.state.popular_emojis;
                popular_emojis.save({
                    timestamps: {
                        '❤️': '2026-03-29T10:00:00.000Z',
                        '👍': '2026-03-29T12:00:00.000Z',
                    },
                });

                // Using the unicode form directly — should update the '❤️' key
                popular_emojis.recordUsage(['❤️']);

                const sorted = popular_emojis.getSortedEmojis();
                expect(sorted[0]).toBe('❤️');
            }),
        );
    });

    describe('PubSub Storage and Retrieval', function () {
        it(
            'fetches popular reactions from PEP node on connect',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 0);
                const own_jid = _converse.session.get('jid');
                const bare_jid = Strophe.getBareJidFromJid(own_jid);
                const sent_stanzas = api.connection.get().sent_stanzas;
                const sent_stanza = await u.waitUntil(() =>
                    sent_stanzas
                        .filter((iq) => sizzle(`pubsub items[node="${Strophe.NS.REACTIONS_POPULAR}"]`, iq).length)
                        .pop(),
                );
                expect(sent_stanza).toEqualStanza(stx`
                    <iq type="get" xmlns="jabber:client"
                        from="${bare_jid}"
                        to="${bare_jid}"
                        id="${sent_stanza.getAttribute('id')}">
                        <pubsub xmlns="${Strophe.NS.PUBSUB}">
                            <items node="${Strophe.NS.REACTIONS_POPULAR}" max_items="1"/>
                        </pubsub>
                    </iq>
                `);

                const returned_stanza = stx`
                    <iq type="result" xmlns="jabber:client"
                        from="${_converse.session.get('bare_jid')}"
                        to="${_converse.jid}"
                        id="${sent_stanza.getAttribute('id')}">
                        <pubsub xmlns="${Strophe.NS.PUBSUB}">
                            <items node="${Strophe.NS.REACTIONS_POPULAR}">
                                <item id="current">
                                    <popular-reactions xmlns="${Strophe.NS.REACTIONS_POPULAR}">
                                        <reaction stamp="2026-03-29T12:00:00.000Z">👍</reaction>
                                        <reaction stamp="2026-03-29T11:00:00.000Z">❤️</reaction>
                                        <reaction stamp="2026-03-29T10:00:00.000Z">🎉</reaction>
                                    </popular-reactions>
                                </item>
                            </items>
                        </pubsub>
                    </iq>
                `;
                _converse.api.connection.get()._dataRecv(mock.createRequest(returned_stanza));

                const { popular_emojis } = _converse.state;
                await u.waitUntil(() => Object.keys(popular_emojis.get('timestamps')).length);
                const timestamps = popular_emojis.get('timestamps');
                // Stanza unicode is stored directly as the key
                expect(timestamps['👍']).toBe('2026-03-29T12:00:00.000Z');
                expect(timestamps['❤️']).toBe('2026-03-29T11:00:00.000Z');
                expect(timestamps['🎉']).toBe('2026-03-29T10:00:00.000Z');

                // Verify sorted order: most recent first
                const sorted = popular_emojis.getSortedEmojis();
                expect(sorted).toEqual(['👍', '❤️', '🎉']);
            }),
        );
    });

    describe('Cross-device Synchronization', function () {
        it(
            'merges incoming PEP timestamps with local ones, keeping the most recent per emoji',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const { popular_emojis } = _converse.state;

                // Simulate local usage with unicode keys
                popular_emojis.save({
                    timestamps: {
                        '👍': '2026-03-29T13:00:00.000Z', // local is newer
                        '🎉': '2026-03-29T09:00:00.000Z', // local is older
                    },
                });

                const bare_jid = _converse.session.get('bare_jid');

                // Incoming PEP event from another device:
                // ❤️ is new (not local), 👍 is older than local, 🎉 is newer than local
                const stanza = stx`
                    <message xmlns="jabber:client"
                        from="${bare_jid}"
                        to="${_converse.jid}"
                        type="headline">
                        <event xmlns="${Strophe.NS.PUBSUB_EVENT}">
                            <items node="${Strophe.NS.REACTIONS_POPULAR}">
                                <item id="current">
                                    <popular-reactions xmlns="${Strophe.NS.REACTIONS_POPULAR}">
                                        <reaction stamp="2026-03-29T14:00:00.000Z">🎉</reaction>
                                        <reaction stamp="2026-03-29T11:00:00.000Z">👍</reaction>
                                        <reaction stamp="2026-03-29T12:00:00.000Z">❤️</reaction>
                                    </popular-reactions>
                                </item>
                            </items>
                        </event>
                    </message>
                `;
                _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

                await u.waitUntil(() => popular_emojis.get('timestamps')['❤️']);

                const timestamps = popular_emojis.get('timestamps');

                // 👍 — local (13:00) is newer than remote (11:00), keep local
                expect(timestamps['👍']).toBe('2026-03-29T13:00:00.000Z');

                // 🎉 — remote (14:00) is newer than local (09:00), use remote
                expect(timestamps['🎉']).toBe('2026-03-29T14:00:00.000Z');

                // ❤️ — only on remote, should be added
                expect(timestamps['❤️']).toBe('2026-03-29T12:00:00.000Z');

                // Sorted order: 🎉 (14:00), 👍 (13:00 local), ❤️ (12:00)
                const sorted = popular_emojis.getSortedEmojis();
                expect(sorted).toEqual(['🎉', '👍', '❤️']);
            }),
        );

        it(
            'does not overwrite a newer local timestamp with an older remote one',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const { popular_emojis } = _converse.state;

                // Local has a very recent usage
                popular_emojis.save({
                    timestamps: {
                        '👍': '2026-03-29T15:00:00.000Z',
                    },
                });

                const bare_jid = _converse.session.get('bare_jid');

                // Remote has an older timestamp for the same emoji
                const stanza = stx`
                    <message xmlns="jabber:client"
                        from="${bare_jid}"
                        to="${_converse.jid}"
                        type="headline">
                        <event xmlns="${Strophe.NS.PUBSUB_EVENT}">
                            <items node="${Strophe.NS.REACTIONS_POPULAR}">
                                <item id="current">
                                    <popular-reactions xmlns="${Strophe.NS.REACTIONS_POPULAR}">
                                        <reaction stamp="2026-03-29T10:00:00.000Z">👍</reaction>
                                    </popular-reactions>
                                </item>
                            </items>
                        </event>
                    </message>
                `;
                _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

                // Give it a moment to process
                await u.waitUntil(() => true);

                const timestamps = popular_emojis.get('timestamps');
                // Local timestamp must be preserved
                expect(timestamps['👍']).toBe('2026-03-29T15:00:00.000Z');
            }),
        );
        it(
            'preserves skin-tone modifiers in unicode keys',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const popular_emojis = _converse.state.popular_emojis;
                popular_emojis.recordUsage(['👍🏽']);

                // The skin-tone modifier must be preserved in the stored key
                const timestamps = popular_emojis.get('timestamps');
                expect(timestamps['👍🏽']).toBeDefined();
                expect(timestamps['👍']).toBeUndefined();

                // getPopularEmojis must return the skin-tone emoji as a distinct entry
                const result = await popular_emojis.getPopularEmojis();
                expect(result['👍🏽']).toBeDefined();
                expect(result['👍🏽'].sn).toBe(':thumbsup_tone3:');
            }),
        );
    });

    describe('getPopularEmojis', function () {
        it(
            'returns emoji data keyed by the stored unicode, preserving variation selectors',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const popular_emojis = _converse.state.popular_emojis;
                popular_emojis.save({
                    timestamps: {
                        '👍': '2026-03-29T12:00:00.000Z',
                        '❤️': '2026-03-29T11:00:00.000Z',
                    },
                });

                const result = await popular_emojis.getPopularEmojis();
                // Keyed by the stored unicode key, preserving variation selectors
                expect(result['👍']).toBeDefined();
                expect(result['👍'].sn).toBe(':thumbsup:');
                expect(result['❤️']).toBeDefined();
                expect(result['❤️'].sn).toBe(':heart:');
                // Padded with default popular_emojis (length 5) — the two stored
                // emojis overlap with :thumbsup: and :heart: defaults, leaving room
                // for the 3 remaining defaults.
                expect(Object.keys(result).length).toBe(5);
            }),
        );

        it(
            'respects the popular_emojis setting length',
            mock.initConverse(
                ['chatBoxesFetched'],
                { 'popular_emojis': [':thumbsup:', ':heart:'] },
                async function (_converse) {
                    await mock.waitForRoster(_converse, 'current', 0);

                    const popular_emojis = _converse.state.popular_emojis;
                    popular_emojis.save({
                        timestamps: {
                            '😂': '2026-03-29T14:00:00.000Z',
                            '❤️': '2026-03-29T13:00:00.000Z',
                            '👍': '2026-03-29T12:00:00.000Z',
                            '🎉': '2026-03-29T11:00:00.000Z',
                        },
                    });

                    const result = await popular_emojis.getPopularEmojis();
                    // Setting length is 2, so only the 2 most recent should be returned
                    expect(Object.keys(result)).toEqual(['😂', '❤️']);
                },
            ),
        );

        it(
            'filters out emoji not found in emoji data',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const popular_emojis = _converse.state.popular_emojis;
                popular_emojis.save({
                    timestamps: {
                        '👍': '2026-03-29T12:00:00.000Z',
                        '🫠': '2026-03-29T11:00:00.000Z',
                    },
                });

                const result = await popular_emojis.getPopularEmojis();
                expect(result['👍']).toBeDefined();
                expect(result['🫠']).toBeUndefined();
            }),
        );
    });
});
