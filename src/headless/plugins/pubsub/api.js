/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import converse from '../../shared/api/public.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import log from '../../log.js';

const { Strophe, stx } = converse.env;

export default {
    /**
     * @typedef {import('strophe.js').Builder} Builder
     * @typedef {import('strophe.js').Stanza} Stanza
     *
     * The "pubsub" namespace groups methods relevant to PubSub
     * @namespace _converse.api.pubsub
     * @memberOf _converse.api
     */
    pubsub: {
        /**
         * Publshes an item to a PubSub node
         *
         * @method _converse.api.pubsub.publish
         * @param {string} jid The JID of the pubsub service where the node resides.
         * @param {string} node The node being published to
         * @param {Builder|Stanza|(Builder|Stanza)[]} item The XML element(s) being published
         * @param {import('./types').PubSubConfigOptions} options The publisher options
         *      (see https://xmpp.org/extensions/xep-0060.html#publisher-publish-options)
         * @param {boolean} strict_options Indicates whether the publisher
         *      options are a strict requirement or not. If they're NOT
         *      strict, then Converse will publish to the node even if
         *      the publish options precondition cannot be met.
         * @returns {Promise<void|Element>}
         */
        async publish(jid, node, item, options, strict_options = true) {
            const bare_jid = _converse.session.get('bare_jid');
            const entity_jid = jid || bare_jid;

            const stanza = stx`
                <iq xmlns="jabber:client"
                    from="${bare_jid}"
                    type="set"
                    ${entity_jid !== bare_jid ? `to="${entity_jid}"` : ''}>
                <pubsub xmlns="${Strophe.NS.PUBSUB}">
                    <publish node="${node}">${item}</publish>
                    ${
                        options
                            ? stx`<publish-options>
                    <x xmlns="${Strophe.NS.XFORM}" type="submit">
                        <field var="FORM_TYPE" type="hidden">
                            <value>${Strophe.NS.PUBSUB}#publish-options</value>
                        </field>
                        ${Object.entries(options).map(([k, v]) => stx`<field var="pubsub#${k}"><value>${v}</value></field>`)}
                    </x></publish-options>`
                            : ''
                    }
                </pubsub>
                </iq>`;

            if (entity_jid === bare_jid) {
                // This is PEP, check for support
                const supports_pep =
                    (await api.disco.getIdentity('pubsub', 'pep', bare_jid)) ||
                    (await api.disco.getIdentity('pubsub', 'pep', Strophe.getDomainFromJid(bare_jid)));

                if (!supports_pep) {
                    log.warn(`api.pubsub.publish: Not publishing via PEP because it's not supported!`);
                    log.warn(stanza);
                    return;
                }
            }

            // Check for #publish-options support.
            // XEP-0223 says we need to check the server for support,
            // but Prosody returns it on the bare jid.
            const supports_publish_options =
                (await api.disco.supports(Strophe.NS.PUBSUB + '#publish-options', entity_jid)) ||
                (await api.disco.supports(
                    Strophe.NS.PUBSUB + '#publish-options',
                    Strophe.getDomainFromJid(entity_jid)
                ));

            if (!supports_publish_options) {
                if (strict_options) {
                    log.warn(`api.pubsub.publish: #publish-options not supported, refusing to publish item.`);
                    log.warn(stanza);
                    return;
                } else {
                    log.warn(`api.pubsub.publish: #publish-options not supported, publishing anyway.`);
                }
            }

            try {
                await api.sendIQ(stanza);
            } catch (iq) {
                if (
                    iq instanceof Element &&
                    !strict_options &&
                    iq.querySelector(`precondition-not-met[xmlns="${Strophe.NS.PUBSUB_ERROR}"]`)
                ) {
                    // The publish-options precondition couldn't be
                    // met. We re-publish but without publish-options.
                    const el = stanza.tree();
                    el.querySelector('publish-options').outerHTML = '';
                    log.warn(`api.pubsub.publish: Republishing without publish options. ${el.outerHTML}`);
                    await api.sendIQ(el);
                } else {
                    throw iq;
                }
            }
        },
    },
};
