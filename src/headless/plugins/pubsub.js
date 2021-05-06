/**
 * @module converse-pubsub
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "./disco/index.js";
import { _converse, api, converse } from "../core.js";
import log from "../log.js";

const { Strophe, $iq } = converse.env;

Strophe.addNamespace('PUBSUB_ERROR', Strophe.NS.PUBSUB+"#errors");


converse.plugins.add('converse-pubsub', {

    dependencies: ["converse-disco"],

    initialize () {

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
                        if (await api.disco.supports(Strophe.NS.PUBSUB + '#publish-options', jid)) {
                            stanza.c('publish-options')
                                .c('x', {'xmlns': Strophe.NS.XFORM, 'type': 'submit'})
                                    .c('field', {'var': 'FORM_TYPE', 'type': 'hidden'})
                                        .c('value').t(`${Strophe.NS.PUBSUB}#publish-options`).up().up()

                            Object.keys(options).forEach(k => stanza.c('field', {'var': k}).c('value').t(options[k]).up().up());
                        } else {
                            log.warn(`_converse.api.publish: ${jid} does not support #publish-options, `+
                                     `so we didn't set them even though they were provided.`)
                        }
                    }
                    try {
                        await api.sendIQ(stanza);
                    } catch (iq) {
                        if (iq instanceof Element &&
                                strict_options &&
                                iq.querySelector(`precondition-not-met[xmlns="${Strophe.NS.PUBSUB_ERROR}"]`)) {

                            // The publish-options precondition couldn't be
                            // met. We re-publish but without publish-options.
                            const el = stanza.nodeTree;
                            el.querySelector('publish-options').outerHTML = '';
                            log.warn(`PubSub: Republishing without publish options. ${el.outerHTML}`);
                            await api.sendIQ(el);
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
