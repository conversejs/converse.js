import SHA1 from 'strophe.js/src/sha1';
import { _converse, converse } from '@converse/headless/core';

const { Strophe, $build } = converse.env;

function propertySort (array, property) {
    return array.sort((a, b) => { return a[property] > b[property] ? -1 : 1 });
}

function generateVerificationString () {
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
    return SHA1.b64_sha1(S);
}

export function createCapsNode () {
    return $build("c", {
        'xmlns': Strophe.NS.CAPS,
        'hash': "sha-1",
        'node': "https://conversejs.org",
        'ver': generateVerificationString()
    }).nodeTree;
}
