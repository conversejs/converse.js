import { vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, stx } = converse.env;

export const ATOM = 'http://www.w3.org/2005/Atom';
export const PUBSUB_EVENT = `${Strophe.NS.PUBSUB}#event`;
export const MICROBLOG_NODE = 'urn:xmpp:microblog:0';
export const ONBOARDING_DISMISSED = 'social_onboarding_dismissed';

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
 * server would push it: addressed to the logged-in user, from the publisher. The
 * Atom tag id is namespaced to the publisher's domain.
 * @param {string} to - The recipient's bare JID (the logged-in user).
 * @param {string} from - The publisher's bare JID (also the feed JID).
 * @param {string} id - The PubSub item id.
 * @param {string} body - The post body.
 * @param {string} [published='2024-01-01T18:30:02Z'] - ISO-8601 publication time (drives ordering).
 */
export function makePost(to, from, id, body, published = '2024-01-01T18:30:02Z') {
    const domain = Strophe.getDomainFromJid(from);
    return stx`
        <message xmlns="jabber:client" from="${from}" to="${to}" type="headline">
          <event xmlns="${PUBSUB_EVENT}">
            <items node="${MICROBLOG_NODE}">
              <item id="${id}" publisher="${from}">
                <entry xmlns="${ATOM}">
                  <title type="text">${body}</title>
                  <id>tag:${domain},2024-01-01:posts-${id}</id>
                  <published>${published}</published>
                  <updated>${published}</updated>
                </entry>
              </item>
            </items>
          </event>
        </message>`;
}

/**
 * Build a headline PEP event carrying a *repost*: the publisher (`from`) repeats
 * another account's entry. Carries an `<author>` (the original poster) and a
 * `rel="via"` link, the two signals the parser reads as a repost.
 * @param {string} to - The recipient's bare JID (the logged-in user).
 * @param {string} from - The reposter's bare JID (publisher + feed JID).
 * @param {string} id - The PubSub item id.
 * @param {string} body - The post body.
 * @param {string} author_jid - The original author's bare JID.
 * @param {string} author_name - The original author's display name.
 * @param {string} [published='2024-01-02T09:00:00Z'] - ISO-8601 publication time.
 */
export function makeRepost(to, from, id, body, author_jid, author_name, published = '2024-01-02T09:00:00Z') {
    const domain = Strophe.getDomainFromJid(author_jid);
    return stx`
        <message xmlns="jabber:client" from="${from}" to="${to}" type="headline">
          <event xmlns="${PUBSUB_EVENT}">
            <items node="${MICROBLOG_NODE}">
              <item id="${id}" publisher="${from}">
                <entry xmlns="${ATOM}">
                  <author>
                    <name>${author_name}</name>
                    <uri>xmpp:${author_jid}</uri>
                  </author>
                  <title type="text">${body}</title>
                  <id>tag:${domain},2024-01-02:posts-${id}</id>
                  <link rel="via" href="xmpp:${author_jid}?;node=urn%3Axmpp%3Amicroblog%3A0;item=orig"/>
                  <published>${published}</published>
                  <updated>${published}</updated>
                </entry>
              </item>
            </items>
          </event>
        </message>`;
}

/**
 * Mount a `<converse-social-feed>` into the test root and return it.
 * @returns {Element}
 */
export function mountSocialFeed() {
    const el = document.createElement('converse-social-feed');
    document.querySelector('#conversejs').appendChild(el);
    return el;
}

/**
 * Stub `api.microblog.discoverFollowable` to resolve with the given candidate
 * JIDs, returning the spy.
 * @param {any} api
 * @param {string[]} candidates
 */
export function stubDiscoverFollowable(api, candidates) {
    return vi.spyOn(api.microblog, 'discoverFollowable').mockResolvedValue(candidates);
}
