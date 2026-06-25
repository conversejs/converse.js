/**
 * @typedef {import('strophe.js').Builder} Strophe.Builder
 */
import log from '@converse/log';
import _converse from '../../shared/_converse.js';
import converse from '../../shared/api/public.js';
import { arrayBufferToBase64, stringToArrayBuffer } from '../../utils/arraybuffer.js';

const { Strophe, sizzle, stx } = converse.env;

const text_encoder = new TextEncoder();

/**
 * Compares two strings using "i;octet" collation, i.e. a byte-wise comparison of
 * their UTF-8 encodings, as required by XEP-0115 § 5.1 for all sorting.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function octetCompare(a, b) {
    const ba = text_encoder.encode(a ?? '');
    const bb = text_encoder.encode(b ?? '');
    const len = Math.min(ba.length, bb.length);
    for (let i = 0; i < len; i++) {
        if (ba[i] !== bb[i]) return ba[i] - bb[i];
    }
    return ba.length - bb.length;
}

/**
 * Generates an XEP-0115 verification string for the given disco#info data,
 * following the generation method in XEP-0115 § 5.1.
 * @param {import('./types').CapsInfoData} data
 * @returns {Promise<string>} The base64-encoded SHA-1 hash
 */
export async function generateVerificationString({ identities = [], features = [], dataforms = [] }) {
    // Identities, sorted by category/type/xml:lang and formatted as
    // "category/type/lang/name".
    let S = identities
        .map((id) => `${id.category}/${id.type}/${id.lang ?? ''}/${id.name ?? ''}`)
        .sort(octetCompare)
        .map((s) => `${s}<`)
        .join('');

    // Features, sorted.
    S += [...features]
        .sort(octetCompare)
        .map((feature) => `${feature}<`)
        .join('');

    // XEP-0128 data forms, sorted by FORM_TYPE. Forms without a FORM_TYPE are
    // ignored (XEP-0115 § 5.4).
    const forms = dataforms
        .map((fields) => ({ fields, form_type: (fields['FORM_TYPE'] ?? [])[0] }))
        .filter(({ form_type }) => form_type !== undefined)
        .sort((a, b) => octetCompare(a.form_type, b.form_type));

    for (const { fields, form_type } of forms) {
        S += `${form_type}<`;
        const vars = Object.keys(fields)
            .filter((v) => v !== 'FORM_TYPE')
            .sort(octetCompare);
        for (const v of vars) {
            S += `${v}<`;
            S += [...fields[v]]
                .sort(octetCompare)
                .map((value) => `${value}<`)
                .join('');
        }
    }

    const ab = await crypto.subtle.digest('SHA-1', stringToArrayBuffer(S));
    return arrayBufferToBase64(ab);
}

/**
 * Computes the verification string for this client (Converse itself), from its
 * own registered disco identities and features.
 * @returns {Promise<string>}
 */
function getOwnVerificationString() {
    return generateVerificationString({
        identities: _converse.api.disco.own.identities.get(),
        features: _converse.api.disco.own.features.get(),
        dataforms: [],
    });
}

/**
 * Checks that disco#info data is well-formed for caps purposes: no duplicate
 * identities, features or FORM_TYPE values (XEP-0115 § 5.4).
 * @param {import('./types').CapsInfoData} data
 * @returns {boolean}
 */
function isWellFormed({ identities = [], features = [], dataforms = [] }) {
    const identity_keys = identities.map((id) => `${id.category}/${id.type}/${id.lang ?? ''}/${id.name ?? ''}`);
    if (new Set(identity_keys).size !== identity_keys.length) return false;
    if (new Set(features).size !== features.length) return false;
    const form_types = dataforms.map((f) => (f['FORM_TYPE'] ?? [])[0]).filter((t) => t !== undefined);
    if (new Set(form_types).size !== form_types.length) return false;
    return true;
}

/**
 * Verifies that the given disco#info data hashes to the advertised verification
 * string (XEP-0115 § 5.4). Only the mandatory-to-implement SHA-1 algorithm is
 * supported; any other hash is treated as unverifiable.
 * @param {import('./types').CapsInfoData} info
 * @param {string} hash - The advertised hashing algorithm
 * @param {string} ver - The advertised verification string
 * @returns {Promise<boolean>}
 */
export async function verifyCaps(info, hash, ver) {
    if (hash !== 'sha-1') return false;
    if (!isWellFormed(info)) return false;
    return (await generateVerificationString(info)) === ver;
}

/**
 * The storage key for the XEP-0115 capabilities cache. It isn't suffixed with
 * the user's JID like most stores: the persistent storage backend is already
 * scoped to the logged-in account, and a verification hash is a content
 * address, so a single cache per account suffices.
 * @returns {string}
 */
export function getCapsCacheStorageKey() {
    return 'converse.caps';
}

/**
 * Parses the XEP-0115 entity capabilities (`<c/>`) element from a presence
 * stanza, if present.
 * @param {Element} stanza
 * @returns {import('./types').CapsAttributes|null}
 */
export function getCapsAttrs(stanza) {
    const c = sizzle(`c[xmlns="${Strophe.NS.CAPS}"]`, stanza).pop();
    if (!c) return null;
    return {
        hash: c.getAttribute('hash'),
        node: c.getAttribute('node'),
        ver: c.getAttribute('ver'),
    };
}

/**
 * Returns the caps (hash, node, ver) most recently advertised by the given
 * full JID in its presence, or `undefined` if none is known.
 * @param {string} jid - The full JID of the entity
 * @returns {import('./types').CapsAttributes|undefined}
 */
export function getEntityCaps(jid) {
    return /** @type {Map<string, import('./types').CapsAttributes>} */ (_converse.state.caps_map)?.get(jid);
}

/**
 * Handler for the `parsePresence` hook which enriches the parsed presence
 * attributes with the sender's advertised XEP-0115 entity capabilities, and
 * keeps an in-memory map of full JID -> caps so that we can later look up the
 * advertised `ver` when disco information for that JID is needed.
 * @param {Element} stanza
 * @param {import('../roster/types').PresenceAttributes} attrs
 * @returns {import('../roster/types').PresenceAttributes}
 */
export function onParsePresence(stanza, attrs) {
    const caps_map = /** @type {Map<string, import('./types').CapsAttributes>} */ (_converse.state.caps_map);
    const { from, type } = attrs;

    if (type === 'unavailable') {
        // The resource has gone offline, so forget its advertised caps.
        caps_map?.delete(from);
        return attrs;
    }

    const caps = getCapsAttrs(stanza);
    if (caps) {
        caps_map?.set(from, caps);
        return { ...attrs, caps };
    }
    return attrs;
}

/**
 * Parses a disco#info response stanza into the canonical structure used for caps
 * verification and caching. Unlike the disco entity's own parsing, this
 * preserves identity `xml:lang` values and all values of multi-valued data form
 * fields, both of which are needed to recompute the verification hash.
 * @param {Element} stanza
 * @returns {import('./types').CapsInfoData}
 */
export function parseDiscoInfoForCaps(stanza) {
    const identities = sizzle('identity', stanza).map((el) => ({
        category: el.getAttribute('category'),
        type: el.getAttribute('type'),
        name: el.getAttribute('name') ?? '',
        lang: el.getAttribute('xml:lang') ?? '',
    }));
    const features = sizzle('feature', stanza).map((el) => el.getAttribute('var'));
    const dataforms = sizzle(`x[xmlns="${Strophe.NS.XFORM}"]`, stanza).map((form) => {
        /** @type {Record<string, string[]>} */
        const fields = {};
        sizzle('field', form).forEach((field) => {
            const v = field.getAttribute('var');
            if (v) fields[v] = sizzle('value', field).map((val) => val.textContent ?? '');
        });
        return fields;
    });
    return { identities, features, dataforms };
}

/**
 * Handler for disco's generic `discoEntityInfoRequested` hook. Given a disco
 * entity, returns the cached disco#info for the XEP-0115 caps it advertised in
 * presence (if we've already verified that `ver`) plus the caps query node, so
 * that disco can skip or scope its network query. Returns `null` if the entity
 * advertised no caps.
 * @param {import('../disco/entity').default} entity
 * @returns {import('../disco/types').DiscoInfoLookup|null}
 */
export function onDiscoEntityInfoRequested(entity) {
    const caps = getEntityCaps(entity.get('jid'));
    if (!caps) return null;

    const cached = _converse.state.caps_cache?.getCachedInfo(caps.hash, caps.ver);
    return {
        // The caps query node (XEP-0115 § 6.2); disco treats it as opaque.
        node: `${caps.node}#${caps.ver}`,
        info: cached
            ? {
                  identities: cached.get('identities'),
                  features: cached.get('features'),
                  dataforms: cached.get('dataforms'),
              }
            : null,
    };
}

/**
 * Handler for the `discoEntityInfoReceived` hook. After a disco#info response is
 * received and parsed, verify it against the entity's advertised `ver`
 * (XEP-0115 § 5.4) and, if valid, cache it so that future entities advertising
 * the same `ver` can skip the disco#info query.
 * @param {import('../disco/entity').default} entity
 * @param {Element} stanza
 * @returns {Promise<Element>}
 */
export async function onDiscoEntityInfoReceived(entity, stanza) {
    const caps = getEntityCaps(entity.get('jid'));
    if (caps) {
        const info = parseDiscoInfoForCaps(stanza);
        if (await verifyCaps(info, caps.hash, caps.ver)) {
            _converse.state.caps_cache?.store(caps, info);
        } else {
            log.debug(`caps: not caching unverified capabilities for ${entity.get('jid')} (${caps.hash}/${caps.ver})`);
        }
    }
    return stanza;
}

/**
 * Detects, once per connection, whether our own server supports XEP-0115 Caps
 * Optimization (§ 8.4) and records the result so that broadcast presence can omit
 * redundant `<c/>` elements.
 * @returns {Promise<void>}
 */
export async function detectCapsOptimizationSupport() {
    const domain = _converse.session?.get('domain');
    try {
        _converse.state.caps_optimize = !!(
            domain && (await _converse.api.disco.supports(Strophe.NS.CAPS_OPTIMIZE, domain))
        );
    } catch (e) {
        log.error(e);
        _converse.state.caps_optimize = false;
    }
}

/**
 * Adds a XEP-0115 capabilities (`<c/>`) element to the given presence stanza.
 *
 * Optimization (XEP-0115 § 8.4) only applies to broadcast presence (presence
 * with no `to`). When `optimize` is true, our server supports Caps Optimization
 * and this is a broadcast presence, the `<c/>` is omitted on presences whose
 * verification string we've already advertised this session: the server re-adds
 * the annotation for new subscribers and forwards any `ver` change, so
 * re-sending an unchanged `<c/>` on every presence is wasteful. The first
 * presence (and any subsequent `ver` change) is always annotated. Directed
 * presence (e.g. a MUC join or a presence probe) is never optimized, as
 * server-side broadcast stripping doesn't apply to it.
 * @param {Strophe.Builder} stanza
 * @param {boolean} [optimize=false]
 * @returns {Promise<Strophe.Builder>}
 */
export async function addCapsNode(stanza, optimize = false) {
    const ver = await getOwnVerificationString();
    // Only broadcast presence (no `to`) is subject to § 8.4 optimization;
    // directed presence is always annotated and never updates the send-side
    // state, since the server only caches and re-adds caps for broadcasts.
    const may_optimize = optimize && !stanza.tree().getAttribute('to');
    if (may_optimize && _converse.state.caps_optimize && _converse.state.caps_last_sent_ver === ver) {
        return stanza;
    }
    const node = stx`<c
        xmlns="${Strophe.NS.CAPS}"
        hash="sha-1"
        node="https://conversejs.org"
        ver="${ver}"></c>`;
    stanza.root().cnode(node).up();
    if (may_optimize) _converse.state.caps_last_sent_ver = ver;
    return stanza;
}
