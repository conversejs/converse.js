/**
 * @module converse-pubsub
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import _converse from '../../shared/_converse.js';
import converse from '../../shared/api/public.js';
import pubsub_api from './api.js';
import '../disco/index.js';

const { Strophe, sizzle } = converse.env;

Strophe.addNamespace('PUBSUB_ERROR', Strophe.NS.PUBSUB + '#errors');

converse.plugins.add('converse-pubsub', {
    dependencies: ['converse-disco'],

    initialize() {
        const { api } = _converse;
        Object.assign(_converse.api, pubsub_api);

        api.listen.on(
            'parseErrorStanza',
            /**
             * @param {Element} stanza
             * @param {import('shared/types.js').ErrorExtra} extra
             */
            (stanza, extra) => {
                const pubsub_err = sizzle(`error [xmlns="${Strophe.NS.PUBSUB_ERROR}"]`, stanza).pop();
                if (pubsub_err) {
                    return {
                        ...extra,
                        [Strophe.NS.PUBSUB_ERROR]: pubsub_err.nodeName,
                    };
                }
                return extra;
            }
        );
    },
});
