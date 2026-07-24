/**
 * Libervia (ActivityPub gateway) interop: a comment that advertises its *own*
 * comments node (a comments-node-per-comment tree) is read as nested replies. We
 * consume this model (never publish it), following only the *explicit* rel=replies
 * link, so a flat thread is never probed.
 */
import { describe, it, expect, vi } from 'vitest';
import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';
import { commentItem, receive, seedPost } from './utils.js';

const { stx, u } = converse.env;
const ATOM = 'http://www.w3.org/2005/Atom';
const PUBSUB_EVENT = `${converse.env.Strophe.NS.PUBSUB}#event`;

const GW = 'gw.example.org';
// A child node that deliberately does NOT use the conventional
// urn:xmpp:microblog:0:comments/ prefix, to prove routing keys on feed existence.
const CHILD_NODE = 'comments-of-c1';

/**
 * A Libervia-shaped comment: it advertises a dedicated replies node via a
 * rel="replies" link (which parseAtomEntry reads into comments_jid/comments_node).
 */
function liberviaComment(id, body, author) {
    const href = `xmpp:${GW}?;node=${encodeURIComponent(CHILD_NODE)}`;
    return stx`
        <item id="${id}" publisher="${author}">
          <entry xmlns="${ATOM}">
            <author><name>${author}</name><uri>xmpp:${author}</uri></author>
            <title type="text">${body}</title>
            <link rel="replies" title="comments" href="${href}"/>
            <id>tag:example.org,2024:comments-${id}</id>
            <published>2024-01-01T19:00:00Z</published>
          </entry>
        </item>`.tree();
}

/** A live PEP event carrying one item on the child node. */
function childEvent(id, body, author) {
    return stx`
        <message xmlns="jabber:client" from="${GW}" to="${GW}" type="headline">
          <event xmlns="${PUBSUB_EVENT}">
            <items node="${CHILD_NODE}">
              <item id="${id}" publisher="${author}">
                <entry xmlns="${ATOM}">
                  <author><name>${author}</name><uri>xmpp:${author}</uri></author>
                  <title type="text">${body}</title>
                  <id>tag:example.org,2024:comments-${id}</id>
                  <published>2024-01-01T19:10:00Z</published>
                </entry>
              </item>
            </items>
          </event>
        </message>`;
}

describe('Libervia node-per-comment threads', function () {
    it(
        'resolves a comment\'s explicit replies node, and never probes a flat comment',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const { post } = await seedPost(api);
            const feed = await api.microblog.comments.feed(post);
            await feed.addItems([
                liberviaComment('c1', 'Top comment', 'bob@example.org'),
                commentItem('flat', 'A plain comment', 'juliet@capulet.lit'),
            ]);

            const getSpy = vi.spyOn(api.pubsub.items, 'get').mockImplementation((_jid, node) => {
                if (node === CHILD_NODE) {
                    return Promise.resolve({
                        items: [
                            commentItem('r1', 'Reply one', 'eve@example.org'),
                            commentItem('r2', 'Reply two', 'mallory@example.org'),
                        ],
                    });
                }
                return Promise.resolve({ items: [] });
            });

            // The Libervia comment resolves its child node as replies.
            const child = await api.microblog.comments.replies(feed.messages.get('c1'));
            expect(child).not.toBe(null);
            expect(child.get('node')).toBe(CHILD_NODE);
            expect(child.get('jid')).toBe(GW);
            expect(child.messages.get('r1')).toBeDefined();
            expect(child.messages.get('r2')).toBeDefined();

            // The owning comment's reply count is denormalised from the child node.
            expect(feed.messages.get('c1').get('reply_count')).toBe(2);

            // A flat comment has no replies node: null, and NOT probed.
            expect(await api.microblog.comments.replies(feed.messages.get('flat'))).toBe(null);
            expect(getSpy.mock.calls.every((c) => c[1] !== 'urn:xmpp:microblog:0:comments/post-1')).toBe(true);
        }),
    );

    it(
        'publishes a reply to a Libervia comment into its child node',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const { post } = await seedPost(api);
            const feed = await api.microblog.comments.feed(post);
            await feed.addItems([liberviaComment('c1', 'Top comment', 'bob@example.org')]);

            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });
            const publish = vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);

            await api.microblog.comments.add(post, 'Me too', { parent: feed.messages.get('c1') });

            // Published to the CHILD node on the gateway, not the post's own node.
            expect(publish).toHaveBeenCalledTimes(1);
            const [jid, node] = publish.mock.calls[0];
            expect(jid).toBe(GW);
            expect(node).toBe(CHILD_NODE);
        }),
    );

    it(
        'routes a live event on a prefix-less child node into its materialised feed',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const { post } = await seedPost(api);
            const feed = await api.microblog.comments.feed(post);
            await feed.addItems([liberviaComment('c1', 'Top comment', 'bob@example.org')]);

            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });
            // Materialise the child feed (as opening the comment would).
            const child = await api.microblog.comments.replies(feed.messages.get('c1'));
            expect(child.messages.length).toBe(0);

            // A live reply on the child node (its id lacks the conventional prefix)
            // still routes, because routing keys on feed existence.
            receive(_converse, childEvent('r1', 'Live reply', 'eve@example.org'));
            await u.waitUntil(() => child.messages.get('r1'));
            expect(child.messages.get('r1').get('title')).toBe('Live reply');
            // The owning comment's count reflects the live reply.
            await u.waitUntil(() => feed.messages.get('c1').get('reply_count') === 1);
        }),
    );
});
