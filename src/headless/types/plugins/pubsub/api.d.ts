declare namespace _default {
    namespace pubsub {
        namespace config {
            /**
             * Fetches the configuration for a PubSub node
             * @method _converse.api.pubsub.config.get
             * @param {string} jid - The JID of the pubsub service where the node resides
             * @param {string} node - The node to configure
             * @returns {Promise<import('./types').PubSubConfigOptions>}
             */
            function get(jid: string, node: string): Promise<import("./types").PubSubConfigOptions>;
            /**
             * Configures a PubSub node
             * @method _converse.api.pubsub.config.set
             * @param {string} jid The JID of the pubsub service where the node resides
             * @param {string} node The node to configure
             * @param {PubSubConfigOptions} config The configuration options
             * @returns {Promise<import('./types').PubSubConfigOptions>}
             */
            function set(jid: string, node: string, config: import("./types").PubSubConfigOptions): Promise<import("./types").PubSubConfigOptions>;
        }
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
        function publish(jid: string, node: string, item: import("strophe.js").Builder | import("strophe.js").Stanza | (import("strophe.js").Builder | import("strophe.js").Stanza)[], options: import("./types").PubSubConfigOptions, strict_options?: boolean): Promise<void | Element>;
        /**
         * Retracts (deletes) an item from a PubSub node (XEP-0060 § 7.2).
         * @method _converse.api.pubsub.retract
         * @param {string} jid - The JID of the pubsub service where the node
         *      resides. Pass a falsy value to retract from your own PEP service.
         * @param {string} node - The node to retract the item from
         * @param {string} id - The id of the item to retract
         * @param {object} [options]
         * @param {boolean} [options.notify=true] - Whether to ask the server to
         *      notify subscribers of the retraction.
         * @returns {Promise<void>}
         */
        function retract(jid: string, node: string, id: string, options?: {
            notify?: boolean;
        }): Promise<void>;
        /**
         * Creates a PubSub node at a given service
         * @param {string} jid - The PubSub service JID
         * @param {string} node - The node to create
         * @param {PubSubConfigOptions} config The configuration options
         * @returns {Promise<void>}
         */
        function create(jid: string, node: string, config: import("./types").PubSubConfigOptions): Promise<void>;
        /**
         * Subscribes the local user to a PubSub node.
         *
         * Subscribes with the *bare* JID, so the subscription is durable and
         * resource-independent: notifications are delivered to whichever
         * resource is online, and the subscription survives reconnects (a
         * full-JID subscription is bound to a resource that changes on every
         * reconnect, silently stranding delivery on the old resource).
         * @method _converse.api.pubsub.subscribe
         * @param {string} jid - PubSub service JID.
         * @param {string} node - The node to subscribe to
         * @returns {Promise<void>}
         */
        function subscribe(jid: string, node: string): Promise<void>;
        /**
         * Unsubscribes the local user from a PubSub node. Unsubscribes the bare
         * JID, matching the durable subscription created by {@link subscribe}.
         * @method _converse.api.pubsub.unsubscribe
         * @param {string} jid - The PubSub service JID
         * @param {string} node - The node to unsubscribe from
         * @returns {Promise<void>}
         */
        function unsubscribe(jid: string, node: string): Promise<void>;
        /**
         * Retrieves the subscriptions for the local user.
         * @method _converse.api.pubsub.subscriptions
         * @param {string} [jid] - The PubSub service JID.
         * @param {string} [node] - The node to retrieve subscriptions from.
         * @returns {Promise<import('./types').PubSubSubscription[]>}
         */
        function subscriptions(jid?: string, node?: string): Promise<import("./types").PubSubSubscription[]>;
        namespace items {
            /**
             * Retrieves items from a PubSub node (XEP-0060 § 6.5 "Retrieve Items").
             *
             * Supports requesting the most recent N items (`max_items`), specific
             * item ids (`item_ids`), and paging through large result sets with
             * XEP-0059 Result Set Management (`rsm`).
             *
             * @method _converse.api.pubsub.items.get
             * @param {string|null} jid - The JID of the pubsub service where the node
             *      resides. Pass a falsy value to query your own PEP service (bare JID).
             * @param {string} node - The node to retrieve items from
             * @param {import('./types').PubSubItemsOptions} [options]
             * @returns {Promise<import('./types').PubSubItemsResult>}
             */
            function get(jid: string | null, node: string, options?: import("./types").PubSubItemsOptions): Promise<import("./types").PubSubItemsResult>;
            /**
             * Resolve the payloads of a batch of PubSub event items, retrieving any
             * that arrived as a bare `<item id/>` header.
             *
             * A node whose `pubsub#deliver_payloads` is `false` is
             * "notification-only". It notifies subscribers with headers and expects
             * them to retrieve the content themselves (XEP-0060 § 4.3 Event Types).
             *
             * Best-effort: an id the service doesn't return is logged and left out,
             * rather than silently thinning the batch. The order of the rest is
             * preserved.
             *
             * @method _converse.api.pubsub.items.resolve
             * @param {string|null} jid - The JID of the pubsub service where the node
             *      resides. Pass a falsy value for your own PEP service (bare JID).
             * @param {string} node - The node the items were published to
             * @param {Element[]} items - The `<item>` elements from the event
             * @returns {Promise<Element[]>}
             */
            function resolve(jid: string | null, node: string, items: Element[]): Promise<Element[]>;
        }
    }
}
export default _default;
//# sourceMappingURL=api.d.ts.map