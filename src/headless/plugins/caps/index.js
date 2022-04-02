/**
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api, converse } from '@converse/headless/core';
import { createCapsNode } from './utils.js';

const { Strophe } = converse.env;

Strophe.addNamespace('CAPS', "http://jabber.org/protocol/caps");


converse.plugins.add('converse-caps', {

    dependencies: ['converse-status'],

    initialize () {
        api.listen.on('constructedPresence', (_, p) => (p.root().cnode(createCapsNode()).up() && p));
        api.listen.on('constructedMUCPresence', (_, p) => (p.root().cnode(createCapsNode()).up() && p));
    }
});
