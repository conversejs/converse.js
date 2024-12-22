/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import converse from '../../shared/api/public.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import log from '../../log.js';
import { parseErrorStanza } from '../../shared/parsers.js';
import { parseStanzaForPubSubConfig } from './parsers.js';

const { Strophe, stx, u } = converse.env;

export default {
    /**
     * @typedef {import('strophe.js').Builder} Builder
     * @typedef {import('strophe.js').Stanza} Stanza
     * @typedef {import('./types').PubSubConfigOptions} PubSubConfigOptions
     *
     * The "pubsub" namespace groups methods relevant to PubSub
     * @namespace _converse.api.pubsub
     * @memberOf _converse.api
     */
    pubsub: {
        config: {
            /**
             * Fetches the configuration for a PubSub node
             * @method _converse.api.pubsub.configure
             * @param {string} jid - The JID of the pubsub service where the node resides
             * @param {string} node - The node to configure
             * @returns {Promise<import('./types').PubSubConfigOptions>}
             */
            async get(jid, node) {
                if (!node) throw new Error('api.pubsub.config.get: Node value required');

                const bare_jid = _converse.session.get('bare_jid');
                const full_jid = _converse.session.get('jid');
                const entity_jid = jid || bare_jid;

                const stanza = stx`
                    <iq xmlns="jabber:client"
                        from="${full_jid}"
                        type="get"
                        to="${entity_jid}">
                    <pubsub xmlns="${Strophe.NS.PUBSUB}"><configure node="${node}"/></pubsub>
                    </iq>`;

                let response;
                try {
                    response = await api.sendIQ(stanza);
                } catch (error) {
                    if (u.isErrorStanza(error)) {
                        throw parseErrorStanza(error);
                    }
                    throw error;
                }
                return parseStanzaForPubSubConfig(response);
            },

            /**
             * Configures a PubSub node
             * @method _converse.api.pubsub.configure
             * @param {string} jid The JID of the pubsub service where the node resides
             * @param {string} node The node to configure
             * @param {PubSubConfigOptions} config The configuration options
             * @returns {Promise<void|Element>}
             */
            async set(jid, node, config) {
                const bare_jid = _converse.session.get('bare_jid');
                const entity_jid = jid || bare_jid;

                const stanza = stx`
                    <iq xmlns="jabber:client"
                        from="${bare_jid}"
                        type="set"
                        to="${entity_jid}">
                    <pubsub xmlns="${Strophe.NS.PUBSUB}">
                        <configure node="${node}">
                            <x xmlns="${Strophe.NS.XFORM}" type="submit">
                                <field var="FORM_TYPE" type="hidden">
                                    <value>${Strophe.NS.PUBSUB}#nodeconfig</value>
                                </field>
                                ${Object.entries(config).map(([k, v]) => stx`<field var="${k}"><value>${v}</value></field>`)}
                            </x>
                        </configure>
                    </pubsub>
                    </iq>`;

                try {
                    const response = await api.sendIQ(stanza);
                    return response;
                } catch (error) {
                    throw error;
                }
            },
        },

        /**
         * Publshes an item to a PubSub node
         * @method _converse.api.pubsub.publish
         * @param {string} jid The JID of the pubsub service where the node resides.
         * @param {string} node The node being published to
         * @param {Builder|Stanza|(Builder|Stanza)[]} item The XML element(s) being published
         * @param {PubSubConfigOptions} options The publisher options
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
                    to="${entity_jid}">
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
            const supports_publish_options =
                (await api.disco.supports(Strophe.NS.PUBSUB + '#publish-options', entity_jid)) ||
                (entity_jid === bare_jid &&
                    // XEP-0223 says we need to check the server for support
                    // (although Prosody returns it on the bare jid)
                    (await api.disco.supports(
                        Strophe.NS.PUBSUB + '#publish-options',
                        Strophe.getDomainFromJid(entity_jid)
                    )));

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
