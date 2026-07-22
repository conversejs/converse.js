import { vi } from 'vitest';
import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { Strophe, stx } = converse.env;

export const ATOM = 'http://www.w3.org/2005/Atom';
export const PUBSUB_EVENT = `${Strophe.NS.PUBSUB}#event`;
export const MICROBLOG_NODE = 'urn:xmpp:microblog:0';

/**
 * Inject an incoming PEP/PubSub event stanza, as if pushed by the server.
 * @param {any} _converse
 * @param {Element|import('strophe.js').Builder} stanza
 */
export function receive(_converse, stanza) {
    _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
}

/**
 * Build a headline PEP event carrying a single plain-text microblog post, as the
 * server would push it: addressed to the publisher, from the publisher. The Atom
 * tag id is namespaced to the publisher's domain.
 * @param {string} from - The publisher's bare JID (also the feed JID).
 * @param {string} id - The PubSub item id.
 * @param {string} body - The post body.
 */
export function makePostStanza(from, id, body) {
    const domain = Strophe.getDomainFromJid(from);
    return stx`
        <message xmlns="jabber:client" from="${from}" to="${from}" type="headline">
          <event xmlns="${PUBSUB_EVENT}">
            <items node="${MICROBLOG_NODE}">
              <item id="${id}" publisher="${from}">
                <entry xmlns="${ATOM}">
                  <title type="text">${body}</title>
                  <id>tag:${domain},2024-01-01:posts-${id}</id>
                  <published>2024-01-01T18:30:02Z</published>
                  <updated>2024-01-01T18:30:02Z</updated>
                </entry>
              </item>
            </items>
          </event>
        </message>`;
}

/**
 * Build a headline PEP event that carries item *headers* only: bare `<item id/>`
 * elements, as a node whose `pubsub#deliver_payloads` is `false` pushes them
 * (XEP-0060 § 4.3 Event Types). The content has to be retrieved separately.
 * @param {string} from - The JID of the service hosting the node.
 * @param {string} node - The node the items were published to.
 * @param {...string} ids - The PubSub item ids.
 */
export function makeHeaderEvent(from, node, ...ids) {
    return stx`
        <message xmlns="jabber:client" from="${from}" to="${from}" type="headline">
          <event xmlns="${PUBSUB_EVENT}">
            <items node="${node}">${ids.map((id) => stx`<item id="${id}"/>`)}</items>
          </event>
        </message>`;
}

/**
 * Build a timeline post `<item>` tree, as `items.get` returns it.
 * @param {string} id - The PubSub item id.
 * @param {string} body - The post body.
 * @param {string} publisher - The publisher's bare JID.
 * @returns {Element}
 */
export function postItem(id, body, publisher) {
    return stx`
        <item id="${id}" publisher="${publisher}">
          <entry xmlns="${ATOM}">
            <title type="text">${body}</title>
            <id>tag:montague.lit,2024-01-01:posts-${id}</id>
            <published>2024-01-01T09:00:00Z</published>
            <updated>2024-01-01T09:00:00Z</updated>
          </entry>
        </item>`.tree();
}

/**
 * Build a headline PEP event carrying a single comment, as a comments node
 * (XEP-0277 § Comments) would push it: from the comments service, for the
 * comments node, carrying the commenter's `<author>`.
 * @param {string} service - The comments service JID (the post author's PEP, or a component).
 * @param {string} node - The comments node.
 * @param {string} id - The comment's item id.
 * @param {string} body - The comment text.
 * @param {string} author_jid - The commenter's bare JID.
 * @param {string} author_name - The commenter's display name.
 * @param {string} [published='2024-01-01T19:00:00Z'] - ISO-8601 publication time.
 */
export function makeCommentEvent(service, node, id, body, author_jid, author_name, published = '2024-01-01T19:00:00Z') {
    const domain = Strophe.getDomainFromJid(author_jid);
    return stx`
        <message xmlns="jabber:client" from="${service}" to="${service}" type="headline">
          <event xmlns="${PUBSUB_EVENT}">
            <items node="${node}">
              <item id="${id}" publisher="${author_jid}">
                <entry xmlns="${ATOM}">
                  <author>
                    <name>${author_name}</name>
                    <uri>xmpp:${author_jid}</uri>
                  </author>
                  <title type="text">${body}</title>
                  <id>tag:${domain},2024-01-01:comments-${id}</id>
                  <published>${published}</published>
                </entry>
              </item>
            </items>
          </event>
        </message>`;
}

/**
 * Build a comment `<item>` tree for a comments node (XEP-0277 § Comments),
 * carrying the commenter's `<author>`. A "like" is just a comment whose body is
 * the ♥ marker, e.g. `commentItem('l-1', '♥', liker)`.
 * @param {string} id - The comment's item id.
 * @param {string} body - The comment text (♥ for a like).
 * @param {string} [author='benvolio@montague.lit'] - The commenter's bare JID.
 * @returns {Element}
 */
export function commentItem(id, body, author = 'benvolio@montague.lit') {
    return stx`
        <item id="${id}">
          <entry xmlns="${ATOM}">
            <author><name>${author}</name><uri>xmpp:${author}</uri></author>
            <title type="text">${body}</title>
            <id>tag:capulet.lit,2024:comments-${id}</id>
            <published>2024-01-01T19:00:00Z</published>
          </entry>
        </item>`.tree();
}

/**
 * Seed a timeline feed with a single post that advertises its comments node via
 * a `rel="replies"` link, so `getCommentsService`/`getCommentsNode` resolve to
 * `author` + `urn:xmpp:microblog:0:comments/<id>`. Returns the feed and the
 * materialised post.
 * @param {any} api
 * @param {object} [opts]
 * @param {string} [opts.author='juliet@capulet.lit'] - The post author (feed JID).
 * @param {string} [opts.id='post-1'] - The post's PubSub item id.
 * @param {string} [opts.body='O Romeo'] - The post body.
 * @returns {Promise<{ feed: any, post: any }>}
 */
export async function seedPost(api, { author = 'juliet@capulet.lit', id = 'post-1', body = 'O Romeo' } = {}) {
    const feed = await api.microblog.feeds.get(author, MICROBLOG_NODE, true);
    const node = `urn:xmpp:microblog:0:comments/${id}`;
    const href = `xmpp:${author}?;node=${encodeURIComponent(node)}`;
    await feed.addItems([
        stx`
        <item id="${id}" publisher="${author}">
          <entry xmlns="${ATOM}">
            <title type="text">${body}</title>
            <link rel="replies" title="comments" href="${href}"/>
            <id>tag:capulet.lit,2024:posts-${id}</id>
            <published>2024-01-01T18:30:02Z</published>
          </entry>
        </item>`.tree(),
    ]);
    return { feed, post: feed.messages.get(id) };
}

/**
 * Stub the PEP network surface used by the follow/unfollow flow (publish the
 * XEP-0330 item, subscribe/unsubscribe, and the items.get backfill) so it
 * resolves without a server. Returns the spies for assertions.
 * @param {any} api
 */
export function stubPubsubNetwork(api) {
    return {
        publish: vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined),
        subscribe: vi.spyOn(api.pubsub, 'subscribe').mockResolvedValue(undefined),
        unsubscribe: vi.spyOn(api.pubsub, 'unsubscribe').mockResolvedValue(undefined),
        items_get: vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] }),
    };
}
