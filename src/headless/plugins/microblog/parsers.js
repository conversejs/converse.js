/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * Parse XEP-0277 (Microblogging over XMPP) Atom payloads. Stanza *construction*
 * lives on the feed model ({@link PubSubFeed.createPostStanza} /
 * `createRepostStanza`), following the codebase convention of building stanzas
 * on the model that owns the resulting objects.
 */
import sizzle from '#sizzle';
import { Strophe } from 'strophe.js';
import { getItemFromURI, getJIDFromURI, getNodeFromURI } from '../../utils/jid.js';
import { getUniqueId } from '../../utils/index.js';
import { decodeHTMLEntities } from '../../utils/html.js';
import { MICROBLOG_TYPE, NS_ATOM, NS_THREAD } from './constants.js';

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
        // previews (decodeHTMLEntities strips the tags).
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

const NS_GEOLOC = 'http://jabber.org/protocol/geoloc';

/**
 * Parse an XEP-0080 `<geoloc>` child of an Atom entry (XEP-0277 § Geotagging)
 * into a compact `{ lat, lon, label }` for rendering a location line, or
 * `undefined` when there's no geoloc or nothing worth showing. `label` prefers
 * the free-form `<text>`, else a "locality, region, country" join. Coordinates
 * are only returned when both parse as finite numbers (a map link needs both).
 * @param {Element} entry
 * @returns {{geoloc: { lat?: number, lon?: number, label?: string }} | undefined}
 */
function parseGeoloc(entry) {
    const geo = sizzle('> geoloc', entry).find((g) => g.namespaceURI === NS_GEOLOC);
    if (!geo) return undefined;

    const field = /** @param {string} name */ (name) =>
        sizzle(`> ${name}`, geo).pop()?.textContent?.trim() || undefined;
    const lat = Number(field('lat'));
    const lon = Number(field('lon'));
    const has_coords =
        field('lat') !== undefined && field('lon') !== undefined && Number.isFinite(lat) && Number.isFinite(lon);
    const label =
        field('text') || [field('locality'), field('region'), field('country')].filter(Boolean).join(', ') || undefined;

    if (!has_coords && !label) return undefined;

    return { geoloc: { ...(has_coords ? { lat, lon } : {}), ...(label ? { label } : {}) } };
}

/**
 * RFC 4685 threading (XEP-0277 § Replying to a Post). A comment/reply carries
 * one or more `<thr:in-reply-to>` pointing at the item it replies to. An entry
 * MAY carry several (e.g. an http and an xmpp form of the same target), so take
 * the first whose xmpp href yields an item id, keeping any `ref` (the parent's
 * atom:id) as a fallback resolver.
 * @param {Element} entry
 */
function parseThreading(entry) {
    let in_reply_to;
    let in_reply_to_ref;
    let in_reply_to_jid;
    let in_reply_to_node;

    const in_reply_tos = sizzle('> *', entry).filter(
        (el) => el.localName === 'in-reply-to' && el.namespaceURI === NS_THREAD,
    );

    for (const el of in_reply_tos) {
        const href = el.getAttribute('href') || undefined;
        const ref = el.getAttribute('ref') || undefined;
        // Keep the first `ref` seen as a fallback (resolves by atom:id when no href item id available)
        if (ref && !in_reply_to_ref) in_reply_to_ref = ref;

        const item = href?.startsWith('xmpp:') ? getItemFromURI(href) : undefined;
        if (item) {
            in_reply_to = item;
            in_reply_to_jid = getJIDFromURI(href);
            in_reply_to_node = getNodeFromURI(href);
            if (ref) in_reply_to_ref = ref;
            break;
        }
    }
    return {
        in_reply_to,
        in_reply_to_ref,
        in_reply_to_jid,
        in_reply_to_node,
    };
}

/**
 * Links carry repost provenance (`rel="via"`), the comments node
 * (`rel="replies"`), media attachments (`rel="enclosure"`), and the entry's
 * canonical web URL (`rel="alternate"`) are all unprefixed Atom elements. The
 * via href/ref are kept verbatim so reposting a repost can propagate them (the
 * via link must keep pointing at the *original* post, per XEP-0277).
 * @param {Element} entry
 * @param {string} author_jid
 * @param {string} publisher
 */
function parseLinks(entry, author_jid, publisher) {
    let via_jid;
    let via_href;
    let via_ref;
    let comments_jid;
    let comments_node;
    let alternate_url;
    const enclosures = [];

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
        } else if (rel === 'enclosure') {
            // RFC 4287 media attachment
            const href = link.getAttribute('href');
            if (href) {
                enclosures.push({
                    href,
                    type: link.getAttribute('type') || undefined,
                    title: link.getAttribute('title') || undefined,
                });
            }
        } else if (!rel || rel === 'alternate') {
            // The entry's canonical URL (RFC 4287 §4.2.7.2: a missing rel means
            // "alternate"). Blog/news bridges (WordPress via atomtopubsub) put the
            // article permalink here while the body is only a teaser, so keep the
            // first one to render as a "read more" link. Ignore non-web schemes
            // (e.g. an xmpp: self-reference).
            const href = link.getAttribute('href');
            if (href && !alternate_url && href.startsWith('http')) alternate_url = href;
        }
    }

    return {
        via_jid,
        via_href,
        via_ref,
        comments_jid,
        comments_node,
        alternate_url,
        ...(enclosures.length ? { enclosures } : {}),
        // An author JID that differs from the publisher marks a repeated post
        // (XEP-0277 § Repeating a Post). A `rel="via"` link is the explicit signal.
        is_repost:
            !!via_jid ||
            !!(
                author_jid &&
                publisher &&
                Strophe.getBareJidFromJid(author_jid) !== Strophe.getBareJidFromJid(publisher)
            ),
    };
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

    // An Atom entry can carry up to three text constructs:
    // - <title> XEP-0277 short posts put the whole post here
    // - <summary> Excerpt
    // - <content> Full body Atom-native feeds use this, often with an empty <title>
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
        categories: sizzle('> category', entry)
            .map((el) => el.getAttribute('term'))
            .filter(Boolean),
        published,
        updated,
        ...(time ? { time } : {}),

        ...parseThreading(entry),
        ...parseGeoloc(entry),
        ...parseLinks(entry, author_jid, publisher),
    };
}
