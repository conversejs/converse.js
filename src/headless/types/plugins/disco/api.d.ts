declare namespace _default {
    namespace disco {
        export namespace stream {
            /**
             * @method api.disco.stream.getFeature
             * @param { String } name The feature name
             * @param { String } xmlns The XML namespace
             * @example _converse.api.disco.stream.getFeature('ver', 'urn:xmpp:features:rosterver')
             */
            function getFeature(name: string, xmlns: string): Promise<any>;
        }
        export namespace own {
            namespace identities {
                /**
                 * Lets you add new identities for this client (i.e. instance of Converse)
                 * @method api.disco.own.identities.add
                 *
                 * @param {String} category - server, client, gateway, directory, etc.
                 * @param {String} type - phone, pc, web, etc.
                 * @param {String} name - "Converse"
                 * @param {String} lang - en, el, de, etc.
                 *
                 * @example _converse.api.disco.own.identities.clear();
                 */
                function add(category: string, type: string, name: string, lang: string): boolean;
                /**
                 * Clears all previously registered identities.
                 * @method api.disco.own.identities.clear
                 * @example _converse.api.disco.own.identities.clear();
                 */
                function clear(): void;
                /**
                 * Returns all of the identities registered for this client
                 * (i.e. instance of Converse).
                 * @method api.disco.identities.get
                 * @example const identities = api.disco.own.identities.get();
                 */
                function get(): any[];
            }
            namespace features {
                /**
                 * Lets you register new disco features for this client (i.e. instance of Converse)
                 * @method api.disco.own.features.add
                 * @param { String } name - e.g. http://jabber.org/protocol/caps
                 * @example _converse.api.disco.own.features.add("http://jabber.org/protocol/caps");
                 */
                function add(name: string): boolean;
                /**
                 * Clears all previously registered features.
                 * @method api.disco.own.features.clear
                 * @example _converse.api.disco.own.features.clear();
                 */
                function clear(): void;
                /**
                 * Returns all of the features registered for this client (i.e. instance of Converse).
                 * @method api.disco.own.features.get
                 * @example const features = api.disco.own.features.get();
                 */
                function get(): any[];
            }
        }
        /**
         * Query for information about an XMPP entity
         *
         * @method api.disco.info
         * @param {string} jid The Jabber ID of the entity to query
         * @param {string} [node] A specific node identifier associated with the JID
         * @returns {promise} Promise which resolves once we have a result from the server.
         */
        export function info(jid: string, node?: string): Promise<any>;
        /**
         * Query for items associated with an XMPP entity
         *
         * @method api.disco.items
         * @param {string} jid The Jabber ID of the entity to query for items
         * @param {string} [node] A specific node identifier associated with the JID
         * @returns {promise} Promise which resolves once we have a result from the server.
         */
        export function items(jid: string, node?: string): Promise<any>;
        export namespace entities {
            /**
             * Get the corresponding `DiscoEntity` instance.
             *
             * @method api.disco.entities.get
             * @param {string} jid The Jabber ID of the entity
             * @param {boolean} [create] Whether the entity should be created if it doesn't exist.
             * @return {Promise<DiscoEntity|DiscoEntities|undefined>}
             * @example _converse.api.disco.entities.get(jid);
             */
            function get(jid: string, create?: boolean): Promise<import("./entity").default | import("./entities").default | undefined>;
            /**
             * Return any disco items advertised on this entity
             *
             * @method api.disco.entities.items
             * @param {string} jid - The Jabber ID of the entity for which we want to fetch items
             * @example api.disco.entities.items(jid);
             */
            function items(jid: string): Promise<any>;
            /**
             * Create a new  disco entity. It's identity and features
             * will automatically be fetched from cache or from the
             * XMPP server.
             *
             * Fetching from cache can be disabled by passing in
             * `ignore_cache: true` in the options parameter.
             *
             * @method api.disco.entities.create
             * @param {object} data
             * @param {string} data.jid - The Jabber ID of the entity
             * @param {string} data.parent_jid - The Jabber ID of the parent entity
             * @param {string} data.name
             * @param {object} [options] - Additional options
             * @param {boolean} [options.ignore_cache]
             *     If true, fetch all features from the XMPP server instead of restoring them from cache
             * @example _converse.api.disco.entities.create({ jid }, {'ignore_cache': true});
             */
            function create(data: {
                jid: string;
                parent_jid: string;
                name: string;
            }, options?: {
                ignore_cache?: boolean;
            }): false | import("@converse/skeletor").Model | (Promise<any> & {
                isResolved: boolean;
                isPending: boolean;
                isRejected: boolean;
                resolve: Function;
                reject: Function;
            }) | import("@converse/skeletor/src/types/collection.js").Attributes;
        }
        export namespace features_1 {
            /**
             * Return a given feature of a disco entity
             *
             * @method api.disco.features.get
             * @param {string} feature The feature that might be
             *     supported. In the XML stanza, this is the `var`
             *     attribute of the `<feature>` element. For
             *     example: `http://jabber.org/protocol/muc`
             * @param {string} jid The JID of the entity
             *     (and its associated items) which should be queried
             * @returns {Promise<import('@converse/skeletor').Model|import('@converse/skeletor').Model[]>}
             *     A promise which resolves with a list containing
             *     _converse.Entity instances representing the entity
             *     itself or those items associated with the entity if
             *     they support the given feature.
             * @example
             * api.disco.features.get(Strophe.NS.MAM, _converse.bare_jid);
             */
            function get(feature: string, jid: string): Promise<import("@converse/skeletor").Model | import("@converse/skeletor").Model[]>;
            /**
             * Returns true if an entity with the given JID, or if one of its
             * associated items, supports a given feature.
             *
             * @method api.disco.features.has
             * @param {string} feature The feature that might be
             *     supported. In the XML stanza, this is the `var`
             *     attribute of the `<feature>` element. For
             *     example: `http://jabber.org/protocol/muc`
             * @param {string} jid The JID of the entity
             *     (and its associated items) which should be queried
             * @returns {Promise<boolean>} A promise which resolves with a boolean
             * @example
             *      api.disco.features.has(Strophe.NS.MAM, _converse.bare_jid);
             */
            function has(feature: string, jid: string): Promise<boolean>;
        }
        export { features_1 as features };
        /**
         * Used to determine whether an entity supports a given feature.
         *
         * @method api.disco.supports
         * @param {string} feature The feature that might be
         *     supported. In the XML stanza, this is the `var`
         *     attribute of the `<feature>` element. For
         *     example: `http://jabber.org/protocol/muc`
         * @param {string} jid The JID of the entity
         *     (and its associated items) which should be queried
         * @returns {Promise<boolean>|boolean} A promise which resolves with `true` or `false`.
         * @example
         * if (await api.disco.supports(Strophe.NS.MAM, _converse.bare_jid)) {
         *     // The feature is supported
         * } else {
         *     // The feature is not supported
         * }
         */
        export function supports(feature: string, jid: string): Promise<boolean> | boolean;
        /**
         * Refresh the features, fields and identities associated with a
         * disco entity by refetching them from the server
         * @method api.disco.refresh
         * @param {string} jid The JID of the entity whose features are refreshed.
         * @returns {Promise} A promise which resolves once the features have been refreshed
         * @example
         * await api.disco.refresh('room@conference.example.org');
         */
        export function refresh(jid: string): Promise<any>;
        /**
         * Return all the features associated with a disco entity
         *
         * @method api.disco.getFeatures
         * @param { string } jid The JID of the entity whose features are returned.
         * @returns {promise} A promise which resolves with the returned features
         * @example
         * const features = await api.disco.getFeatures('room@conference.example.org');
         */
        export function getFeatures(jid: string): Promise<any>;
        /**
         * Return all the service discovery extensions fields
         * associated with an entity.
         *
         * See [XEP-0129: Service Discovery Extensions](https://xmpp.org/extensions/xep-0128.html)
         *
         * @method api.disco.getFields
         * @param { string } jid The JID of the entity whose fields are returned.
         * @example
         * const fields = await api.disco.getFields('room@conference.example.org');
         */
        export function getFields(jid: string): Promise<any>;
        /**
         * Get the identity (with the given category and type) for a given disco entity.
         *
         * For example, when determining support for PEP (personal eventing protocol), you
         * want to know whether the user's own JID has an identity with
         * `category='pubsub'` and `type='pep'` as explained in this section of
         * XEP-0163: https://xmpp.org/extensions/xep-0163.html#support
         *
         * @method api.disco.getIdentity
         * @param {string} category -The identity category.
         *     In the XML stanza, this is the `category`
         *     attribute of the `<identity>` element.
         *     For example: 'pubsub'
         * @param {string} type - The identity type.
         *     In the XML stanza, this is the `type`
         *     attribute of the `<identity>` element.
         *     For example: 'pep'
         * @param {string} jid - The JID of the entity which might have the identity
         * @returns {promise} A promise which resolves with a map indicating
         *     whether an identity with a given type is provided by the entity.
         * @example
         * api.disco.getIdentity('pubsub', 'pep', _converse.bare_jid).then(
         *     function (identity) {
         *         if (identity) {
         *             // The entity DOES have this identity
         *         } else {
         *             // The entity DOES NOT have this identity
         *         }
         *     }
         * ).catch(e => log.error(e));
         */
        export function getIdentity(category: string, type: string, jid: string): Promise<any>;
    }
}
export default _default;
//# sourceMappingURL=api.d.ts.map