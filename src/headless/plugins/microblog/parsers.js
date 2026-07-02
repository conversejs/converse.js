/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * Parse and build XEP-0277 (Microblogging over XMPP) Atom payloads.
 */
import sizzle from 'sizzle';
import { Strophe } from 'strophe.js';
import converse from '../../shared/api/public.js';
import _converse from '../../shared/_converse.js';
import { getJIDFromURI, getNodeFromURI } from '../../utils/jid.js';
import { getUniqueId } from '../../utils/index.js';
import { MICROBLOG_TYPE, NS_ATOM } from './constants.js';

const { stx } = converse.env;

/**
 * Resolve the `<atom:entry>` for a PubSub item (or accept a bare entry).
 * @param {Element} item
 * @returns {Element|undefined}
 */
function getEntry(item) {
    if (item.localName === 'entry' && item.namespaceURI === NS_ATOM) return item;
    return sizzle(`> entry[xmlns="${NS_ATOM}"]`, item).pop();
}

/**
 * Parse an Atom "Text construct" (`<title>`, `<summary>` or `<content>`): either
 * plain text or the Atom / XEP-0071 XHTML subset (a wrapping `<div>`).
 * @param {Element|undefined} el
 * @returns {{ text?: string, xhtml?: string }}
 */
function parseTextConstruct(el) {
    if (!el) return {};
    if (el.getAttribute('type') === 'xhtml') {
        const div = sizzle('> div', el).pop();
        return {
            text: el.textContent?.trim() || undefined,
            xhtml: div ? div.innerHTML : el.innerHTML,
        };
    }
    return { text: el.textContent?.trim() || undefined };
}

/**
 * Parse a single PubSub `<item>` (or a bare `<entry>`) from a microblog node
 * into a flat attributes object suitable for a {@link PubSubMessage}.
 *
 * @param {Element} item - An `<item>` element (as returned by retrieve-items or a
 *      PEP event), or an `<entry>` element directly.
 * @param {object} [context]
 * @param {string} [context.from] - JID of the feed this item belongs to.
 * @param {string} [context.node] - The PubSub node the item was published to.
 * @returns {import('./types').PubSubMessageAttrs}
 */
export function parseAtomEntry(item, { from, node } = {}) {
    const is_entry = item.localName === 'entry' && item.namespaceURI === NS_ATOM;
    const entry = getEntry(item);
    if (!entry) {
        throw new Error('parseAtomEntry: no <entry> found in item');
    }

    const id = is_entry ? getUniqueId() : item.getAttribute('id');
    // The PubSub server stamps the publisher on event/retrieve items; trust it
    // over the (spoofable) atom:author for authorship (XEP-0277 § Security).
    const publisher = is_entry ? undefined : item.getAttribute('publisher') || undefined;

    const author = sizzle('> author', entry).pop();
    const author_name = author ? sizzle('> name', author).pop()?.textContent?.trim() : undefined;
    const author_uri = author ? sizzle('> uri', author).pop()?.textContent?.trim() : undefined;
    const author_jid = author_uri ? getJIDFromURI(author_uri) : undefined;

    // Links carry repost provenance (`rel="via"`) and the comments node
    // (`rel="replies"`); both are un-prefixed Atom elements.
    let via_jid;
    let comments_node;
    for (const link of sizzle('> link', entry)) {
        const rel = link.getAttribute('rel');
        if (rel === 'via') {
            const href = link.getAttribute('href');
            via_jid = href ? getJIDFromURI(href) : undefined;
        } else if (rel === 'replies' && link.getAttribute('title') === 'comments') {
            comments_node = getNodeFromURI(link.getAttribute('href'));
        }
    }

    // An Atom entry can carry up to three text constructs:
    // - <title> XEP-0277 short posts put the whole post here
    // - <summary> Excerpt.
    // - <content> Full body Atom-native feeds use this, often with an empty <title>.
    const title = parseTextConstruct(sizzle('> title', entry).pop());
    const summary = parseTextConstruct(sizzle('> summary', entry).pop());
    const content = parseTextConstruct(sizzle('> content', entry).pop());

    const published = sizzle('> published', entry).pop()?.textContent?.trim();
    const updated = sizzle('> updated', entry).pop()?.textContent?.trim();
    const time = published ?? updated;

    return {
        type: MICROBLOG_TYPE,
        msgid: id,
        id,
        node,
        from,
        title: title.text,
        content: content.text,
        summary: summary.text,
        title_xhtml: title.xhtml,
        content_xhtml: content.xhtml,
        atom_id: sizzle('> id', entry).pop()?.textContent?.trim(),
        author_name,
        author_jid,
        publisher,
        // An author JID that differs from the publisher marks a repeated post
        // (XEP-0277 § Repeating a Post); a `rel="via"` link is the explicit signal.
        via_jid,
        is_repost: !!via_jid || !!(author_jid && publisher && Strophe.getBareJidFromJid(author_jid) !== publisher),
        comments_node,
        categories: sizzle('> category', entry)
            .map((el) => el.getAttribute('term'))
            .filter(Boolean),
        published,
        updated,
        ...(time ? { time } : {}),
    };
}

/**
 * Build the `tag:` URI used as the Atom `<id>` of a new entry (RFC 4151).
 * @param {string} jid
 * @param {string} id
 * @returns {string}
 */
function buildTagId(jid, id) {
    const domain = Strophe.getDomainFromJid(jid) || jid;
    const date = new Date().toISOString().split('T')[0];
    return `tag:${domain},${date}:posts-${id}`;
}

/**
 * Build a PubSub `<item>` containing an Atom `<entry>` for publishing.
 *
 * For the MVP this produces a minimal plain-text post; `author` is intentionally
 * omitted for own-feed posts (the node owner is implied per XEP-0277). Replies,
 * reposts and rich content are layered on in later milestones.
 *
 * @param {import('./types').PubSubPublishAttrs} attrs
 * @returns {import('strophe.js').Stanza}
 */
export function buildItem(attrs) {
    const { body, from } = attrs;
    const id = attrs.id || getUniqueId();
    const now = new Date().toISOString();
    const published = attrs.published || now;
    const updated = attrs.updated || now;
    const tag_id = attrs.atom_id || buildTagId(from || _converse.session?.get('bare_jid') || 'localhost', id);

    return stx`
        <item id="${id}">
            <entry xmlns="${NS_ATOM}">
                <title type="text">${body}</title>
                <id>${tag_id}</id>
                <published>${published}</published>
                <updated>${updated}</updated>
            </entry>
        </item>`;
}
