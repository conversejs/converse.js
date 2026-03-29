/* global converse */
import mock from '../../../tests/mock.js';

const { Strophe, sizzle, stx, u } = converse.env;

describe('Popular Reactions Timestamp Tracking', function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    describe('PopularReactions Model', function () {
        it(
            'records usage timestamps correctly',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const popular_reactions = _converse.state.popular_reactions;
                expect(popular_reactions).toBeDefined();
                expect(Object.keys(popular_reactions.get('timestamps'))).toEqual([]);

                const before = new Date().toISOString();
                popular_reactions.recordUsage(':thumbsup:');
                popular_reactions.recordUsage(':heart:');
                popular_reactions.recordUsage(':tada:');
                const after = new Date().toISOString();

                const timestamps = popular_reactions.get('timestamps');
                expect(timestamps[':thumbsup:']).toBeDefined();
                expect(timestamps[':heart:']).toBeDefined();
                expect(timestamps[':tada:']).toBeDefined();

                // All timestamps should be within the test window
                for (const sn of [':thumbsup:', ':heart:', ':tada:']) {
                    expect(timestamps[sn] >= before).toBeTrue();
                    expect(timestamps[sn] <= after).toBeTrue();
                }
            }),
        );

        it(
            'returns emojis sorted by most recently used first',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const popular_reactions = _converse.state.popular_reactions;

                // Set timestamps directly to control ordering
                popular_reactions.save({
                    timestamps: {
                        ':joy:': '2026-03-29T10:00:00.000Z',
                        ':heart:': '2026-03-29T12:00:00.000Z',
                        ':thumbsup:': '2026-03-29T11:00:00.000Z',
                        ':open_mouth:': '2026-03-29T09:00:00.000Z',
                    },
                });

                // Most recent first
                const sorted = popular_reactions.getSortedEmojis();
                expect(sorted).toEqual([':heart:', ':thumbsup:', ':joy:', ':open_mouth:']);

                // Respects maxLength
                const limited = popular_reactions.getSortedEmojis(2);
                expect(limited).toEqual([':heart:', ':thumbsup:']);
            }),
        );

        it(
            'overwrites the previous timestamp when an emoji is used again',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const popular_reactions = _converse.state.popular_reactions;
                popular_reactions.save({
                    timestamps: {
                        ':heart:': '2026-03-29T10:00:00.000Z',
                        ':thumbsup:': '2026-03-29T12:00:00.000Z',
                    },
                });

                // :heart: was older, but after using it again it should be most recent
                popular_reactions.recordUsage(':heart:');

                const sorted = popular_reactions.getSortedEmojis();
                expect(sorted[0]).toBe(':heart:');
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

                const { popular_reactions } = _converse.state;
                await u.waitUntil(() => Object.keys(popular_reactions.get('timestamps')).length);
                const timestamps = popular_reactions.get('timestamps');
                expect(timestamps[':thumbsup:']).toBe('2026-03-29T12:00:00.000Z');
                expect(timestamps[':heart:']).toBe('2026-03-29T11:00:00.000Z');
                expect(timestamps[':tada:']).toBe('2026-03-29T10:00:00.000Z');

                // Verify sorted order: most recent first
                const sorted = popular_reactions.getSortedEmojis();
                expect(sorted).toEqual([':thumbsup:', ':heart:', ':tada:']);
            }),
        );
    });

    describe('Cross-device Synchronization', function () {
        it(
            'merges incoming PEP timestamps with local ones, keeping the most recent per emoji',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const { popular_reactions } = _converse.state;

                // Simulate local usage: :thumbsup: used very recently, :tada: used earlier
                popular_reactions.save({
                    timestamps: {
                        ':thumbsup:': '2026-03-29T13:00:00.000Z', // local is newer
                        ':tada:': '2026-03-29T09:00:00.000Z', // local is older
                    },
                });

                const bare_jid = _converse.session.get('bare_jid');

                // Incoming PEP event from another device:
                // :heart: is new (not local), :thumbsup: is older than local, :tada: is newer than local
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

                await u.waitUntil(() => popular_reactions.get('timestamps')[':heart:']);

                const timestamps = popular_reactions.get('timestamps');

                // :thumbsup: — local (13:00) is newer than remote (11:00), keep local
                expect(timestamps[':thumbsup:']).toBe('2026-03-29T13:00:00.000Z');

                // :tada: — remote (14:00) is newer than local (09:00), use remote
                expect(timestamps[':tada:']).toBe('2026-03-29T14:00:00.000Z');

                // :heart: — only on remote, should be added
                expect(timestamps[':heart:']).toBe('2026-03-29T12:00:00.000Z');

                // Sorted order: :tada: (14:00), :heart: (12:00), :thumbsup: (13:00 local → second)
                const sorted = popular_reactions.getSortedEmojis();
                expect(sorted).toEqual([':tada:', ':thumbsup:', ':heart:']);
            }),
        );

        it(
            'does not overwrite a newer local timestamp with an older remote one',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const { popular_reactions } = _converse.state;

                // Local has a very recent usage
                popular_reactions.save({
                    timestamps: {
                        ':thumbsup:': '2026-03-29T15:00:00.000Z',
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

                const timestamps = popular_reactions.get('timestamps');
                // Local timestamp must be preserved
                expect(timestamps[':thumbsup:']).toBe('2026-03-29T15:00:00.000Z');
            }),
        );
    });
});
