/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import converse from '../../shared/api/public.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import log from "@converse/log";
import { parseErrorStanza } from '../../shared/parsers.js';
import { parseStanzaForPubSubConfig } from './parsers.js';

const { Strophe, stx } = converse.env;

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
             * @method _converse.api.pubsub.config.get
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
                    throw await parseErrorStanza(error);
                }
                return parseStanzaForPubSubConfig(response);
            },

            /**
             * Configures a PubSub node
             * @method _converse.api.pubsub.config.set
             * @param {string} jid The JID of the pubsub service where the node resides
             * @param {string} node The node to configure
             * @param {PubSubConfigOptions} config The configuration options
             * @returns {Promise<import('./types').PubSubConfigOptions>}
             */
            async set(jid, node, config) {
                if (!node) throw new Error('api.pubsub.config.set: Node value required');

                const bare_jid = _converse.session.get('bare_jid');
                const entity_jid = jid || bare_jid;
                const new_config = {
                    ...(await api.pubsub.config.get(entity_jid, node)),
                    ...config,
                };

                const stanza = stx`
                    <iq xmlns="jabber:client"
                        from="${bare_jid}"
                        type="set"
                        to="${entity_jid}">
                    <pubsub xmlns="${Strophe.NS.PUBSUB}#owner">
                        <configure node="${node}">
                            <x xmlns="${Strophe.NS.XFORM}" type="submit">
                                <field var="FORM_TYPE" type="hidden">
                                    <value>${Strophe.NS.PUBSUB}#nodeconfig</value>
                                </field>
                                ${Object.entries(new_config).map(([k, v]) => stx`<field var="${k}"><value>${v}</value></field>`)}
                            </x>
                        </configure>
                    </pubsub>
                    </iq>`;

                try {
                    await api.sendIQ(stanza);
                } catch (error) {
                    throw await parseErrorStanza(error);
                }
                return new_config;
            },
        },

        /**
         * Publishes an item to a PubSub node
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
            if (!node) throw new Error('api.pubsub.publish: node value required');
            if (!item) throw new Error('api.pubsub.publish: item value required');

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

            if (!supports_publish_options && strict_options) {
                log.warn(`api.pubsub.publish: #publish-options not supported, refusing to publish item.`);
                log.warn(stanza);
                return;
            }

            try {
                await api.sendIQ(stanza);
            } catch (iq) {
                const e = await parseErrorStanza(iq);
                if (
                    e.name === 'conflict' &&
                    /** @type {import('shared/errors').StanzaError} */(e).extra[Strophe.NS.PUBSUB_ERROR] === 'precondition-not-met'
                ) {
                    // Manually configure the node if we can't set it via publish-options
                    await api.pubsub.config.set(entity_jid, node, options);
                    try {
                        await api.sendIQ(stanza);
                    } catch (e) {
                        log.error(e);
                        if (!strict_options) {
                            // The publish-options precondition couldn't be met.
                            // We re-publish but without publish-options.
                            const el = stanza.tree();
                            el.querySelector('publish-options').outerHTML = '';
                            log.warn(`api.pubsub.publish: #publish-options precondition-not-met, publishing anyway.`);
                            await api.sendIQ(el);
                        }
                    }
                } else {
                    throw iq;
                }
            }
        },
    },
};
