/**
 * @typedef {import('strophe.js/src/builder.js').Builder} Strophe.Builder
 */
import _converse from '../../shared/_converse.js';
import converse from '../../shared/api/public.js';
import { arrayBufferToBase64, stringToArrayBuffer  } from '../../utils/arraybuffer.js';

const { Strophe, stx } = converse.env;

function propertySort (array, property) {
    return array.sort((a, b) => { return a[property] > b[property] ? -1 : 1 });
}

async function generateVerificationString () {
    const identities = _converse.api.disco.own.identities.get();
    const features = _converse.api.disco.own.features.get();

    if (identities.length > 1) {
        propertySort(identities, "category");
        propertySort(identities, "type");
        propertySort(identities, "lang");
    }

    let S = identities.reduce((result, id) => `${result}${id.category}/${id.type}/${id?.lang ?? ''}/${id.name}<`, "");
    features.sort();
    S = features.reduce((result, feature) => `${result}${feature}<`, S);

    const ab = await crypto.subtle.digest('SHA-1', stringToArrayBuffer(S));
    return arrayBufferToBase64(ab);
}

/**
 * Given a stanza, adds a XEP-0115 CAPS element
 * @param {Strophe.Builder} stanza
 */
export async function addCapsNode (stanza) {
    const node = stx`<c
        xmlns="${Strophe.NS.CAPS}"
        hash="sha-1"
        node="https://conversejs.org"
        ver="${await generateVerificationString()}"></c>`;
    stanza.root().cnode(node).up();
    return stanza;
}
