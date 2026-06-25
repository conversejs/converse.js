/**
 * @typedef {import('strophe.js').Builder} Strophe.Builder
 */
import _converse from '../../shared/_converse.js';
import converse from '../../shared/api/public.js';
import { arrayBufferToBase64, stringToArrayBuffer } from '../../utils/arraybuffer.js';

const { Strophe, sizzle, stx } = converse.env;

function propertySort(array, property) {
    return array.sort((a, b) => {
        return a[property] > b[property] ? -1 : 1;
    });
}

async function generateVerificationString() {
    const identities = _converse.api.disco.own.identities.get();
    const features = _converse.api.disco.own.features.get();

    if (identities.length > 1) {
        propertySort(identities, 'category');
        propertySort(identities, 'type');
        propertySort(identities, 'lang');
    }

    let S = identities.reduce((result, id) => `${result}${id.category}/${id.type}/${id?.lang ?? ''}/${id.name}<`, '');
    features.sort();
    S = features.reduce((result, feature) => `${result}${feature}<`, S);

    const ab = await crypto.subtle.digest('SHA-1', stringToArrayBuffer(S));
    return arrayBufferToBase64(ab);
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
 * Given a stanza, adds a XEP-0115 CAPS element
 * @param {Strophe.Builder} stanza
 */
export async function addCapsNode(stanza) {
    const node = stx`<c
        xmlns="${Strophe.NS.CAPS}"
        hash="sha-1"
        node="https://conversejs.org"
        ver="${await generateVerificationString()}"></c>`;
    stanza.root().cnode(node).up();
    return stanza;
}
