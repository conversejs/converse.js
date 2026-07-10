/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * Parse XEP-0277 (Microblogging over XMPP) Atom payloads. Stanza *construction*
 * lives on the feed model ({@link PubSubFeed.createPostStanza} /
 * `createRepostStanza`), following the codebase convention of building stanzas
 * on the model that owns the resulting objects.
 */
import sizzle from 'sizzle';
import { Strophe } from 'strophe.js';
import { getJIDFromURI, getNodeFromURI } from '../../utils/jid.js';
import { getUniqueId } from '../../utils/index.js';
import { decodeHTMLEntities } from '../../utils/html.js';
import { MICROBLOG_TYPE, NS_ATOM } from './constants.js';

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
 * Classify an Atom text construct's `type` into how we render it. RFC 4287 §3.1
 * defines the shorthands `text`/`html`/`xhtml` for text constructs, but
 * `atom:content` (§4.1.3) may instead carry a MIME type: bridges like
 * atomtopubsub (WordPress → XMPP, seen here via Movim) stamp `type="text/html"`
 * for entity-escaped HTML, so treat that as `html`. An absent or unrecognised
 * type is plain text.
 * @param {Element} el
 * @returns {'text'|'html'|'xhtml'}
 */
function textConstructKind(el) {
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (type === 'xhtml') return 'xhtml';
    if (type === 'html' || type === 'text/html') return 'html';
    return 'text';
}

/**
 * Parse an Atom "Text construct" (`<title>`, `<summary>` or `<content>`): plain
 * text, a wrapping XHTML `<div>` (`xhtml`), or an entity-escaped HTML fragment
 * (`html` / `text/html`, common in blog/Atom feeds). For the two markup forms we
 * return the HTML in `xhtml` (the caller renders it sanitized) plus a plain-text
 * form in `text` for previews.
 * @param {Element|undefined} el
 * @returns {{ text?: string, xhtml?: string }}
 */
function parseTextConstruct(el) {
    if (!el) return {};
    const kind = textConstructKind(el);
    if (kind === 'xhtml') {
        const div = sizzle('> div', el).pop();
        return {
            text: el.textContent?.trim() || undefined,
            xhtml: (div ? div.innerHTML : el.innerHTML) || undefined,
        };
    }
    if (kind === 'html') {
        // The XML parser has already unescaped the fragment, so textContent is the
        // HTML markup itself. Keep it for rich rendering; derive plain text for
        // previews (decodeHTMLEntities sanitizes and strips tags).
        const markup = el.textContent?.trim() || undefined;
        return { text: markup ? decodeHTMLEntities(markup) : undefined, xhtml: markup };
    }
    return { text: el.textContent?.trim() || undefined };
}

/**
 * Select the best rendition of an Atom text construct from every sibling of the
 * same name.
 *
 * Movim publishes the same construct twice: a rich `<content type="xhtml">`
 * alongside a `<content type="text">` Markdown source.
 * @param {Element[]} els
 * @returns {{ text?: string, xhtml?: string }}
 */
function pickTextConstruct(els) {
    if (!els.length) return {};
    const isRich = (el) => textConstructKind(el) !== 'text';
    const rich = parseTextConstruct(els.find(isRich));
    const plain = parseTextConstruct(els.find((el) => !isRich(el)));
    return { xhtml: rich.xhtml, text: plain.text ?? rich.text };
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
    // (`rel="replies"`); both are un-prefixed Atom elements. The via href/ref
    // are kept verbatim so reposting a repost can propagate them (the via link
    // must keep pointing at the *original* post, per XEP-0277).
    let via_jid;
    let via_href;
    let via_ref;
    let comments_jid;
    let comments_node;
    for (const link of sizzle('> link', entry)) {
        const rel = link.getAttribute('rel');
        if (rel === 'via') {
            via_href = link.getAttribute('href') || undefined;
            via_ref = link.getAttribute('ref') || undefined;
            via_jid = via_href ? getJIDFromURI(via_href) : undefined;
        } else if (rel === 'replies' && link.getAttribute('title') === 'comments') {
            // The comments node may live on the author's PEP service or on a
            // dedicated pubsub component, so keep the href's service JID too.
            const href = link.getAttribute('href');
            comments_jid = href ? getJIDFromURI(href) : undefined;
            comments_node = getNodeFromURI(href);
        }
    }

    // An Atom entry can carry up to three text constructs:
    // - <title> XEP-0277 short posts put the whole post here
    // - <summary> Excerpt.
    // - <content> Full body Atom-native feeds use this, often with an empty <title>.
    const title = pickTextConstruct(sizzle('> title', entry));
    const summary = pickTextConstruct(sizzle('> summary', entry));
    const content = pickTextConstruct(sizzle('> content', entry));

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
        summary_xhtml: summary.xhtml,
        content_xhtml: content.xhtml,
        atom_id: sizzle('> id', entry).pop()?.textContent?.trim(),
        author_name,
        author_jid,
        publisher,
        // An author JID that differs from the publisher marks a repeated post
        // (XEP-0277 § Repeating a Post); a `rel="via"` link is the explicit signal.
        // Compare both sides bare: Movim stamps a *full* JID publisher (with a
        // resource), so a naive bare-vs-full check would flag every post a repost.
        via_jid,
        via_href,
        via_ref,
        is_repost:
            !!via_jid ||
            !!(
                author_jid &&
                publisher &&
                Strophe.getBareJidFromJid(author_jid) !== Strophe.getBareJidFromJid(publisher)
            ),
        comments_jid,
        comments_node,
        categories: sizzle('> category', entry)
            .map((el) => el.getAttribute('term'))
            .filter(Boolean),
        published,
        updated,
        ...(time ? { time } : {}),
    };
}
