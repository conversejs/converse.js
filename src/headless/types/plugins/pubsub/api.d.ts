declare namespace _default {
    namespace pubsub {
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
        function publish(jid: string, node: string, item: import("strophe.js").Builder | import("strophe.js").Stanza | (import("strophe.js").Builder | import("strophe.js").Stanza)[], options: import("./types").PubSubConfigOptions, strict_options?: boolean): Promise<void | Element>;
    }
}
export default _default;
//# sourceMappingURL=api.d.ts.map