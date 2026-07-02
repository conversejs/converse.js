import { describe, it, expect, vi } from 'vitest';
import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';
import { ATOM, MICROBLOG_NODE, PUBSUB_EVENT, makePostStanza, receive } from './utils.js';

const { stx, u } = converse.env;

describe('The microblog plugin', function () {
    it(
        'parses an incoming PEP microblog event into the feed',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');

            const feed = await api.microblog.feeds.own();
            expect(feed).toBeDefined();
            expect(feed.get('node')).toBe(MICROBLOG_NODE);
            expect(feed.messages.length).toBe(0);

            receive(
                _converse,
                stx`
                <message xmlns="jabber:client" from="${bare_jid}" to="${bare_jid}" type="headline">
                  <event xmlns="${PUBSUB_EVENT}">
                    <items node="${MICROBLOG_NODE}">
                      <item id="post-1" publisher="${bare_jid}">
                        <entry xmlns="${ATOM}">
                          <title type="text">hanging out at the Café Napolitano</title>
                          <id>tag:montague.lit,2024-01-01:posts-post-1</id>
                          <published>2024-01-01T18:30:02Z</published>
                          <updated>2024-01-01T18:30:02Z</updated>
                        </entry>
                      </item>
                    </items>
                  </event>
                </message>`,
            );

            await u.waitUntil(() => feed.messages.length === 1);
            const post = feed.messages.at(0);
            expect(post.get('type')).toBe('microblog');
            expect(post.get('title')).toBe('hanging out at the Café Napolitano');
            expect(post.get('id')).toBe('post-1');
            expect(post.get('atom_id')).toBe('tag:montague.lit,2024-01-01:posts-post-1');
            expect(post.get('published')).toBe('2024-01-01T18:30:02Z');
            // The computed `is_mine` replaces the legacy `sender` flag.
            expect(post.get('is_mine')).toBe(true);
        }),
    );

    it(
        'detects a repost and surfaces the original author',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');

            const feed = await api.microblog.feeds.own();

            receive(
                _converse,
                stx`
                <message xmlns="jabber:client" from="${bare_jid}" to="${bare_jid}" type="headline">
                  <event xmlns="${PUBSUB_EVENT}">
                    <items node="${MICROBLOG_NODE}">
                      <item id="repost-1" publisher="${bare_jid}">
                        <entry xmlns="${ATOM}">
                          <author>
                            <name>Romeo Montague</name>
                            <uri>xmpp:romeo@montague.lit</uri>
                          </author>
                          <title type="text">hanging out at the Café Napolitano</title>
                          <id>tag:montague.lit,2024-01-01:posts-repost-1</id>
                          <link rel="via"
                                href="xmpp:romeo@montague.lit?;node=urn%3Axmpp%3Amicroblog%3A0;item=orig"/>
                          <published>2024-01-01T18:32:02Z</published>
                          <updated>2024-01-01T18:32:02Z</updated>
                        </entry>
                      </item>
                    </items>
                  </event>
                </message>`,
            );

            await u.waitUntil(() => feed.messages.length === 1);
            const post = feed.messages.at(0);
            expect(post.get('is_repost')).toBe(true);
            expect(post.get('via_jid')).toBe('romeo@montague.lit');
            expect(post.get('author_jid')).toBe('romeo@montague.lit');
            // `displayName` is a computed property derived from the author.
            expect(post.get('displayName')).toBe('Romeo Montague');
            // We republished it, so it's still ours.
            expect(post.get('is_mine')).toBe(true);
            // The reposter (publisher) is surfaced distinctly from the original
            // author — here that's us, so the view labels the repost "You".
            expect(post.getReposterJID()).toBe(bare_jid);
        }),
    );

    it(
        "names the reposter separately from the original author for a followed feed's repost",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const reposter = 'alice@wonderland.lit';
            const author = 'bob@builder.lit';

            // We follow Alice's feed; she reposts Bob, who isn't in our roster.
            const feed = await api.microblog.feeds.get(reposter, MICROBLOG_NODE, true);
            // Seed Alice's vCard so the "… reposted" line can resolve a name
            // without entering the roster (mirrors how avatars resolve).
            _converse.state.vcards.create({ jid: reposter, nickname: 'Alice' });

            receive(
                _converse,
                stx`
                <message xmlns="jabber:client" from="${reposter}" to="${reposter}" type="headline">
                  <event xmlns="${PUBSUB_EVENT}">
                    <items node="${MICROBLOG_NODE}">
                      <item id="repost-2" publisher="${reposter}">
                        <entry xmlns="${ATOM}">
                          <author>
                            <name>Bob the Builder</name>
                            <uri>xmpp:${author}</uri>
                          </author>
                          <title type="text">Can we fix it?</title>
                          <id>tag:builder.lit,2024-01-02:posts-repost-2</id>
                          <link rel="via" href="xmpp:${author}?;node=urn%3Axmpp%3Amicroblog%3A0;item=orig"/>
                          <published>2024-01-02T09:00:00Z</published>
                          <updated>2024-01-02T09:00:00Z</updated>
                        </entry>
                      </item>
                    </items>
                  </event>
                </message>`,
            );

            await u.waitUntil(() => feed.messages.length === 1);
            const post = feed.messages.at(0);

            // The main author is the *original* poster (Bob), not the reposter.
            expect(post.get('is_repost')).toBe(true);
            expect(post.get('is_mine')).toBe(false);
            expect(post.getAuthorJID()).toBe(author);
            expect(post.get('displayName')).toBe('Bob the Builder');

            // The reposter (Alice, whose feed we follow) is surfaced distinctly,
            // and her name resolves from the vCard cache — not the roster.
            expect(post.getReposterJID()).toBe(reposter);
            await u.waitUntil(() => post.getReposterName() === 'Alice');
            expect(_converse.roster.get(reposter)).toBeUndefined();
            expect(_converse.roster.get(author)).toBeUndefined();
        }),
    );

    it(
        'shows the author nickname, not the bare JID, when a post embeds no author name',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const jid = 'roughnecks@woodpeckersnest.space';
            // The author is a roster contact (so a nickname is known) whose feed
            // we also follow.
            _converse.roster.create({ jid, subscription: 'both', nickname: 'Roughnecks' });
            const feed = await api.microblog.feeds.get(jid, MICROBLOG_NODE, true);

            // A post that carries an <author><uri> but *no* <name> — the shape
            // that previously fell through to displaying the bare JID.
            receive(
                _converse,
                stx`
                <message xmlns="jabber:client" from="${jid}" to="${jid}" type="headline">
                  <event xmlns="${PUBSUB_EVENT}">
                    <items node="${MICROBLOG_NODE}">
                      <item id="p1" publisher="${jid}">
                        <entry xmlns="${ATOM}">
                          <author><uri>xmpp:${jid}</uri></author>
                          <title type="text">commutiny out now!</title>
                          <id>tag:woodpeckersnest.space,2025-01-11:p1</id>
                          <published>2025-01-11T06:35:44Z</published>
                          <updated>2025-01-11T06:35:44Z</updated>
                        </entry>
                      </item>
                    </items>
                  </event>
                </message>`,
            );

            await u.waitUntil(() => feed.messages.length === 1);
            const post = feed.messages.at(0);
            expect(post.get('author_name')).toBeUndefined();
            expect(post.get('author_jid')).toBe(jid);
            // Resolves to the contact's nickname, never the raw JID.
            await u.waitUntil(() => post.get('displayName') === 'Roughnecks');
        }),
    );

    it(
        "falls back to a non-contact author's vCard name when a post embeds no author name",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            // A JID the mock vCard fetcher resolves to "Guest Author"; not a
            // roster contact, so only the vCard cache can name them.
            const jid = 'guest.author@example.org';
            const feed = await api.microblog.feeds.get(jid, MICROBLOG_NODE, true);

            receive(
                _converse,
                stx`
                <message xmlns="jabber:client" from="${jid}" to="${jid}" type="headline">
                  <event xmlns="${PUBSUB_EVENT}">
                    <items node="${MICROBLOG_NODE}">
                      <item id="p1" publisher="${jid}">
                        <entry xmlns="${ATOM}">
                          <author><uri>xmpp:${jid}</uri></author>
                          <title type="text">a nameless post</title>
                          <id>tag:example.org,2025-01-11:p1</id>
                          <published>2025-01-11T06:35:44Z</published>
                          <updated>2025-01-11T06:35:44Z</updated>
                        </entry>
                      </item>
                    </items>
                  </event>
                </message>`,
            );

            await u.waitUntil(() => feed.messages.length === 1);
            const post = feed.messages.at(0);
            expect(_converse.roster.get(jid)).toBeUndefined();

            // Simulate the author's vCard arriving (in production a post fetches it
            // eagerly for the avatar). The display name must then resolve to the
            // vCard name — reactively, and never the bare JID — without the author
            // ever entering the roster.
            await api.vcard.update(_converse.state.vcards.get(jid), true);
            await u.waitUntil(() => post.get('displayName') === 'Guest Author');
            expect(_converse.roster.get(jid)).toBeUndefined();
        }),
    );

    it(
        'parses a post with rich (XHTML) content',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');
            const feed = await api.microblog.feeds.own();

            receive(
                _converse,
                stx`
                <message xmlns="jabber:client" from="${bare_jid}" to="${bare_jid}" type="headline">
                  <event xmlns="${PUBSUB_EVENT}">
                    <items node="${MICROBLOG_NODE}">
                      <item id="rich-1" publisher="${bare_jid}">
                        <entry xmlns="${ATOM}">
                          <title type="xhtml">
                            <div xmlns="http://www.w3.org/1999/xhtml">
                              <p>hanging out at the <strong>Café</strong></p>
                            </div>
                          </title>
                          <id>tag:montague.lit,2024-01-01:posts-rich-1</id>
                          <published>2024-01-01T18:30:02Z</published>
                          <updated>2024-01-01T18:30:02Z</updated>
                        </entry>
                      </item>
                    </items>
                  </event>
                </message>`,
            );

            await u.waitUntil(() => feed.messages.length === 1);
            const post = feed.messages.at(0);
            expect(post.get('title_xhtml')).toContain('<strong>Café</strong>');
        }),
    );

    it(
        'parses the Atom title, summary and content as distinct constructs',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const jid = 'ivan@vucica.net';
            const feed = await api.microblog.feeds.get(jid, MICROBLOG_NODE, true);

            // An entry carrying all three Atom text constructs. Each is kept
            // distinct (the template styles them differently) rather than flattened.
            receive(
                _converse,
                stx`
                <message xmlns="jabber:client" from="${jid}" to="${jid}" type="headline">
                  <event xmlns="${PUBSUB_EVENT}">
                    <items node="${MICROBLOG_NODE}">
                      <item id="all-three" publisher="${jid}">
                        <entry xmlns="${ATOM}">
                          <title type="text">Hi again</title>
                          <summary>This is my post 2nd</summary>
                          <content type="text">Sharing a post.</content>
                          <published>2018-02-12T01:22:03Z</published>
                          <updated>2018-02-12T01:22:03Z</updated>
                        </entry>
                      </item>
                    </items>
                  </event>
                </message>`,
            );

            await u.waitUntil(() => feed.messages.length === 1);
            const post = feed.messages.at(0);
            expect(post.get('title')).toBe('Hi again');
            expect(post.get('summary')).toBe('This is my post 2nd');
            expect(post.get('content')).toBe('Sharing a post.');
        }),
    );

    it(
        'parses <content> when the Atom <title> is empty',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const jid = 'ivan@vucica.net';
            const feed = await api.microblog.feeds.get(jid, MICROBLOG_NODE, true);

            // Atom-native entry: empty <title/>, body in <content>. Our own posts
            // use <title>, but other servers (e.g. vucica.net) don't — these used
            // to render blank.
            receive(
                _converse,
                stx`
                <message xmlns="jabber:client" from="${jid}" to="${jid}" type="headline">
                  <event xmlns="${PUBSUB_EVENT}">
                    <items node="${MICROBLOG_NODE}">
                      <item id="content-only" publisher="${jid}">
                        <entry xmlns="${ATOM}">
                          <title/>
                          <content type="text">yo</content>
                          <published>2018-02-12T01:46:14Z</published>
                          <updated>2018-02-12T01:46:14Z</updated>
                        </entry>
                      </item>
                    </items>
                  </event>
                </message>`,
            );

            await u.waitUntil(() => feed.messages.length === 1);
            const post = feed.messages.at(0);
            expect(post.get('title')).toBeUndefined();
            expect(post.get('content')).toBe('yo');
        }),
    );

    it(
        'stamps a creation time for a dateless post and keeps it across re-delivery',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');
            const feed = await api.microblog.feeds.own();

            // A degenerate entry seen in the wild: a title but neither a
            // <published> nor an <updated> element.
            const stanza = stx`
                <message xmlns="jabber:client" from="${bare_jid}" to="${bare_jid}" type="headline">
                  <event xmlns="${PUBSUB_EVENT}">
                    <items node="${MICROBLOG_NODE}">
                      <item id="dateless-1" publisher="${bare_jid}">
                        <entry xmlns="${ATOM}">
                          <title>Hi again</title>
                          <id>tag:example.org,2018:entry-2</id>
                        </entry>
                      </item>
                    </items>
                  </event>
                </message>`;

            receive(_converse, stanza);
            await u.waitUntil(() => feed.messages.length === 1);
            const post = feed.messages.at(0);

            // The parser leaves `time` out (no Atom dates); the model stamps the
            // current time once, at creation — not the perpetual "now" a parse-time
            // fallback produced on every re-fetch.
            expect(post.get('published')).toBeUndefined();
            expect(post.get('updated')).toBeUndefined();
            const stamped = post.get('time');
            expect(typeof stamped).toBe('string');
            expect(stamped).toBeTruthy();

            // Re-delivering the same item (as a node re-fetch does on reload) merges
            // by id and must NOT re-stamp the time.
            receive(_converse, stanza);
            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(feed.messages.length).toBe(1);
            expect(feed.messages.at(0).get('time')).toBe(stamped);
        }),
    );

    it(
        'persists posts so a dateless post survives a reload (fresh hydration)',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const jid = 'ivan@vucica.net';
            const feed = await api.microblog.feeds.get(jid, MICROBLOG_NODE, true);

            const item = stx`
                <item id="dateless-persist">
                    <entry xmlns="${ATOM}">
                        <title>Hi again</title>
                        <summary>This is my post 2nd</summary>
                        <id>tag:community-name,2018:entry-2</id>
                    </entry>
                </item>`;

            // addItems persists; awaiting it guarantees the write has flushed.
            await feed.addItems([item.tree()]);
            const t1 = feed.messages.get('dateless-persist')?.get('time');
            expect(t1).toBeTruthy();

            // Simulate a reload: hydrate a *fresh* messages collection from the
            // same offline store. The post must come back — with the same stamp,
            // not re-derived to "now".
            const Messages = /** @type {any} */ (feed.messages.constructor);
            const reloaded = new Messages(null, { id: feed.getMessagesCacheKey() });
            await reloaded.hydrated;
            expect(reloaded.length).toBe(1);
            expect(reloaded.get('dateless-persist')?.get('time')).toBe(t1);
        }),
    );

    // Build `n` PubSub <item> elements p<start>..p<start+n-1>, oldest→newest (the
    // order a server returns), one minute apart.
    const buildItems = (n, start) =>
        Array.from({ length: n }, (_, i) => {
            const k = start + i;
            const id = `p${k}`;
            const t = new Date(Date.parse('2026-06-01T00:00:00Z') + k * 60000).toISOString();
            return stx`<item id="${id}">
                    <entry xmlns="${ATOM}">
                        <title>Post ${id}</title>
                        <id>tag:x,2026:${id}</id>
                        <published>${t}</published>
                        <updated>${t}</updated>
                    </entry>
                </item>`.tree();
        });

    it(
        'fetches the newest page with max_items and records the opaque RSM cursor',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const feed = await api.microblog.feeds.get('ivan@vucica.net', MICROBLOG_NODE, true);

            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({
                items: buildItems(20, 1),
                rsm: { result: { first: 'cursor-oldest', last: 'cursor-newest' } },
            });

            await feed.fetchPosts();

            // Portable newest-N primitive, not an RSM cursor query.
            expect(api.pubsub.items.get).toHaveBeenCalledWith('ivan@vucica.net', MICROBLOG_NODE, { max_items: 20 });
            expect(feed.get('supports_rsm')).toBe(true);
            // The opaque cursor of the page's oldest item is persisted onto it.
            expect(feed.getOldestPost().get('rsm_cursor')).toBe('cursor-oldest');
            // A full page ⇒ more history ⇒ a "load older" placeholder is seeded.
            expect(feed.hasScrolldownPlaceholder()).toBe(true);
        }),
    );

    it(
        'records the older-frontier cursor from the correct end when the server returns items newest-first',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const { PubsubPlaceholderMessage } = _converse.exports;
            const feed = await api.microblog.feeds.get('ivan@vucica.net', MICROBLOG_NODE, true);

            // Some servers return the page newest→oldest. Then RSM `<first>` is the
            // *newest* item and `<last>` is the oldest, so the cursor to page further
            // back is `<last>`, not `<first>`.
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({
                items: buildItems(20, 1).reverse(),
                rsm: { result: { first: 'c-newest', last: 'c-oldest' } },
            });

            await feed.fetchPosts();

            // The oldest post carries the older-frontier cursor from the `<last>` end,
            // and the "load older" placeholder pages from there.
            expect(feed.getOldestPost().get('rsm_cursor')).toBe('c-oldest');
            const ph = feed.messages.models.find((m) => m instanceof PubsubPlaceholderMessage);
            expect(ph.get('before_cursor')).toBe('c-oldest');
        }),
    );

    it(
        'loads older posts via the opaque RSM before-cursor',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const { PubsubPlaceholderMessage } = _converse.exports;
            const feed = await api.microblog.feeds.get('ivan@vucica.net', MICROBLOG_NODE, true);

            vi.spyOn(api.pubsub.items, 'get').mockImplementation((_jid, _node, opts) => {
                if (opts.max_items) {
                    return Promise.resolve({ items: buildItems(20, 21), rsm: { result: { first: 'c-21' } } });
                }
                if (opts.rsm?.before === 'c-21') {
                    return Promise.resolve({ items: buildItems(20, 1), rsm: { result: { first: 'c-1' } } });
                }
                return Promise.resolve({ items: [], rsm: { result: {} } });
            });

            await feed.fetchPosts();
            expect(feed.getPosts().length).toBe(20);

            const ph = feed.messages.models.find((m) => m instanceof PubsubPlaceholderMessage);
            await feed.fetchOlder(ph);

            // Paged via the opaque cursor, not item-id or post time.
            expect(api.pubsub.items.get).toHaveBeenCalledWith('ivan@vucica.net', MICROBLOG_NODE, {
                rsm: { before: 'c-21', max: 20 },
            });
            expect(feed.getPosts().length).toBe(40);
        }),
    );

    it(
        'loads one larger window and disables paging when the server has no RSM',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const feed = await api.microblog.feeds.get('ivan@vucica.net', MICROBLOG_NODE, true);

            // No `rsm` in the response ⇒ server ignores RSM (Prosody-like). The first
            // page is full, so a single larger window is fetched — not incremental
            // (and increasingly wasteful) `max_items` growth.
            vi.spyOn(api.pubsub.items, 'get').mockImplementation((_jid, _node, opts) => {
                if (opts.max_items === 20) return Promise.resolve({ items: buildItems(20, 41) }); // newest page, no rsm
                if (opts.max_items > 20) return Promise.resolve({ items: buildItems(60, 1) }); // the larger window
                return Promise.resolve({ items: [] });
            });

            await feed.fetchPosts();

            expect(feed.get('supports_rsm')).toBe(false);
            const windows = api.pubsub.items.get.mock.calls.map((call) => call[2].max_items);
            expect(windows).toContain(20); // detection page
            expect(windows.some((n) => n > 20)).toBe(true); // the one larger window
            expect(feed.getPosts().length).toBe(60);
            // Paging is disabled: history is complete and no "load older" placeholder.
            expect(feed.get('history_complete')).toBe(true);
            expect(feed.hasScrolldownPlaceholder()).toBe(false);
        }),
    );

    it(
        'marks a newer-than-cache gap with a positioned placeholder',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const { PubsubPlaceholderMessage } = _converse.exports;
            const feed = await api.microblog.feeds.get('ivan@vucica.net', MICROBLOG_NODE, true);

            // Pre-seed an older cached set (p1..p5).
            await feed.addItems(buildItems(5, 1));
            const cached_newest_time = feed.getNewestPost().get('time');

            // The newest page (p21..p40) is a full page that doesn't reach the cache.
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({
                items: buildItems(20, 21),
                rsm: { result: { first: 'c-21' } },
            });
            await feed.fetchPosts();

            const gap = feed.messages.models.find(
                (m) => m instanceof PubsubPlaceholderMessage && m.get('stop_at_time')
            );
            expect(gap).toBeDefined();
            expect(gap.get('before_cursor')).toBe('c-21');
            expect(gap.get('stop_at_time')).toBe(cached_newest_time);
            // It sorts into the gap: below the newest page, above the cached posts.
            expect(gap.get('time') < feed.messages.get('p21').get('time')).toBe(true);
            expect(gap.get('time') > cached_newest_time).toBe(true);
        }),
    );

    it(
        're-derives history_complete on each refresh (does not latch true)',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const feed = await api.microblog.feeds.get('ivan@vucica.net', MICROBLOG_NODE, true);

            // First refresh: the whole (small) node fits in one page ⇒ complete.
            const getSpy = vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: buildItems(5, 1) });
            await feed.fetchPosts();
            expect(feed.get('history_complete')).toBe(true);

            // The node grew while we were away; a later refresh returns a *full* page,
            // so there is older history again — completeness must flip back to false
            // (and re-offer "load older"), not stay latched at true.
            getSpy.mockResolvedValue({ items: buildItems(20, 6), rsm: { result: { first: 'c-6' } } });
            await feed.fetchPosts();
            expect(feed.get('history_complete')).toBe(false);
            expect(feed.hasScrolldownPlaceholder()).toBe(true);
        }),
    );

    it(
        'builds and publishes a post to the own microblog node',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');

            const feed = await api.microblog.feeds.own();

            // The generic publish IQ flow is covered by the pubsub plugin's own
            // tests; here we only assert the microblog-specific wiring.
            const publish = vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);

            await feed.publishPost('  hanging out at the Café  ');

            expect(publish).toHaveBeenCalledTimes(1);
            const [jid, node, item] = publish.mock.calls[0];
            expect(jid).toBe(bare_jid);
            expect(node).toBe(MICROBLOG_NODE);
            // The built item must carry the trimmed plain-text title.
            expect(item.tree().querySelector('title').textContent).toBe('hanging out at the Café');

            // The post is optimistically added to the feed.
            await u.waitUntil(() => feed.messages.length === 1);
            expect(feed.messages.at(0).get('title')).toBe('hanging out at the Café');
            expect(feed.messages.at(0).get('is_mine')).toBe(true);
        }),
    );

    it(
        'ignores empty posts',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const feed = await api.microblog.feeds.own();
            const publish = vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);

            await feed.publishPost('   ');

            expect(publish).not.toHaveBeenCalled();
            expect(feed.messages.length).toBe(0);
        }),
    );

    it(
        'retracts a post and removes the local copy',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');
            const feed = await api.microblog.feeds.own();

            receive(_converse, makePostStanza(bare_jid, 'post-1', 'a doomed post'));
            await u.waitUntil(() => feed.messages.length === 1);

            const retract = vi.spyOn(api.pubsub, 'retract').mockResolvedValue(undefined);
            await feed.retractPost('post-1');

            expect(retract).toHaveBeenCalledWith(bare_jid, MICROBLOG_NODE, 'post-1');
            expect(feed.messages.length).toBe(0);
        }),
    );

    it(
        'removes a post when a retraction event arrives',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');
            const feed = await api.microblog.feeds.own();

            receive(_converse, makePostStanza(bare_jid, 'post-1', 'soon to vanish'));
            await u.waitUntil(() => feed.messages.length === 1);

            receive(
                _converse,
                stx`
                <message xmlns="jabber:client" from="${bare_jid}" to="${bare_jid}" type="headline">
                  <event xmlns="${PUBSUB_EVENT}">
                    <items node="${MICROBLOG_NODE}">
                      <retract id="post-1"/>
                    </items>
                  </event>
                </message>`,
            );

            await u.waitUntil(() => feed.messages.length === 0);
        }),
    );

    it(
        "does not add a post's author to the roster, but still resolves their avatar vCard",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const jid = 'stranger@shakespeare.lit';

            // We read this author's feed (e.g. a followed community node), but
            // they're not — and must not become — a roster contact.
            const feed = await api.microblog.feeds.get(jid, MICROBLOG_NODE, true);
            receive(_converse, makePostStanza(jid, 'p1', 'Hello from a stranger'));
            await u.waitUntil(() => feed.messages.length === 1);
            const post = feed.messages.at(0);

            // The author is NOT pulled into the roster, and no contact resolves
            // (so the view renders a plain, non-linked avatar).
            expect(_converse.roster.get(jid)).toBeUndefined();
            expect(post.contact).toBe(null);
            // Yet the avatar can still resolve: the post names its author's bare
            // JID for the (roster-independent) vCard cache lookup.
            expect(post.getVCardJID()).toBe(jid);
        }),
    );

    it(
        "resolves an existing roster contact for an author's post, without adding anyone",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const jid = 'juliet@capulet.lit';
            _converse.roster.create({ jid, subscription: 'both', nickname: 'Juliet' });

            const feed = await api.microblog.feeds.get(jid, MICROBLOG_NODE, true);
            receive(_converse, makePostStanza(jid, 'p1', 'O Romeo, Romeo'));
            await u.waitUntil(() => feed.messages.length === 1);
            const post = feed.messages.at(0);

            // The pre-existing contact is reused (so the avatar links to it) and
            // nothing new was added to the roster.
            await u.waitUntil(() => !!post.contact);
            expect(post.contact.get('jid')).toBe(jid);
            expect(_converse.roster.length).toBe(1);
        }),
    );
});
