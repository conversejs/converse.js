/**
 * @module converse-pubsub
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import _converse from '../../shared/_converse.js';
import converse from '../../shared/api/public.js';
import pubsub_api from './api.js';
import '../disco/index.js';

const { Strophe } = converse.env;

Strophe.addNamespace('PUBSUB_ERROR', Strophe.NS.PUBSUB + '#errors');

converse.plugins.add('converse-pubsub', {
    dependencies: ['converse-disco'],

    initialize() {
        Object.assign(_converse.api, pubsub_api);
    },
});
