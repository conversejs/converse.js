// Converse.js
// https://conversejs.org
//
// Copyright (c) 2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)
/**
 * @module converse-pubsub
 */
import "./converse-disco";
import converse from "./converse-core";

const { Strophe, $iq } = converse.env;

Strophe.addNamespace('PUBSUB_ERROR', Strophe.NS.PUBSUB+"#errors");


converse.plugins.add('converse-pubsub', {

    dependencies: ["converse-disco"],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;


        /************************ BEGIN API ************************/
        // We extend the default converse.js API to add methods specific to MUC groupchats.
        Object.assign(_converse.api, {
            /**
             * The "pubsub" namespace groups methods relevant to PubSub
             *
             * @namespace _converse.api.pubsub
             * @memberOf _converse.api
             */
            'pubsub': {
                /**
                 * Publshes an item to a PubSub node
                 *
                 * @method _converse.api.pubsub.publish
                 * @param {string} jid The JID of the pubsub service where the node resides.
                 * @param {string} node The node being published to
                 * @param {Strophe.Builder} item The Strophe.Builder representation of the XML element being published
                 * @param {object} options An object representing the publisher options
                 *      (see https://xmpp.org/extensions/xep-0060.html#publisher-publish-options)
                 * @param {boolean} strict_options Indicates whether the publisher
                 *      options are a strict requirement or not. If they're NOT
                 *      strict, then Converse will publish to the node even if
                 *      the publish options precondication cannot be met.
                 */
                async 'publish' (jid, node, item, options, strict_options=true) {
                    const stanza = $iq({
                        'from': _converse.bare_jid,
                        'type': 'set',
                        'to': jid
                    }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                        .c('publish', {'node': node})
                            .cnode(item.tree()).up().up();

                    if (options) {
                        jid = jid || _converse.bare_jid;
                        if (await _converse.api.disco.supports(Strophe.NS.PUBSUB + '#publish-options', jid)) {
                            stanza.c('publish-options')
                                .c('x', {'xmlns': Strophe.NS.XFORM, 'type': 'submit'})
                                    .c('field', {'var': 'FORM_TYPE', 'type': 'hidden'})
                                        .c('value').t(`${Strophe.NS.PUBSUB}#publish-options`).up().up()

                            Object.keys(options).forEach(k => stanza.c('field', {'var': k}).c('value').t(options[k]).up().up());
                        } else {
                            _converse.log(`_converse.api.publish: ${jid} does not support #publish-options, `+
                                          `so we didn't set them even though they were provided.`)
                        }
                    }
                    try {
                        _converse.api.sendIQ(stanza);
                    } catch (iq) {
                        if (iq instanceof Element &&
                                strict_options &&
                                iq.querySelector(`precondition-not-met[xmlns="${Strophe.NS.PUBSUB_ERROR}"]`)) {

                            // The publish-options precondition couldn't be
                            // met. We re-publish but without publish-options.
                            const el = stanza.nodeTree;
                            el.querySelector('publish-options').outerHTML = '';
                            _converse.log(
                                `PubSub: Republishing without publish options. ${el.outerHTML}`,
                                Strophe.LogLevel.WARN
                            );
                            _converse.api.sendIQ(el);
                        } else {
                            throw iq;
                        }
                    }
                }
            }
        });
        /************************ END API ************************/
    }
});
