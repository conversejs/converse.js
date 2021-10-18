/**
 * @module converse-rsm
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description XEP-0059 Result Set Management
 *   Some code taken from the Strophe RSM plugin, licensed under the MIT License
 *   Copyright 2006-2017 Strophe (https://github.com/strophe/strophejs)
 */
import { _converse, converse } from "../core.js";
import pick from 'lodash-es/pick';

const { Strophe, $build } = converse.env;

Strophe.addNamespace('RSM', 'http://jabber.org/protocol/rsm');


/**
 * @typedef { Object } RSMQueryParameters
 * [XEP-0059 RSM](https://xmpp.org/extensions/xep-0059.html) Attributes that can be used to filter query results
 * @property { String } [after] - The XEP-0359 stanza ID of a message after which messages should be returned. Implies forward paging.
 * @property { String } [before] - The XEP-0359 stanza ID of a message before which messages should be returned. Implies backward paging.
 * @property { Integer } [index=0] - The index of the results page to return.
 * @property { Integer } [max] - The maximum number of items to return.
 */

const RSM_QUERY_PARAMETERS = ['after', 'before', 'index', 'max'];

const toNumber = v => Number(v);
const toString = v => v.toString();

export const RSM_TYPES = {
    'after': toString,
    'before': toString,
    'count': toNumber,
    'first': toString,
    'index': toNumber,
    'last': toString,
    'max': toNumber
};

const isUndefined = (x) => typeof x === 'undefined';


// This array contains both query attributes and response attributes
export const RSM_ATTRIBUTES = Object.keys(RSM_TYPES);


/**
 * Instances of this class are used to page through query results according to XEP-0059 Result Set Management
 * @class RSM
 */
export class RSM {

    static getQueryParameters (options={}) {
        return pick(options, RSM_QUERY_PARAMETERS);
    }

    static parseXMLResult (set) {
        const result = {};
        for (var i = 0; i < RSM_ATTRIBUTES.length; i++) {
            const attr = RSM_ATTRIBUTES[i];
            const elem = set.getElementsByTagName(attr)[0];
            if (!isUndefined(elem) && elem !== null) {
                result[attr] = RSM_TYPES[attr](Strophe.getText(elem));
                if (attr == 'first') {
                    result.index = RSM_TYPES['index'](elem.getAttribute('index'));
                }
            }
        }
        return result;
    }

    /**
     * Create a new RSM instance
     * @param { Object } options - Configuration options
     * @constructor
     */
    constructor (options={}) {
        this.query = RSM.getQueryParameters(options);
        this.result = options.xml ? RSM.parseXMLResult(options.xml) : {};
    }

    /**
     * Returns a `<set>` XML element that confirms to XEP-0059 Result Set Management.
     * The element is constructed based on the {@link module:converse-rsm~RSMQueryParameters}
     * that are set on this RSM instance.
     * @returns { XMLElement }
     */
    toXML () {
        const xml = $build('set', {xmlns: Strophe.NS.RSM});
        const reducer = (xml, a) => !isUndefined(this.query[a]) ? xml.c(a).t((this.query[a] || '').toString()).up() : xml;
        return RSM_QUERY_PARAMETERS.reduce(reducer, xml).tree();
    }

    next (max, before) {
        const options = Object.assign({}, this.query, { after: this.result.last, before, max });
        return new RSM(options);
    }

    previous (max, after) {
        const options = Object.assign({}, this.query, { after, before: this.result.first, max });
        return new RSM(options);
    }
}

_converse.RSM_ATTRIBUTES = RSM_ATTRIBUTES;
_converse.RSM = RSM;
