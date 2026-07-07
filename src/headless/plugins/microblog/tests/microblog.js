import { describe, it, expect, vi } from 'vitest';
import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';
import {
    ATOM,
    MICROBLOG_NODE,
    PUBSUB_EVENT,
    commentItem,
    makeCommentEvent,
    makePostStanza,
    receive,
    seedPost,
} from './utils.js';

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
            // author, here that's us, so the view labels the repost "You".
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
            // and her name resolves from the vCard cache.
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
            // vCard name, without the author ever entering the roster.
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
            // use <title>, but other servers might not.
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
                (m) => m instanceof PubsubPlaceholderMessage && m.get('stop_at_time'),
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
            // Publishing also provisions the post's comments node (fired in the
            // background); stub it so it doesn't hit the network.
            const create = vi.spyOn(api.pubsub, 'create').mockResolvedValue(undefined);

            await feed.publishPost('  hanging out at the Café  ');

            expect(publish).toHaveBeenCalledTimes(1);
            const [jid, node, item, options] = publish.mock.calls[0];
            expect(jid).toBe(bare_jid);
            expect(node).toBe(MICROBLOG_NODE);
            // The node config must make the feed publicly followable: servers
            // default a fresh PEP node to presence-based access, which returns
            // `forbidden` to followers without a presence subscription.
            expect(options.access_model).toBe('open');
            // The built item must carry the trimmed plain-text title.
            expect(item.tree().querySelector('title').textContent).toBe('hanging out at the Café');
            // …and advertise the post's comments node via a rel="replies" link.
            const replies = item.tree().querySelector('link[rel="replies"]');
            expect(replies.getAttribute('title')).toBe('comments');
            const post_id = item.tree().getAttribute('id');
            expect(replies.getAttribute('href')).toBe(
                `xmpp:${bare_jid}?;node=${encodeURIComponent('urn:xmpp:microblog:0:comments/' + post_id)}`,
            );
            // The comments node is provisioned with an open publish model so
            // others can reply.
            await u.waitUntil(() => create.mock.calls.length === 1);
            const [c_jid, c_node, c_config] = create.mock.calls[0];
            expect(c_jid).toBe(bare_jid);
            expect(c_node).toBe(`urn:xmpp:microblog:0:comments/${post_id}`);
            expect(c_config.access_model).toBe('open');
            expect(c_config.publish_model).toBe('open');

            // The post is optimistically added to the feed.
            await u.waitUntil(() => feed.messages.length === 1);
            expect(feed.messages.at(0).get('title')).toBe('hanging out at the Café');
            expect(feed.messages.at(0).get('is_mine')).toBe(true);
        }),
    );

    it(
        'reposts a post to the own node, attributed to the original author, with via pointing at the original',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');

            const feed = await api.microblog.feeds.own();

            // Seed an original post from a contact into their feed.
            const orig_feed = await api.microblog.feeds.get('juliet@capulet.lit', MICROBLOG_NODE, true);
            await orig_feed.addItems([
                stx`
                <item id="orig-1" publisher="juliet@capulet.lit">
                  <entry xmlns="${ATOM}">
                    <title type="text">O Romeo, Romeo</title>
                    <id>tag:capulet.lit,2024-01-01:posts-orig-1</id>
                    <published>2024-01-01T18:30:02Z</published>
                    <updated>2024-01-01T18:30:02Z</updated>
                  </entry>
                </item>`.tree(),
            ]);
            const original = orig_feed.messages.get('orig-1');
            expect(original.get('is_mine')).toBe(false);

            const publish = vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            await api.microblog.repost(original);

            // Published to our OWN node, carrying the original author + a rel="via"
            // link back to the original item, with the text copied.
            expect(publish).toHaveBeenCalledTimes(1);
            const [jid, node, item] = publish.mock.calls[0];
            expect(jid).toBe(bare_jid);
            expect(node).toBe(MICROBLOG_NODE);
            let tree = item.tree();
            expect(tree.querySelector('author uri').textContent).toBe('xmpp:juliet@capulet.lit');
            expect(tree.querySelector('title').textContent).toBe('O Romeo, Romeo');
            let via = tree.querySelector('link[rel="via"]');
            expect(via.getAttribute('href')).toBe(
                'xmpp:juliet@capulet.lit?;node=urn%3Axmpp%3Amicroblog%3A0;item=orig-1',
            );
            expect(via.getAttribute('ref')).toBe('tag:capulet.lit,2024-01-01:posts-orig-1');

            // Optimistically rendered in our own feed as a repost we made.
            await u.waitUntil(() => feed.messages.length === 1);
            const repost = feed.messages.at(0);
            expect(repost.get('is_repost')).toBe(true);
            expect(repost.get('is_mine')).toBe(true);
            expect(repost.getAuthorJID()).toBe('juliet@capulet.lit');
            expect(repost.get('title')).toBe('O Romeo, Romeo');

            // Reposting a *repost* propagates its via link verbatim, so the chain
            // keeps pointing at the original post (XEP-0277: "point it to the
            // original post") — not at the intermediate copy, and not at a dangling
            // original-author-JID-with-the-copy's-item-id mix. Seed Benvolio's feed
            // with his repost of one of Romeo's posts: the <author> names Romeo and
            // the via link points at Romeo's original, but the item itself lives on
            // Benvolio's node.
            const orig_href = 'xmpp:romeo@montague.lit?;node=urn%3Axmpp%3Amicroblog%3A0;item=romeo-orig-1';
            const orig_ref = 'tag:montague.lit,2024-01-01:posts-romeo-orig-1';
            const benvolios_feed = await api.microblog.feeds.get('benvolio@montague.lit', MICROBLOG_NODE, true);
            await benvolios_feed.addItems([
                stx`
                <item id="benvolio-repost-1" publisher="benvolio@montague.lit">
                  <entry xmlns="${ATOM}">
                    <author>
                      <name>Romeo Montague</name>
                      <uri>xmpp:romeo@montague.lit</uri>
                    </author>
                    <title type="text">hanging out at the Café Napolitano</title>
                    <link rel="via" href="${orig_href}" ref="${orig_ref}"/>
                    <id>tag:montague.lit,2024-01-02:posts-benvolio-repost-1</id>
                    <published>2024-01-02T10:00:00Z</published>
                    <updated>2024-01-02T10:00:00Z</updated>
                  </entry>
                </item>`.tree(),
            ]);
            const theirs = benvolios_feed.messages.get('benvolio-repost-1');
            expect(theirs.get('is_repost')).toBe(true);
            expect(theirs.getAuthorJID()).toBe('romeo@montague.lit');

            await api.microblog.repost(theirs);

            // Authorship still names the original author, and the via href/ref are
            // Benvolio's verbatim — i.e. Romeo's original.
            expect(publish).toHaveBeenCalledTimes(2);
            tree = publish.mock.calls[1][2].tree();
            expect(tree.querySelector('author uri').textContent).toBe('xmpp:romeo@montague.lit');
            via = tree.querySelector('link[rel="via"]');
            expect(via.getAttribute('href')).toBe(orig_href);
            expect(via.getAttribute('ref')).toBe(orig_ref);

            // Round-trip: our own optimistically-added copy still attributes the
            // post to Romeo (via_jid derives from the via href).
            await u.waitUntil(() => feed.messages.length === 2);
            const mine = feed.messages.find((m) => m.getAuthorJID() === 'romeo@montague.lit');
            expect(mine.get('is_repost')).toBe(true);
            expect(mine.get('is_mine')).toBe(true);

            // Reposting an Atom-native post (empty <title>, body in <content>) must
            // still emit exactly one <title> — RFC 4287 requires it per entry.
            await orig_feed.addItems([
                stx`
                <item id="orig-2" publisher="juliet@capulet.lit">
                  <entry xmlns="${ATOM}">
                    <title type="text"></title>
                    <content type="text">Wherefore art thou Romeo?</content>
                    <id>tag:capulet.lit,2024-01-03:posts-orig-2</id>
                    <published>2024-01-03T18:30:02Z</published>
                    <updated>2024-01-03T18:30:02Z</updated>
                  </entry>
                </item>`.tree(),
            ]);
            await api.microblog.repost(orig_feed.messages.get('orig-2'));
            expect(publish).toHaveBeenCalledTimes(3);
            tree = publish.mock.calls[2][2].tree();
            expect(tree.querySelectorAll('title').length).toBe(1);
            expect(tree.querySelector('content').textContent).toBe('Wherefore art thou Romeo?');

            // Reposting a post that lives on a *community* node: the via link
            // points at the node (where the original lives), but attribution must
            // follow the entry's <author> — not the via href's service JID.
            const community_feed = await api.microblog.feeds.get('pubsub.montague.lit', 'verona-news', true);
            await community_feed.addItems([
                stx`
                <item id="news-1" publisher="romeo@montague.lit">
                  <entry xmlns="${ATOM}">
                    <author>
                      <name>Romeo Montague</name>
                      <uri>xmpp:romeo@montague.lit</uri>
                    </author>
                    <title type="text">News from Verona</title>
                    <id>tag:montague.lit,2024-01-04:posts-news-1</id>
                    <published>2024-01-04T12:00:00Z</published>
                    <updated>2024-01-04T12:00:00Z</updated>
                  </entry>
                </item>`.tree(),
            ]);
            await api.microblog.repost(community_feed.messages.get('news-1'));
            expect(publish).toHaveBeenCalledTimes(4);
            tree = publish.mock.calls[3][2].tree();
            expect(tree.querySelector('link[rel="via"]').getAttribute('href')).toBe(
                'xmpp:pubsub.montague.lit?;node=verona-news;item=news-1',
            );
            expect(tree.querySelector('author uri').textContent).toBe('xmpp:romeo@montague.lit');

            // Round-trip: our optimistic copy is attributed to Romeo, not to
            // pubsub.montague.lit.
            await u.waitUntil(() => feed.messages.length === 4);
            const community_repost = feed.messages.get(tree.getAttribute('id'));
            expect(community_repost.get('is_repost')).toBe(true);
            expect(community_repost.getAuthorJID()).toBe('romeo@montague.lit');
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

    it(
        "parses a post's comments link, and derives the comments node when absent",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            const feed = await api.microblog.feeds.get('juliet@capulet.lit', MICROBLOG_NODE, true);
            const comments_node = 'urn:xmpp:microblog:0:comments/post-1';
            const href = `xmpp:juliet@capulet.lit?;node=${encodeURIComponent(comments_node)}`;
            await feed.addItems([
                stx`
                <item id="post-1" publisher="juliet@capulet.lit">
                  <entry xmlns="${ATOM}">
                    <title type="text">O Romeo, Romeo</title>
                    <link rel="replies" title="comments" href="${href}"/>
                    <id>tag:capulet.lit,2024-01-01:posts-post-1</id>
                    <published>2024-01-01T18:30:02Z</published>
                  </entry>
                </item>`.tree(),
            ]);
            const post = feed.messages.get('post-1');
            expect(post.get('comments_jid')).toBe('juliet@capulet.lit');
            expect(post.get('comments_node')).toBe(comments_node);
            expect(post.getCommentsService()).toBe('juliet@capulet.lit');
            expect(post.getCommentsNode()).toBe(comments_node);

            // A post WITHOUT a replies link falls back to the author's PEP and the
            // conventional per-post node name.
            await feed.addItems([
                stx`
                <item id="post-2" publisher="juliet@capulet.lit">
                  <entry xmlns="${ATOM}">
                    <title type="text">Deny thy father</title>
                    <id>tag:capulet.lit,2024-01-01:posts-post-2</id>
                    <published>2024-01-02T18:30:02Z</published>
                  </entry>
                </item>`.tree(),
            ]);
            const bare = feed.messages.get('post-2');
            expect(bare.get('comments_node')).toBeUndefined();
            expect(bare.getCommentsService()).toBe('juliet@capulet.lit');
            expect(bare.getCommentsNode()).toBe('urn:xmpp:microblog:0:comments/post-2');
        }),
    );

    it(
        "reads a post's comments into a thread kept out of the timeline",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            await api.microblog.feeds.own();
            const feed = await api.microblog.feeds.get('juliet@capulet.lit', MICROBLOG_NODE, true);
            const comments_node = 'urn:xmpp:microblog:0:comments/post-1';
            const href = `xmpp:juliet@capulet.lit?;node=${encodeURIComponent(comments_node)}`;
            await feed.addItems([
                stx`
                <item id="post-1" publisher="juliet@capulet.lit">
                  <entry xmlns="${ATOM}">
                    <title type="text">O Romeo</title>
                    <link rel="replies" title="comments" href="${href}"/>
                    <id>tag:capulet.lit,2024:posts-post-1</id>
                    <published>2024-01-01T18:30:02Z</published>
                  </entry>
                </item>`.tree(),
            ]);
            const post = feed.messages.get('post-1');
            const timeline_feeds = _converse.state.pubsubfeeds.length;

            // Mirror Prosody's retrieve-items: the item carries NO `publisher`
            // attribute (only PEP *notifications* stamp it). Authorship must then
            // come from the entry's <author>, not the node owner (`from`), which
            // for a comments node is the *post author*, not the commenter.
            const getSpy = vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({
                items: [
                    stx`
                    <item id="c-1">
                      <entry xmlns="${ATOM}">
                        <author><name>Benvolio</name><uri>xmpp:benvolio@montague.lit</uri></author>
                        <title type="text">She is so pretty!</title>
                        <id>tag:capulet.lit,2024:comments-c-1</id>
                        <published>2024-01-01T19:00:00Z</published>
                      </entry>
                    </item>`.tree(),
                ],
            });

            const thread = await api.microblog.comments.fetch(post);
            expect(thread.messages.length).toBe(1);
            const comment = thread.messages.at(0);
            expect(comment.get('title')).toBe('She is so pretty!');
            expect(comment.getAuthorJID()).toBe('benvolio@montague.lit');
            // Not ours — even though `from` is our contact's comments service and
            // the item has no publisher (would previously read as is_mine=true).
            expect(comment.get('is_mine')).toBe(false);
            // Can't verify without a publisher, but don't cry wolf either.
            expect(comment.getAuthorMismatch()).toBe(false);

            // The thread lives in its own separate collection; the timeline is
            // untouched (no comment feed leaked into the aggregate).
            expect(_converse.state.commentfeeds.length).toBe(1);
            expect(_converse.state.pubsubfeeds.length).toBe(timeline_feeds);
            const [q_jid, q_node] = getSpy.mock.calls[0];
            expect(q_jid).toBe('juliet@capulet.lit');
            expect(q_node).toBe(comments_node);
        }),
    );

    it(
        "adds a comment to a post, attributed to us, on the post's comments node",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');

            const feed = await api.microblog.feeds.get('juliet@capulet.lit', MICROBLOG_NODE, true);
            const comments_node = 'urn:xmpp:microblog:0:comments/post-1';
            const href = `xmpp:juliet@capulet.lit?;node=${encodeURIComponent(comments_node)}`;
            await feed.addItems([
                stx`
                <item id="post-1" publisher="juliet@capulet.lit">
                  <entry xmlns="${ATOM}">
                    <title type="text">O Romeo</title>
                    <link rel="replies" title="comments" href="${href}"/>
                    <id>tag:capulet.lit,2024:posts-post-1</id>
                    <published>2024-01-01T18:30:02Z</published>
                  </entry>
                </item>`.tree(),
            ]);
            const post = feed.messages.get('post-1');

            const publish = vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            const comment = await api.microblog.comments.add(post, '  She is so pretty!  ');

            // Published to the post's comments node, carrying our <author>.
            expect(publish).toHaveBeenCalledTimes(1);
            const [jid, node, item] = publish.mock.calls[0];
            expect(jid).toBe('juliet@capulet.lit');
            expect(node).toBe(comments_node);
            const tree = item.tree();
            expect(tree.querySelector('author uri').textContent).toBe(`xmpp:${bare_jid}`);
            expect(tree.querySelector('title').textContent).toBe('She is so pretty!');

            // Optimistically rendered in the thread as our own comment.
            expect(comment.get('title')).toBe('She is so pretty!');
            expect(comment.getAuthorJID()).toBe(bare_jid);
            expect(comment.get('is_mine')).toBe(true);

            // Empty comments are ignored.
            expect(await api.microblog.comments.add(post, '   ')).toBeUndefined();
            expect(publish).toHaveBeenCalledTimes(1);
        }),
    );

    it(
        'routes an incoming comment event to the open thread, not the timeline',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            const feed = await api.microblog.feeds.get('juliet@capulet.lit', MICROBLOG_NODE, true);
            const comments_node = 'urn:xmpp:microblog:0:comments/post-1';
            const href = `xmpp:juliet@capulet.lit?;node=${encodeURIComponent(comments_node)}`;
            await feed.addItems([
                stx`
                <item id="post-1" publisher="juliet@capulet.lit">
                  <entry xmlns="${ATOM}">
                    <title type="text">O Romeo</title>
                    <link rel="replies" title="comments" href="${href}"/>
                    <id>tag:capulet.lit,2024:posts-post-1</id>
                    <published>2024-01-01T18:30:02Z</published>
                  </entry>
                </item>`.tree(),
            ]);
            const post = feed.messages.get('post-1');

            // Open the thread (registers a comment feed).
            const thread = await api.microblog.comments.feed(post);
            const timeline_feeds = _converse.state.pubsubfeeds.length;

            // A well-formed comment arrives via PEP from the comments service.
            receive(
                _converse,
                makeCommentEvent(
                    'juliet@capulet.lit',
                    comments_node,
                    'c-1',
                    'She is so pretty!',
                    'benvolio@montague.lit',
                    'Benvolio',
                ),
            );
            await u.waitUntil(() => thread.messages.length === 1);
            const legit = thread.messages.at(0);
            expect(legit.get('title')).toBe('She is so pretty!');
            // publisher matches the claimed <author><uri> — verified author.
            expect(legit.getAuthorMismatch()).toBe(false);

            // The comment created no timeline feed for the comments node.
            expect(_converse.state.pubsubfeeds.length).toBe(timeline_feeds);
            expect(_converse.state.pubsubfeeds.get(`juliet@capulet.lit/${comments_node}`)).toBeUndefined();

            // A spoofed comment (publisher ≠ claimed author) is flagged for the UI
            // (XEP-0277 § Comment Author).
            receive(
                _converse,
                stx`
                <message xmlns="jabber:client" from="juliet@capulet.lit" to="juliet@capulet.lit" type="headline">
                  <event xmlns="${PUBSUB_EVENT}">
                    <items node="${comments_node}">
                      <item id="c-2" publisher="mallory@montague.lit">
                        <entry xmlns="${ATOM}">
                          <author><name>Benvolio</name><uri>xmpp:benvolio@montague.lit</uri></author>
                          <title type="text">I said that</title>
                          <id>tag:capulet.lit,2024:comments-c-2</id>
                          <published>2024-01-01T19:05:00Z</published>
                        </entry>
                      </item>
                    </items>
                  </event>
                </message>`,
            );
            await u.waitUntil(() => thread.messages.length === 2);
            const spoof = thread.messages.get('c-2');
            expect(spoof.getAuthorMismatch()).toBe(true);
        }),
    );

    it(
        'persists a comment thread across a reload (fresh hydration)',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            const feed = _converse.state.commentfeeds.getFeed(
                'juliet@capulet.lit',
                'urn:xmpp:microblog:0:comments/post-1',
                true,
            );
            await feed.addItems([
                stx`
                <item id="c-1">
                  <entry xmlns="${ATOM}">
                    <author><name>Benvolio</name><uri>xmpp:benvolio@montague.lit</uri></author>
                    <title type="text">She is so pretty!</title>
                    <id>tag:capulet.lit,2024:comments-c-1</id>
                    <published>2024-01-01T19:00:00Z</published>
                  </entry>
                </item>`.tree(),
            ]);
            expect(feed.messages.length).toBe(1);
            // The thread is now persisted (no longer in-memory): it has a store key.
            const key = feed.getMessagesCacheKey();
            expect(key).toBeTruthy();

            // Simulate a reload: hydrate a fresh messages collection from the same store.
            const Messages = /** @type {any} */ (feed.messages.constructor);
            const reloaded = new Messages(null, { id: key });
            await reloaded.hydrated;
            expect(reloaded.length).toBe(1);
            expect(reloaded.at(0).get('title')).toBe('She is so pretty!');
        }),
    );

    it(
        'evicts the least-recently-viewed comment thread past the cap',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');
            const cf = _converse.state.commentfeeds;

            const f1 = cf.getFeed('a@x.com', 'urn:xmpp:microblog:0:comments/1', true);
            const f2 = cf.getFeed('a@x.com', 'urn:xmpp:microblog:0:comments/2', true);
            const f3 = cf.getFeed('a@x.com', 'urn:xmpp:microblog:0:comments/3', true);
            f1.save({ last_viewed: 100 }); // oldest
            f2.save({ last_viewed: 200 });
            f3.save({ last_viewed: 300 }); // newest

            api.settings.set('social_max_comment_threads', 2);
            cf.pruneThreads();

            await u.waitUntil(() => cf.get(f1.get('id')) === undefined);
            expect(cf.get(f2.get('id'))).toBeDefined();
            expect(cf.get(f3.get('id'))).toBeDefined();
        }),
    );

    it(
        'never evicts a pinned comment thread',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');
            const cf = _converse.state.commentfeeds;

            const f1 = cf.getFeed('b@x.com', 'urn:xmpp:microblog:0:comments/1', true);
            const f2 = cf.getFeed('b@x.com', 'urn:xmpp:microblog:0:comments/2', true);
            const f3 = cf.getFeed('b@x.com', 'urn:xmpp:microblog:0:comments/3', true);
            f1.save({ pinned: true, last_viewed: 100 }); // pinned AND oldest
            f2.save({ last_viewed: 200 });
            f3.save({ last_viewed: 300 });

            api.settings.set('social_max_comment_threads', 2);
            cf.pruneThreads();

            // The oldest *non-pinned* thread goes; the pinned one survives despite
            // being the least-recently-viewed of all.
            await u.waitUntil(() => cf.get(f2.get('id')) === undefined);
            expect(cf.get(f1.get('id'))).toBeDefined();
            expect(cf.get(f3.get('id'))).toBeDefined();
        }),
    );

    it(
        'evicts empty comment threads before non-empty ones',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');
            const cf = _converse.state.commentfeeds;

            // f1: viewed long ago but holds a real comment (valuable cache).
            const f1 = cf.getFeed('c@x.com', 'urn:xmpp:microblog:0:comments/1', true);
            f1.save({ last_viewed: 100 }); // oldest
            await f1.addItems([
                stx`
                <item id="c-1">
                  <entry xmlns="${ATOM}">
                    <author><name>Bob</name><uri>xmpp:bob@x.com</uri></author>
                    <title type="text">nice one</title>
                    <id>tag:x.com,2024:comments-c-1</id>
                    <published>2024-01-01T10:00:00Z</published>
                  </entry>
                </item>`.tree(),
            ]);

            // f2: viewed recently but empty (worthless cache).
            const f2 = cf.getFeed('c@x.com', 'urn:xmpp:microblog:0:comments/2', true);
            f2.save({ last_viewed: 300 }); // newest, but empty

            api.settings.set('social_max_comment_threads', 1);
            cf.pruneThreads();

            // The empty thread is evicted first even though it is the newer of the
            // two; the non-empty thread survives despite being least-recently-viewed.
            await u.waitUntil(() => cf.get(f2.get('id')) === undefined);
            expect(cf.get(f1.get('id'))).toBeDefined();
        }),
    );

    it(
        'denormalises comment and like counts onto a post, fetching once',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            const { post } = await seedPost(api);

            // The comments node holds two real comments and one ♥ like.
            const getSpy = vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({
                items: [
                    commentItem('c-1', 'She is so pretty!'),
                    commentItem('c-2', 'Indeed', 'mercutio@montague.lit'),
                    commentItem('l-1', '♥'),
                ],
            });

            await api.microblog.comments.fetchSummary(post);

            // The ♥ is counted as a like, not a comment.
            expect(post.get('comment_count')).toBe(2);
            expect(post.get('like_count')).toBe(1);
            expect(post.get('liked_by_me')).toBe(false);

            // A second visibility of the same post doesn't re-fetch (deduped).
            await api.microblog.comments.fetchSummary(post);
            expect(getSpy).toHaveBeenCalledTimes(1);
        }),
    );

    it(
        'keys the summary dedupe on the comments feed, not the bare post id',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            // Two authors, each with a post whose local item id is the same
            // ("post-1"). Item ids are only unique within a node, so on an
            // aggregated timeline these collide — the dedupe must key on the
            // comments feed (service + node), which differs by author, or the
            // second post's counts never get fetched.
            const { post: juliet_post } = await seedPost(api, { author: 'juliet@capulet.lit' });
            const { post: romeo_post } = await seedPost(api, { author: 'romeo@montague.lit' });

            // Each author's comments node returns a different number of comments.
            const getSpy = vi.spyOn(api.pubsub.items, 'get').mockImplementation((jid) =>
                Promise.resolve({
                    items:
                        jid === 'juliet@capulet.lit'
                            ? [commentItem('c-1', 'She is so pretty!'), commentItem('c-2', 'Indeed')]
                            : [commentItem('c-3', 'Away!')],
                }),
            );

            await api.microblog.comments.fetchSummary(juliet_post);
            await api.microblog.comments.fetchSummary(romeo_post);

            // Both were fetched (no collision) and each carries its own count.
            expect(getSpy).toHaveBeenCalledTimes(2);
            expect(juliet_post.get('comment_count')).toBe(2);
            expect(romeo_post.get('comment_count')).toBe(1);
        }),
    );

    it(
        'retries a summary fetch that failed rather than caching the failure',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            const { post } = await seedPost(api, { author: 'mercutio@montague.lit' });

            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({
                items: [commentItem('c-1', 'Hark', 'nurse@capulet.lit')],
            });

            // First visibility: resolving the thread throws (a transient error).
            // It's logged, not cached — the count stays unset.
            const resolveFeed = api.microblog.comments.feed.bind(api.microblog.comments);
            const feedSpy = vi
                .spyOn(api.microblog.comments, 'feed')
                .mockRejectedValueOnce(new Error('transient'))
                .mockImplementation((p) => resolveFeed(p));

            await api.microblog.comments.fetchSummary(post);
            expect(post.get('comment_count')).toBeUndefined();

            // A later visibility retries (the failed key wasn't marked done) and
            // the count now lands. Under the old always-mark-done behaviour the
            // second fetch was skipped and the count never appeared.
            await api.microblog.comments.fetchSummary(post);
            expect(feedSpy).toHaveBeenCalledTimes(2);
            expect(post.get('comment_count')).toBe(1);
        }),
    );

    it(
        'counts a ♥ authored by us as our own like (liked_by_me, my_like_id)',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');
            await api.waitUntil('pubsubFeedsInitialized');

            const { post } = await seedPost(api);

            // One real comment plus two ♥ likes — one ours, one someone else's.
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({
                items: [
                    commentItem('c-1', 'Indeed'),
                    commentItem('l-other', '♥', 'benvolio@montague.lit'),
                    commentItem('l-mine', '♥', bare_jid),
                ],
            });

            await api.microblog.comments.fetchSummary(post);

            // Both ♥ items count as likes; only ours flips liked_by_me, and its id
            // is retained (needed to retract on un-like).
            expect(post.get('comment_count')).toBe(1);
            expect(post.get('like_count')).toBe(2);
            expect(post.get('liked_by_me')).toBe(true);
            expect(post.get('my_like_id')).toBe('l-mine');
        }),
    );

    it(
        "reflects our own new comment in the post's denormalised count",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            const { post } = await seedPost(api);

            // Establish a baseline of one existing comment via a summary fetch.
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [commentItem('c-1', 'Indeed')] });
            await api.microblog.comments.fetchSummary(post);
            expect(post.get('comment_count')).toBe(1);

            // Posting our own comment updates the denormalised count without a
            // re-fetch (add() calls syncCommentSummary on the optimistic item).
            vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            await api.microblog.comments.add(post, 'She is so pretty!');
            expect(post.get('comment_count')).toBe(2);
        }),
    );

    it(
        'clears the summary dedupe on session clear so a reconnect re-fetches',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            const { post } = await seedPost(api);

            const getSpy = vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            // Fetched once, then deduped on a second visibility.
            await api.microblog.comments.fetchSummary(post);
            await api.microblog.comments.fetchSummary(post);
            expect(getSpy).toHaveBeenCalledTimes(1);

            // Session clear resets the dedupe state (and tears down the thread
            // store); a reconnect re-creates the collection.
            await api.trigger('clearSession', { synchronous: true });
            _converse.state.commentfeeds = new _converse.exports.CommentFeeds();

            // The same post is now re-fetched rather than skipped as "done".
            await api.microblog.comments.fetchSummary(post);
            expect(getSpy).toHaveBeenCalledTimes(2);
        }),
    );

    it(
        'never evicts a comment thread while its fetch is in flight',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');
            const cf = _converse.state.commentfeeds;

            const f1 = cf.getFeed('d@x.com', 'urn:xmpp:microblog:0:comments/1', true);
            const f2 = cf.getFeed('d@x.com', 'urn:xmpp:microblog:0:comments/2', true);

            // f1's fetch is in flight: items.get stays pending for the assertion window.
            let resolveFetch;
            vi.spyOn(api.pubsub.items, 'get').mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)));
            f1.fetchComments(); // not awaited, f1 is now mid-fetch
            expect(f1.isFetching()).toBe(true);

            // Tighten the cap and open a third thread to force a prune. f1 is an
            // oldest empty thread, so pure empty-first LRU would evict it first.
            api.settings.set('social_max_comment_threads', 1);
            cf.getFeed('d@x.com', 'urn:xmpp:microblog:0:comments/3', true);

            // The idle empties are evicted; f1 survives because it's mid-fetch,
            // evicting it would destroy the model and lose the fetched comments.
            await u.waitUntil(() => cf.get(f2.get('id')) === undefined);
            expect(cf.get(f1.get('id'))).toBeDefined();

            // Once the fetch settles, f1's flag clears and it's eligible again.
            resolveFetch({ items: [] });
            await u.waitUntil(() => !f1.isFetching());
        }),
    );

    it(
        "keeps an own post's comment count live via its pinned, subscribed thread",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');
            await api.waitUntil('pubsubFeedsInitialized');

            // An own post carrying a comments node.
            const { post } = await seedPost(api, { author: bare_jid });
            const node = post.getCommentsNode();

            // Pinning materialises the thread and takes a bare-JID subscription —
            // the PEP owner isn't notified of comments for free (XEP-0472).
            const subscribe = vi.spyOn(api.pubsub, 'subscribe').mockResolvedValue(undefined);
            const feed = await api.microblog.comments.pin(post);
            expect(feed.get('pinned')).toBe(true);
            expect(subscribe).toHaveBeenCalledWith(bare_jid, node);

            // A comment pushed live on the pinned thread bumps the post's count
            // without the thread ever being opened.
            receive(
                _converse,
                makeCommentEvent(bare_jid, node, 'c-1', 'Nice one!', 'benvolio@montague.lit', 'Benvolio'),
            );
            await u.waitUntil(() => post.get('comment_count') === 1);
            expect(post.get('like_count') || 0).toBe(0);
        }),
    );

    it(
        'bumps the like count when a ♥ lands live on a pinned thread',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');
            await api.waitUntil('pubsubFeedsInitialized');

            const { post } = await seedPost(api, { author: bare_jid });
            const node = post.getCommentsNode();

            vi.spyOn(api.pubsub, 'subscribe').mockResolvedValue(undefined);
            await api.microblog.comments.pin(post);

            // A ♥ comment is a like: it bumps like_count, not comment_count.
            receive(_converse, makeCommentEvent(bare_jid, node, 'l-1', '♥', 'romeo@montague.lit', 'Romeo'));
            await u.waitUntil(() => post.get('like_count') === 1);
            expect(post.get('comment_count') || 0).toBe(0);
        }),
    );

    it(
        "ignores a comment event for a post whose thread isn't pinned",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');
            await api.waitUntil('pubsubFeedsInitialized');

            const { post } = await seedPost(api, { author: bare_jid });
            const node = post.getCommentsNode();

            // No pin → no materialised thread. A comment event routes with
            // create=false, finds nothing, and is dropped: no thread is created
            // and the post's count stays unset (it's fetched lazily on visibility).
            receive(_converse, makeCommentEvent(bare_jid, node, 'c-1', 'Nice', 'benvolio@montague.lit', 'Benvolio'));
            expect(_converse.state.commentfeeds.getFeed(bare_jid, node, false)).toBeUndefined();
            expect(post.get('comment_count')).toBeUndefined();
        }),
    );

    it(
        "pins and subscribes an own post's comment thread when it is published",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');
            await api.waitUntil('pubsubFeedsInitialized');

            const feed = await api.microblog.feeds.own();
            vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub, 'create').mockResolvedValue(undefined); // ensureCommentsNode
            const subscribe = vi.spyOn(api.pubsub, 'subscribe').mockResolvedValue(undefined);

            await feed.publishPost('Hello world');
            const post = feed.getNewestPost();
            const node = post.getCommentsNode();

            // The fire-and-forget pin subscribes the new post's thread and marks
            // it pinned, so incoming comments will route in and bump its count.
            await u.waitUntil(() => subscribe.mock.calls.some((c) => c[1] === node));
            const thread = _converse.state.commentfeeds.getFeed(bare_jid, node, false);
            expect(thread?.get('pinned')).toBe(true);
        }),
    );

    it(
        'bounds pinned threads, unsubscribing the least-recently-pinned past the cap',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');
            await api.waitUntil('pubsubFeedsInitialized');

            api.settings.set('social_max_pinned_threads', 2);
            const subscribe = vi.spyOn(api.pubsub, 'subscribe').mockResolvedValue(undefined);
            const unsubscribe = vi.spyOn(api.pubsub, 'unsubscribe').mockResolvedValue(undefined);

            // Pin three own posts' threads in order (p1 oldest, p3 newest).
            for (const id of ['p1', 'p2', 'p3']) {
                const { post } = await seedPost(api, { author: bare_jid, id });
                await api.microblog.comments.pin(post);
            }
            expect(subscribe).toHaveBeenCalledTimes(3);

            // Cap is 2, so the least-recently-pinned (p1) is unsubscribed + evicted;
            // the two most recent survive.
            const cf = _converse.state.commentfeeds;
            expect(unsubscribe).toHaveBeenCalledWith(bare_jid, 'urn:xmpp:microblog:0:comments/p1');
            expect(cf.getFeed(bare_jid, 'urn:xmpp:microblog:0:comments/p1', false)).toBeUndefined();
            expect(cf.getFeed(bare_jid, 'urn:xmpp:microblog:0:comments/p2', false)).toBeDefined();
            expect(cf.getFeed(bare_jid, 'urn:xmpp:microblog:0:comments/p3', false)).toBeDefined();
        }),
    );

    it(
        'likes a post by publishing a ♥ comment and flipping the like state',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            const { post } = await seedPost(api);

            // Baseline: the thread is fetched and has no likes yet.
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });
            await api.microblog.comments.fetchSummary(post);
            expect(post.get('like_count') || 0).toBe(0);

            const publish = vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            await api.microblog.like(post);

            // A ♥ was published to the post's comments node...
            const [, node, item] = publish.mock.calls[0];
            expect(node).toBe(post.getCommentsNode());
            expect(item.tree().querySelector('title').textContent).toBe('♥');

            // ...and the optimistic ♥ (ours) flips the denormalised like state.
            expect(post.get('like_count')).toBe(1);
            expect(post.get('liked_by_me')).toBe(true);
            expect(post.get('my_like_id')).toBeTruthy();
        }),
    );

    it(
        'likes and comments on a detached browse-feed post without a store error',
        mock.initConverse(converse, [], {}, async function (_converse) {
            // A post viewed on a non-followed author's profile lives in a
            // detached, in-memory feed whose messages collection has no store, so
            // the optimistic `post.save()` in like/comment used to throw
            // `A "url" property or function must be specified`. safeSave now
            // falls back to a reactive `set()` for such store-less posts.
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            const author = 'stranger@capulet.lit';
            const id = 'browse-1';
            const feed = await api.microblog.profile.getFeed(author, MICROBLOG_NODE);
            expect(feed.get('in_memory')).toBe(true);
            expect(feed.messages.storage).toBeUndefined();

            const node = `urn:xmpp:microblog:0:comments/${id}`;
            const href = `xmpp:${author}?;node=${encodeURIComponent(node)}`;
            await feed.addItems([
                stx`
                <item id="${id}" publisher="${author}">
                  <entry xmlns="${ATOM}">
                    <title type="text">A stranger's post</title>
                    <link rel="replies" title="comments" href="${href}"/>
                    <id>tag:capulet.lit,2024:posts-${id}</id>
                    <published>2024-01-01T18:30:02Z</published>
                  </entry>
                </item>`.tree(),
            ]);
            const post = feed.messages.get(id);
            expect(post).toBeDefined();

            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });
            vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);

            // Liking optimistically flips the state without persisting/throwing.
            await api.microblog.like(post);
            expect(post.get('liked_by_me')).toBe(true);
            expect(post.get('like_count')).toBe(1);

            // Commenting syncs the denormalised count onto the detached post.
            await api.microblog.comments.add(post, 'Hello, stranger!');
            expect(post.get('comment_count')).toBe(1);
        }),
    );

    it(
        'un-likes a post by retracting our ♥ and reverting the count',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');
            await api.waitUntil('pubsubFeedsInitialized');

            const { post } = await seedPost(api);

            // The thread holds one ♥ authored by us, so we currently like it.
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [commentItem('l-mine', '♥', bare_jid)] });
            await api.microblog.comments.fetchSummary(post);
            expect(post.get('liked_by_me')).toBe(true);
            expect(post.get('my_like_id')).toBe('l-mine');

            const retract = vi.spyOn(api.pubsub, 'retract').mockResolvedValue(undefined);
            await api.microblog.unlike(post);

            // Our ♥ is retracted from the post author's comments node (a foreign
            // retract) and the like state reverts.
            expect(retract).toHaveBeenCalledWith(post.getCommentsService(), post.getCommentsNode(), 'l-mine');
            expect(post.get('like_count') || 0).toBe(0);
            expect(post.get('liked_by_me')).toBe(false);
            expect(post.get('my_like_id')).toBeFalsy();
        }),
    );

    it(
        'makes like/unlike idempotent against the current like state',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            const { post } = await seedPost(api);
            const publish = vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            const retract = vi.spyOn(api.pubsub, 'retract').mockResolvedValue(undefined);

            // Un-liking a post we don't like is a no-op. No retract is sent.
            await api.microblog.unlike(post);
            expect(retract).not.toHaveBeenCalled();

            // Like it, then like again: the second call is a no-op (already liked),
            // so only one ♥ is ever published.
            await api.microblog.like(post);
            expect(post.get('liked_by_me')).toBe(true);
            await api.microblog.like(post);
            expect(publish).toHaveBeenCalledTimes(1);
        }),
    );

    it(
        'rolls back an un-like the server refuses (foreign retract forbidden)',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');
            await api.waitUntil('pubsubFeedsInitialized');

            const { post } = await seedPost(api);

            // We currently like the post (one ♥ of ours in the thread).
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [commentItem('l-mine', '♥', bare_jid)] });
            await api.microblog.comments.fetchSummary(post);
            expect(post.get('like_count')).toBe(1);
            expect(post.get('liked_by_me')).toBe(true);

            // Prosody refuses a foreign retract; the optimistic removal must revert.
            vi.spyOn(api.pubsub, 'retract').mockRejectedValue(new Error('forbidden'));

            let error = null;
            try {
                await api.microblog.unlike(post);
            } catch (e) {
                error = e;
            }

            // It threw, and the ♥ + count are restored (no phantom un-like).
            expect(error).toBeTruthy();
            expect(post.get('like_count')).toBe(1);
            expect(post.get('liked_by_me')).toBe(true);
            expect(post.get('my_like_id')).toBe('l-mine');
            // The ♥ item is still in the thread (never destroyed).
            const feed = await api.microblog.comments.feed(post);
            expect(feed.messages.get('l-mine')).toBeTruthy();
        }),
    );

    it(
        'rolls back a like the server refuses',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            const { post } = await seedPost(api);

            // Baseline: no likes yet.
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });
            await api.microblog.comments.fetchSummary(post);
            expect(post.get('like_count')).toBe(0);

            // The ♥ publish is refused; the optimistic like must revert.
            vi.spyOn(api.pubsub, 'publish').mockRejectedValue(new Error('not-allowed'));

            let error = null;
            try {
                await api.microblog.like(post);
            } catch (e) {
                error = e;
            }

            expect(error).toBeTruthy();
            expect(post.get('like_count') || 0).toBe(0);
            expect(post.get('liked_by_me')).toBeFalsy();
            expect(post.get('my_like_id')).toBeFalsy();
        }),
    );

    it(
        'counts likes by distinct liker, not raw ♥ items',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            const { post } = await seedPost(api);

            // Three ♥ from one person + one ♥ from another + a real comment. The
            // three from the same liker are one like, so like_count is 2, not 4.
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({
                items: [
                    commentItem('l-1', '♥', 'benvolio@montague.lit'),
                    commentItem('l-2', '♥', 'benvolio@montague.lit'),
                    commentItem('l-3', '♥', 'benvolio@montague.lit'),
                    commentItem('l-4', '♥', 'mercutio@montague.lit'),
                    commentItem('c-1', 'Well said', 'nurse@capulet.lit'),
                ],
            });

            await api.microblog.comments.fetchSummary(post);

            expect(post.get('like_count')).toBe(2);
            expect(post.get('comment_count')).toBe(1);
        }),
    );

    it(
        'un-likes by retracting every ♥ of ours (duplicates cleared in one go)',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');
            await api.waitUntil('pubsubFeedsInitialized');

            const { post } = await seedPost(api);

            // Two ♥ of ours accrued on the post (e.g. liked from two devices).
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({
                items: [commentItem('l-mine-1', '♥', bare_jid), commentItem('l-mine-2', '♥', bare_jid)],
            });
            await api.microblog.comments.fetchSummary(post);
            // Deduped: two ♥ from us count as one like.
            expect(post.get('like_count')).toBe(1);
            expect(post.get('liked_by_me')).toBe(true);

            const retract = vi.spyOn(api.pubsub, 'retract').mockResolvedValue(undefined);
            await api.microblog.unlike(post);

            // Both of our ♥ are retracted, not just the tracked one.
            expect(retract).toHaveBeenCalledTimes(2);
            const retracted = retract.mock.calls.map((c) => c[2]);
            expect(retracted).toContain('l-mine-1');
            expect(retracted).toContain('l-mine-2');
            expect(post.get('like_count') || 0).toBe(0);
            expect(post.get('liked_by_me')).toBe(false);
        }),
    );

    it(
        "doesn't publish a duplicate ♥ when the thread already holds ours",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');
            await api.waitUntil('pubsubFeedsInitialized');

            const { post } = await seedPost(api);

            // The thread already has a ♥ of ours (fetched into it).
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [commentItem('l-mine', '♥', bare_jid)] });
            await api.microblog.comments.fetchSummary(post);
            expect(post.get('liked_by_me')).toBe(true);

            // Simulate a stale cache: the flag says "not liked" even though the
            // thread holds our ♥ (e.g. another device liked and the flag lags).
            post.set('liked_by_me', false);
            const publish = vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);

            await api.microblog.like(post);

            // No second ♥ is published; the state is reconciled back to liked.
            expect(publish).not.toHaveBeenCalled();
            expect(post.get('liked_by_me')).toBe(true);
            expect(post.get('like_count')).toBe(1);
        }),
    );

    it(
        'exposes an author profile model resolved from the vCard cache',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            const jid = 'mercutio@montague.lit';
            const profile = api.microblog.profile.get(jid);
            expect(profile.get('jid')).toBe(jid);
            // Names the JID whose vCard represents it (avatar/name resolution),
            // and colours by the same JID as the avatar.
            expect(profile.getVCardJID()).toBe(jid);
            expect(profile.getIdentifier()).toBe(jid);
            // With no vCard/contact name known yet, it falls back to the bare JID.
            expect(profile.getDisplayName()).toBe(jid);
            // Cached: the same author (bare or full JID) yields the same instance.
            expect(api.microblog.profile.get(jid)).toBe(profile);
            expect(api.microblog.profile.get(`${jid}/phone`)).toBe(profile);
        }),
    );

    it(
        "gives a followed author's profile the shared timeline feed",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            const jid = 'juliet@capulet.lit';
            // A followed author already has a feed in the aggregated collection.
            const shared = await api.microblog.feeds.get(jid, MICROBLOG_NODE, true);
            expect(api.microblog.isFollowing(jid)).toBe(true);

            // The profile view reuses that same feed (so it gets live updates).
            const feed = await api.microblog.profile.getFeed(jid);
            expect(feed).toBe(shared);
        }),
    );

    it(
        "gives a non-followed author's profile a detached, off-timeline feed",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            const feeds = _converse.state.pubsubfeeds;
            const before = feeds.length;
            const jid = 'stranger@shakespeare.lit';
            expect(api.microblog.isFollowing(jid)).toBe(false);

            const feed = await api.microblog.profile.getFeed(jid);
            expect(feed.get('jid')).toBe(jid);
            expect(feed.get('node')).toBe(MICROBLOG_NODE);
            // Detached: browsing a stranger's profile does NOT add their feed to
            // the aggregated collection, so their posts never enter the timeline.
            expect(feeds.length).toBe(before);
            expect(feeds.getFeed(jid, MICROBLOG_NODE, false)).toBeUndefined();
            // In-memory: the browse-only feed has no message store, so a
            // non-followed author's posts are never cached to disk.
            expect(feed.get('in_memory')).toBe(true);
            expect(feed.messages.storage).toBeFalsy();
        }),
    );

    it(
        "does not persist a browse-only profile's fetched posts",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            const jid = 'stranger@shakespeare.lit';
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({
                items: [
                    stx`
                    <item id="sp-1">
                      <entry xmlns="${ATOM}">
                        <title type="text">A stranger speaks</title>
                        <id>tag:shakespeare.lit,2024-01-01:posts-sp-1</id>
                        <published>2024-01-01T18:30:02Z</published>
                        <updated>2024-01-01T18:30:02Z</updated>
                      </entry>
                    </item>`.tree(),
                ],
            });

            const feed = await api.microblog.profileFeed(jid);
            await feed.fetchPosts();
            // The post renders (in memory) but nothing was written to storage.
            expect(feed.getPosts().length).toBe(1);
            expect(feed.messages.storage).toBeFalsy();
            expect(feed.messages.at(0).collection.storage).toBeFalsy();
        }),
    );
});
