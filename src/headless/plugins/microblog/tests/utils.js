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
