// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse developers
// Licensed under the Mozilla Public License (MPLv2)
/**
 * @module converse-disco
 * @description
 * Converse plugin which add support for XEP-0030: Service Discovery
 */
import BrowserStorage from "backbone.browserStorage";
import converse from "./converse-core";
import sizzle from "sizzle";

const { Backbone, Strophe, $iq, utils, _ } = converse.env;

converse.plugins.add('converse-disco', {

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;

        // Promises exposed by this plugin
        _converse.api.promises.add('discoInitialized');
        _converse.api.promises.add('streamFeaturesAdded');


        /**
         * @class
         * @namespace _converse.DiscoEntity
         * @memberOf _converse
         */
        _converse.DiscoEntity = Backbone.Model.extend({
            /* A Disco Entity is a JID addressable entity that can be queried
             * for features.
             *
             * See XEP-0030: https://xmpp.org/extensions/xep-0030.html
             */
            idAttribute: 'jid',

            initialize (attrs, options) {
                this.waitUntilFeaturesDiscovered = utils.getResolveablePromise();

                this.dataforms = new _converse.Collection();
                this.dataforms.browserStorage = new BrowserStorage.session(
                    `converse.dataforms-${this.get('jid')}`
                );

                this.features = new _converse.Collection();
                this.features.browserStorage = new BrowserStorage.session(
                    `converse.features-${this.get('jid')}`
                );
                this.listenTo(this.features, 'add', this.onFeatureAdded)

                this.fields = new _converse.Collection();
                this.fields.browserStorage = new BrowserStorage.session(
                    `converse.fields-${this.get('jid')}`
                );
                this.listenTo(this.fields, 'add', this.onFieldAdded)

                this.identities = new _converse.Collection();
                this.identities.browserStorage = new BrowserStorage.session(
                    `converse.identities-${this.get('jid')}`
                );
                this.fetchFeatures(options);

                this.items = new _converse.DiscoEntities();
                this.items.browserStorage = new BrowserStorage.session(
                    `converse.disco-items-${this.get('jid')}`
                );
                this.items.fetch();
            },

            /**
             * Returns a Promise which resolves with a map indicating
             * whether a given identity is provided by this entity.
             * @private
             * @method _converse.DiscoEntity#getIdentity
             * @param { String } category - The identity category
             * @param { String } type - The identity type
             */
            async getIdentity (category, type) {
                await this.waitUntilFeaturesDiscovered;
                return this.identities.findWhere({
                    'category': category,
                    'type': type
                });
            },

            /**
             * Returns a Promise which resolves with a map indicating
             * whether a given feature is supported.
             * @private
             * @method _converse.DiscoEntity#hasFeature
             * @param { String } feature - The feature that might be supported.
             */
            async hasFeature (feature) {
                await this.waitUntilFeaturesDiscovered
                if (this.features.findWhere({'var': feature})) {
                    return this;
                }
            },

            onFeatureAdded (feature) {
                feature.entity = this;
                /**
                 * Triggered when Converse has learned of a service provided by the XMPP server.
                 * See XEP-0030.
                 * @event _converse#serviceDiscovered
                 * @type { Backbone.Model }
                 * @example _converse.api.listen.on('featuresDiscovered', feature => { ... });
                 */
                _converse.api.trigger('serviceDiscovered', feature);
            },

            onFieldAdded (field) {
                field.entity = this;
                /**
                 * Triggered when Converse has learned of a disco extension field.
                 * See XEP-0030.
                 * @event _converse#discoExtensionFieldDiscovered
                 * @example _converse.api.listen.on('discoExtensionFieldDiscovered', () => { ... });
                 */
                _converse.api.trigger('discoExtensionFieldDiscovered', field);
            },

            fetchFeatures (options) {
                if (options.ignore_cache || this.features.browserStorage.records.length === 0) {
                    this.queryInfo();
                } else {
                    this.features.fetch({
                        add: true,
                        success: () => {
                            this.waitUntilFeaturesDiscovered.resolve(this);
                            this.trigger('featuresDiscovered');
                        }
                    });
                    this.identities.fetch({add: true});
                }
            },

            async queryInfo () {
                let stanza;
                try {
                    stanza = await _converse.api.disco.info(this.get('jid'), null);
                } catch (iq) {
                    _converse.log(iq, Strophe.LogLevel.ERROR);
                    this.waitUntilFeaturesDiscovered.resolve(this);
                    return;
                }
                this.onInfo(stanza);
            },

            onDiscoItems (stanza) {
                sizzle(`query[xmlns="${Strophe.NS.DISCO_ITEMS}"] item`, stanza).forEach(item => {
                    if (item.getAttribute("node")) {
                        // XXX: Ignore nodes for now.
                        // See: https://xmpp.org/extensions/xep-0030.html#items-nodes
                        return;
                    }
                    const jid = item.getAttribute('jid');
                    if (this.items.get(jid) === undefined) {
                        const entity = _converse.disco_entities.get(jid);
                        if (entity) {
                            this.items.add(entity);
                        } else {
                            this.items.create({'jid': jid});
                        }
                    }
                });
            },

            async queryForItems () {
                if (_.isEmpty(this.identities.where({'category': 'server'}))) {
                    // Don't fetch features and items if this is not a
                    // server or a conference component.
                    return;
                }
                const stanza = await _converse.api.disco.items(this.get('jid'));
                this.onDiscoItems(stanza);
            },

            onInfo (stanza) {
                Array.from(stanza.querySelectorAll('identity')).forEach(identity => {
                    this.identities.create({
                        'category': identity.getAttribute('category'),
                        'type': identity.getAttribute('type'),
                        'name': identity.getAttribute('name')
                    });
                });

                sizzle(`x[type="result"][xmlns="${Strophe.NS.XFORM}"]`, stanza).forEach(form => {
                    const data = {};
                    sizzle('field', form).forEach(field => {
                        data[field.getAttribute('var')] = {
                            'value': _.get(field.querySelector('value'), 'textContent'),
                            'type': field.getAttribute('type')
                        };
                    });
                    this.dataforms.create(data);
                });

                if (stanza.querySelector(`feature[var="${Strophe.NS.DISCO_ITEMS}"]`)) {
                    this.queryForItems();
                }
                _.forEach(stanza.querySelectorAll('feature'), feature => {
                    this.features.create({
                        'var': feature.getAttribute('var'),
                        'from': stanza.getAttribute('from')
                    });
                });

                // XEP-0128 Service Discovery Extensions
                sizzle('x[type="result"][xmlns="jabber:x:data"] field', stanza).forEach(field => {
                    this.fields.create({
                        'var': field.getAttribute('var'),
                        'value': _.get(field.querySelector('value'), 'textContent'),
                        'from': stanza.getAttribute('from')
                    });
                });

                this.waitUntilFeaturesDiscovered.resolve(this);
                this.trigger('featuresDiscovered');
            }
        });

        _converse.DiscoEntities = _converse.Collection.extend({
            model: _converse.DiscoEntity,

            fetchEntities () {
                return new Promise((resolve, reject) => {
                    this.fetch({
                        add: true,
                        success: resolve,
                        error () {
                            reject (new Error("Could not fetch disco entities"));
                        }
                    });
                });
            }
        });

        function addClientFeatures () {
            // See https://xmpp.org/registrar/disco-categories.html
            _converse.api.disco.own.identities.add('client', 'web', 'Converse');

            _converse.api.disco.own.features.add(Strophe.NS.CHATSTATES);
            _converse.api.disco.own.features.add(Strophe.NS.DISCO_INFO);
            _converse.api.disco.own.features.add(Strophe.NS.ROSTERX); // Limited support
            if (_converse.message_carbons) {
                _converse.api.disco.own.features.add(Strophe.NS.CARBONS);
            }
            /**
             * Triggered in converse-disco once the core disco features of
             * Converse have been added.
             * @event _converse#addClientFeatures
             * @example _converse.api.listen.on('addClientFeatures', () => { ... });
             */
            _converse.api.trigger('addClientFeatures');
            return this;
        }

        function initStreamFeatures () {
            const bare_jid = Strophe.getBareJidFromJid(_converse.jid);
            const id = `converse.stream-features-${bare_jid}`;
            if (!_converse.stream_features || _converse.stream_features.browserStorage.id !== id) {
                _converse.stream_features = new _converse.Collection();
                _converse.stream_features.browserStorage = new BrowserStorage.session(id);
                _converse.stream_features.fetch({
                    success (collection) {
                        if (collection.length === 0 && _converse.connection.features) {
                            Array.from(_converse.connection.features.childNodes)
                                .forEach(feature => {
                                    _converse.stream_features.create({
                                        'name': feature.nodeName,
                                        'xmlns': feature.getAttribute('xmlns')
                                    });
                                });
                        }
                        /**
                         * Triggered as soon as Converse has processed the stream features as advertised by
                         * the server. If you want to check whether a stream feature is supported before
                         * proceeding, then you'll first want to wait for this event.
                         * @event _converse#streamFeaturesAdded
                         * @example _converse.api.listen.on('streamFeaturesAdded', () => { ... });
                         */
                        _converse.api.trigger('streamFeaturesAdded');
                    }
                });
            }
        }

        const plugin = this;
        plugin._identities = [];
        plugin._features = [];

        function onDiscoInfoRequest (stanza) {
            const node = stanza.getElementsByTagName('query')[0].getAttribute('node');
            const attrs = {xmlns: Strophe.NS.DISCO_INFO};
            if (node) { attrs.node = node; }

            const iqresult = $iq({'type': 'result', 'id': stanza.getAttribute('id')});
            const from = stanza.getAttribute('from');
            if (from !== null) {
                iqresult.attrs({'to': from});
            }
            iqresult.c('query', attrs);
            plugin._identities.forEach(identity => {
                const attrs = {
                    'category': identity.category,
                    'type': identity.type
                };
                if (identity.name) {
                    attrs.name = identity.name;
                }
                if (identity.lang) {
                    attrs['xml:lang'] = identity.lang;
                }
                iqresult.c('identity', attrs).up();
            });
            plugin._features.forEach(feature => iqresult.c('feature', {'var': feature}).up());
            _converse.api.send(iqresult.tree());
            return true;
        }


        async function initializeDisco () {
            addClientFeatures();
            _converse.connection.addHandler(onDiscoInfoRequest, Strophe.NS.DISCO_INFO, 'iq', 'get', null, null);

            _converse.disco_entities = new _converse.DiscoEntities();
            _converse.disco_entities.browserStorage = new BrowserStorage.session(
                `converse.disco-entities-${_converse.bare_jid}`
            );

            const collection = await _converse.disco_entities.fetchEntities();
            if (collection.length === 0 || !collection.get(_converse.domain)) {
                // If we don't have an entity for our own XMPP server,
                // create one.
                _converse.disco_entities.create({'jid': _converse.domain});
            }
            /**
             * Triggered once the `converse-disco` plugin has been initialized and the
             * `_converse.disco_entities` collection will be available and populated with at
             * least the service discovery features of the user's own server.
             * @event _converse#discoInitialized
             * @example _converse.api.listen.on('discoInitialized', () => { ... });
             */
            _converse.api.trigger('discoInitialized');
        }

        /******************** Event Handlers ********************/

        _converse.api.listen.on('userSessionInitialized', initStreamFeatures);
        _converse.api.listen.on('beforeResourceBinding', initStreamFeatures);

        _converse.api.listen.on('reconnected', initializeDisco);
        _converse.api.listen.on('connected', initializeDisco);

        _converse.api.listen.on('beforeTearDown', () => {
            if (_converse.stream_features) {
                _converse.stream_features.clearSession();
                delete _converse.stream_features;
            }
        });

        _converse.api.listen.on('clearSession', () => {
            if (_converse.shouldClearCache() && _converse.disco_entities) {
                Array.from(_converse.disco_entities.models).forEach(e => e.features.clearSession());
                Array.from(_converse.disco_entities.models).forEach(e => e.identities.clearSession());
                Array.from(_converse.disco_entities.models).forEach(e => e.dataforms.clearSession());
                Array.from(_converse.disco_entities.models).forEach(e => e.fields.clearSession());
                _converse.disco_entities.clearSession();
                delete _converse.disco_entities;
            }
        });


        /************************ API ************************/

        Object.assign(_converse.api, {
            /**
             * The XEP-0030 service discovery API
             *
             * This API lets you discover information about entities on the
             * XMPP network.
             *
             * @namespace _converse.api.disco
             * @memberOf _converse.api
             */
            disco: {
                /**
                 * @namespace _converse.api.disco.stream
                 * @memberOf _converse.api.disco
                 */
                stream: {
                    /**
                     * @method _converse.api.disco.stream.getFeature
                     * @param {String} name The feature name
                     * @param {String} xmlns The XML namespace
                     * @example _converse.api.disco.stream.getFeature('ver', 'urn:xmpp:features:rosterver')
                     */
                    async getFeature (name, xmlns) {
                        await _converse.api.waitUntil('streamFeaturesAdded');
                        if (!name || !xmlns) {
                            throw new Error("name and xmlns need to be provided when calling disco.stream.getFeature");
                        }
                        if (_converse.stream_features === undefined && !_converse.api.connection.connected()) {
                            // Happens during tests when disco lookups happen asynchronously after teardown.
                            const msg = `Tried to get feature ${name} ${xmlns} but _converse.stream_features has been torn down`;
                            _converse.log(msg, Strophe.LogLevel.WARN);
                            return;
                        }
                        return _converse.stream_features.findWhere({'name': name, 'xmlns': xmlns});
                    }
                },

                /**
                 * @namespace _converse.api.disco.own
                 * @memberOf _converse.api.disco
                 */
                own: {
                    /**
                     * @namespace _converse.api.disco.own.identities
                     * @memberOf _converse.api.disco.own
                     */
                    identities: {
                        /**
                         * Lets you add new identities for this client (i.e. instance of Converse)
                         * @method _converse.api.disco.own.identities.add
                         *
                         * @param {String} category - server, client, gateway, directory, etc.
                         * @param {String} type - phone, pc, web, etc.
                         * @param {String} name - "Converse"
                         * @param {String} lang - en, el, de, etc.
                         *
                         * @example _converse.api.disco.own.identities.clear();
                         */
                        add (category, type, name, lang) {
                            for (var i=0; i<plugin._identities.length; i++) {
                                if (plugin._identities[i].category == category &&
                                    plugin._identities[i].type == type &&
                                    plugin._identities[i].name == name &&
                                    plugin._identities[i].lang == lang) {
                                    return false;
                                }
                            }
                            plugin._identities.push({category: category, type: type, name: name, lang: lang});
                        },
                        /**
                         * Clears all previously registered identities.
                         * @method _converse.api.disco.own.identities.clear
                         * @example _converse.api.disco.own.identities.clear();
                         */
                        clear () {
                            plugin._identities = []
                        },
                        /**
                         * Returns all of the identities registered for this client
                         * (i.e. instance of Converse).
                         * @method _converse.api.disco.identities.get
                         * @example const identities = _converse.api.disco.own.identities.get();
                         */
                        get () {
                            return plugin._identities;
                        }
                    },

                    /**
                     * @namespace _converse.api.disco.own.features
                     * @memberOf _converse.api.disco.own
                     */
                    features: {
                        /**
                         * Lets you register new disco features for this client (i.e. instance of Converse)
                         * @method _converse.api.disco.own.features.add
                         * @param {String} name - e.g. http://jabber.org/protocol/caps
                         * @example _converse.api.disco.own.features.add("http://jabber.org/protocol/caps");
                         */
                        add (name) {
                            for (var i=0; i<plugin._features.length; i++) {
                                if (plugin._features[i] == name) { return false; }
                            }
                            plugin._features.push(name);
                        },
                        /**
                         * Clears all previously registered features.
                         * @method _converse.api.disco.own.features.clear
                         * @example _converse.api.disco.own.features.clear();
                         */
                        clear () {
                            plugin._features = []
                        },
                        /**
                         * Returns all of the features registered for this client (i.e. instance of Converse).
                         * @method _converse.api.disco.own.features.get
                         * @example const features = _converse.api.disco.own.features.get();
                         */
                        get () {
                            return plugin._features;
                        }
                    }
                },

                /**
                 * Query for information about an XMPP entity
                 *
                 * @method _converse.api.disco.info
                 * @param {string} jid The Jabber ID of the entity to query
                 * @param {string} [node] A specific node identifier associated with the JID
                 * @returns {promise} Promise which resolves once we have a result from the server.
                 */
                info (jid, node) {
                    const attrs = {xmlns: Strophe.NS.DISCO_INFO};
                    if (node) {
                        attrs.node = node;
                    }
                    const info = $iq({
                        'from': _converse.connection.jid,
                        'to':jid,
                        'type':'get'
                    }).c('query', attrs);
                    return _converse.api.sendIQ(info);
                },

                /**
                 * Query for items associated with an XMPP entity
                 *
                 * @method _converse.api.disco.items
                 * @param {string} jid The Jabber ID of the entity to query for items
                 * @param {string} [node] A specific node identifier associated with the JID
                 * @returns {promise} Promise which resolves once we have a result from the server.
                 */
                items (jid, node) {
                    const attrs = {'xmlns': Strophe.NS.DISCO_ITEMS};
                    if (node) {
                        attrs.node = node;
                    }
                    return _converse.api.sendIQ(
                        $iq({
                            'from': _converse.connection.jid,
                            'to':jid,
                            'type':'get'
                        }).c('query', attrs)
                    );
                },

                /**
                 * Namespace for methods associated with disco entities
                 *
                 * @namespace _converse.api.disco.entities
                 * @memberOf _converse.api.disco
                 */
                entities: {
                    /**
                     * Get the corresponding `DiscoEntity` instance.
                     *
                     * @method _converse.api.disco.entities.get
                     * @param {string} jid The Jabber ID of the entity
                     * @param {boolean} [create] Whether the entity should be created if it doesn't exist.
                     * @example _converse.api.disco.entities.get(jid);
                     */
                    async get (jid, create=false) {
                        await _converse.api.waitUntil('discoInitialized');
                        if (!jid) {
                            return _converse.disco_entities;
                        }
                        if (_converse.disco_entities === undefined && !_converse.api.connection.connected()) {
                            // Happens during tests when disco lookups happen asynchronously after teardown.
                            const msg = `Tried to look up entity ${jid} but _converse.disco_entities has been torn down`;
                            _converse.log(msg, Strophe.LogLevel.WARN);
                            return;
                        }
                        const entity = _converse.disco_entities.get(jid);
                        if (entity || !create) {
                            return entity;
                        }
                        return _converse.api.disco.entities.create(jid);
                    },

                    /**
                     * Create a new disco entity. It's identity and features
                     * will automatically be fetched from cache or from the
                     * XMPP server.
                     *
                     * Fetching from cache can be disabled by passing in
                     * `ignore_cache: true` in the options parameter.
                     *
                     * @method _converse.api.disco.entities.create
                     * @param {string} jid The Jabber ID of the entity
                     * @param {object} [options] Additional options
                     * @param {boolean} [options.ignore_cache]
                     *     If true, fetch all features from the XMPP server instead of restoring them from cache
                     * @example _converse.api.disco.entities.create(jid, {'ignore_cache': true});
                     */
                    create (jid, options) {
                        return _converse.disco_entities.create({'jid': jid}, options);
                    }
                },

                /**
                 * @namespace _converse.api.disco.features
                 * @memberOf _converse.api.disco
                 */
                features: {
                    /**
                     * Return a given feature of a disco entity
                     *
                     * @method _converse.api.disco.features.get
                     * @param {string} feature The feature that might be
                     *     supported. In the XML stanza, this is the `var`
                     *     attribute of the `<feature>` element. For
                     *     example: `http://jabber.org/protocol/muc`
                     * @param {string} jid The JID of the entity
                     *     (and its associated items) which should be queried
                     * @returns {promise} A promise which resolves with a list containing
                     *     _converse.Entity instances representing the entity
                     *     itself or those items associated with the entity if
                     *     they support the given feature.
                     * @example
                     * _converse.api.disco.features.get(Strophe.NS.MAM, _converse.bare_jid);
                     */
                    async get (feature, jid) {
                        if (!jid) {
                            throw new TypeError('You need to provide an entity JID');
                        }
                        await _converse.api.waitUntil('discoInitialized');
                        let entity = await _converse.api.disco.entities.get(jid, true);

                        if (_converse.disco_entities === undefined && !_converse.api.connection.connected()) {
                            // Happens during tests when disco lookups happen asynchronously after teardown.
                            const msg = `Tried to get feature ${feature} for ${jid} but _converse.disco_entities has been torn down`;
                            _converse.log(msg, Strophe.LogLevel.WARN);
                            return;
                        }
                        entity = await entity.waitUntilFeaturesDiscovered;
                        const promises = _.concat(
                            entity.items.map(item => item.hasFeature(feature)),
                            entity.hasFeature(feature)
                        );
                        const result = await Promise.all(promises);
                        return _.filter(result, _.isObject);
                    }
                },

                /**
                 * Used to determine whether an entity supports a given feature.
                 *
                 * @method _converse.api.disco.supports
                 * @param {string} feature The feature that might be
                 *     supported. In the XML stanza, this is the `var`
                 *     attribute of the `<feature>` element. For
                 *     example: `http://jabber.org/protocol/muc`
                 * @param {string} jid The JID of the entity
                 *     (and its associated items) which should be queried
                 * @returns {promise} A promise which resolves with `true` or `false`.
                 * @example
                 * if (await _converse.api.disco.supports(Strophe.NS.MAM, _converse.bare_jid)) {
                 *     // The feature is supported
                 * } else {
                 *     // The feature is not supported
                 * }
                 */
                async supports (feature, jid) {
                    const features = await _converse.api.disco.features.get(feature, jid);
                    return features.length > 0;
                },

                /**
                 * Refresh the features (and fields and identities) associated with a
                 * disco entity by refetching them from the server
                 *
                 * @method _converse.api.disco.refreshFeatures
                 * @param {string} jid The JID of the entity whose features are refreshed.
                 * @returns {promise} A promise which resolves once the features have been refreshed
                 * @example
                 * await _converse.api.disco.refreshFeatures('room@conference.example.org');
                 */
                async refreshFeatures (jid) {
                    if (!jid) {
                        throw new TypeError('api.disco.refreshFeatures: You need to provide an entity JID');
                    }
                    await _converse.api.waitUntil('discoInitialized');
                    let entity = await _converse.api.disco.entities.get(jid);
                    if (entity) {
                        entity.features.reset();
                        entity.fields.reset();
                        entity.identities.reset();
                        if (!entity.waitUntilFeaturesDiscovered.isPending) {
                            entity.waitUntilFeaturesDiscovered = utils.getResolveablePromise()
                        }
                        entity.queryInfo();
                    } else {
                        // Create it if it doesn't exist
                        entity = await _converse.api.disco.entities.create(jid, {'ignore_cache': true});
                    }
                    return entity.waitUntilFeaturesDiscovered;
                },

                /**
                 * Return all the features associated with a disco entity
                 *
                 * @method _converse.api.disco.getFeatures
                 * @param {string} jid The JID of the entity whose features are returned.
                 * @returns {promise} A promise which resolves with the returned features
                 * @example
                 * const features = await _converse.api.disco.getFeatures('room@conference.example.org');
                 */
                async getFeatures (jid) {
                    if (!jid) {
                        throw new TypeError('api.disco.getFeatures: You need to provide an entity JID');
                    }
                    await _converse.api.waitUntil('discoInitialized');
                    let entity = await _converse.api.disco.entities.get(jid, true);
                    entity = await entity.waitUntilFeaturesDiscovered;
                    return entity.features;
                },

                /**
                 * Return all the service discovery extensions fields
                 * associated with an entity.
                 *
                 * See [XEP-0129: Service Discovery Extensions](https://xmpp.org/extensions/xep-0128.html)
                 *
                 * @method _converse.api.disco.getFields
                 * @param {string} jid The JID of the entity whose fields are returned.
                 * @example
                 * const fields = await _converse.api.disco.getFields('room@conference.example.org');
                 */
                async getFields (jid) {
                    if (!jid) {
                        throw new TypeError('api.disco.getFields: You need to provide an entity JID');
                    }
                    await _converse.api.waitUntil('discoInitialized');
                    let entity = await _converse.api.disco.entities.get(jid, true);
                    entity = await entity.waitUntilFeaturesDiscovered;
                    return entity.fields;
                },

                /**
                 * Get the identity (with the given category and type) for a given disco entity.
                 *
                 * For example, when determining support for PEP (personal eventing protocol), you
                 * want to know whether the user's own JID has an identity with
                 * `category='pubsub'` and `type='pep'` as explained in this section of
                 * XEP-0163: https://xmpp.org/extensions/xep-0163.html#support
                 *
                 * @method _converse.api.disco.getIdentity
                 * @param {string} The identity category.
                 *     In the XML stanza, this is the `category`
                 *     attribute of the `<identity>` element.
                 *     For example: 'pubsub'
                 * @param {string} type The identity type.
                 *     In the XML stanza, this is the `type`
                 *     attribute of the `<identity>` element.
                 *     For example: 'pep'
                 * @param {string} jid The JID of the entity which might have the identity
                 * @returns {promise} A promise which resolves with a map indicating
                 *     whether an identity with a given type is provided by the entity.
                 * @example
                 * _converse.api.disco.getIdentity('pubsub', 'pep', _converse.bare_jid).then(
                 *     function (identity) {
                 *         if (identity) {
                 *             // The entity DOES have this identity
                 *         } else {
                 *             // The entity DOES NOT have this identity
                 *         }
                 *     }
                 * ).catch(e => _converse.log(e, Strophe.LogLevel.FATAL));
                 */
                async getIdentity (category, type, jid) {
                    const e = await _converse.api.disco.entities.get(jid, true);
                    if (e === undefined && !_converse.api.connection.connected()) {
                        // Happens during tests when disco lookups happen asynchronously after teardown.
                        const msg = `Tried to look up category ${category} for ${jid} but _converse.disco_entities has been torn down`;
                        _converse.log(msg, Strophe.LogLevel.WARN);
                        return;
                    }
                    return e.getIdentity(category, type);
                }
            }
        });
    }
});
