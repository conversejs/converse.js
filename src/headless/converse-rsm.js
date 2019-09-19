/**
 * @module converse-rsm
 * @copyright The Converse.js developers
 * @license Mozilla Public License (MPLv2)
 * @description XEP-0059 Result Set Management
 *   Some code taken from the Strophe RSM plugin, licensed under the MIT License
 *   Copyright 2006-2017 Strophe (https://github.com/strophe/strophejs)
 */
import converse from "./converse-core";

const { Strophe, $build } = converse.env;

Strophe.addNamespace('RSM', 'http://jabber.org/protocol/rsm');


converse.plugins.add('converse-rsm', {
    initialize () {
        const { _converse } = this;
        const RSM_ATTRIBUTES = ['max', 'first', 'last', 'after', 'before', 'index', 'count'];
        _converse.RSM_ATTRIBUTES = RSM_ATTRIBUTES;


        class RSM {
            constructor (options) {
                if (typeof options.xml != 'undefined') {
                    this.fromXMLElement(options.xml);
                } else {
                    for (let ii = 0; ii < RSM_ATTRIBUTES.length; ii++) {
                        const attrib = RSM_ATTRIBUTES[ii];
                        this[attrib] = options[attrib];
                    }
                }
            }

            toXML () {
                let xml = $build('set', {xmlns: Strophe.NS.RSM});
                for (let ii = 0; ii < RSM_ATTRIBUTES.length; ii++) {
                    const attrib = RSM_ATTRIBUTES[ii];
                    if (typeof this[attrib] != 'undefined') {
                        xml = xml.c(attrib).t(this[attrib].toString()).up();
                    }
                }
                return xml.tree();
            }

            next (max, before) {
                return new RSM({max: max, after: this.last, before});
            }

            previous (max, after) {
                return new RSM({max: max, before: this.first, after});
            }

            fromXMLElement (xmlElement) {
                for (var ii = 0; ii < RSM_ATTRIBUTES.length; ii++) {
                    const attrib = RSM_ATTRIBUTES[ii];
                    const elem = xmlElement.getElementsByTagName(attrib)[0];
                    if (typeof elem != 'undefined' && elem !== null) {
                        this[attrib] = Strophe.getText(elem);
                        if (attrib == 'first') {
                            this.index = elem.getAttribute('index');
                        }
                    }
                }
            }
        }
        _converse.RSM = RSM;
    }
});
