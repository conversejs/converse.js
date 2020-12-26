/**
 * @module converse-caps
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import SHA1 from 'strophe.js/src/sha1';
import { converse } from "@converse/headless/core";

const { Strophe, $build } = converse.env;

Strophe.addNamespace('CAPS', "http://jabber.org/protocol/caps");

function propertySort (array, property) {
    return array.sort((a, b) => { return a[property] > b[property] ? -1 : 1 });
}

function generateVerificationString (_converse) {
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

function createCapsNode (_converse) {
    return $build("c", {
        'xmlns': Strophe.NS.CAPS,
        'hash': "sha-1",
        'node': "https://conversejs.org",
        'ver': generateVerificationString(_converse)
    }).nodeTree;
}

converse.plugins.add('converse-caps', {

    overrides: {
        // Overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        XMPPStatus: {
            constructPresence () {
                const presence = this.__super__.constructPresence.apply(this, arguments);
                presence.root().cnode(createCapsNode(this.__super__._converse)).up();
                return presence;
            }
        }
    }
});
