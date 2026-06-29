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
            expect(post.get('body')).toBe('hanging out at the Café Napolitano');
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
            expect(post.get('body_xhtml')).toContain('<strong>Café</strong>');
        }),
    );

    it(
        'renders the Atom title, summary and content together (newline-separated)',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const jid = 'ivan@vucica.net';
            const feed = await api.microblog.feeds.get(jid, MICROBLOG_NODE, true);

            // An entry carrying all three Atom text constructs. Keep the feed flat
            // but lossless: show them as one block, newline-separated.
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
            expect(post.get('body')).toBe('Hi again\nThis is my post 2nd\nSharing a post.');
            expect(post.get('summary')).toBe('This is my post 2nd');
        }),
    );

    it(
        'reads the body from <content> when the Atom <title> is empty',
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
            expect(feed.messages.at(0).get('body')).toBe('yo');
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
            expect(feed.messages.at(0).get('body')).toBe('hanging out at the Café');
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
});
