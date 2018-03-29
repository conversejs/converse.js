// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//

/* This is a Converse.js plugin which add support for XEP-0030: Service Discovery */

/*global Backbone, define, window */
(function (root, factory) {
    define(["converse-core", "sizzle", "strophe.disco"], factory);
}(this, function (converse, sizzle) {

    const { Backbone, Promise, Strophe, b64_sha1, utils, _, f } = converse.env;

    converse.plugins.add('converse-disco', {

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this;

            // Promises exposed by this plugin
            _converse.api.promises.add('discoInitialized');


            _converse.DiscoEntity = Backbone.Model.extend({
                /* A Disco Entity is a JID addressable entity that can be queried
                 * for features.
                 *
                 * See XEP-0030: https://xmpp.org/extensions/xep-0030.html
                 */
                idAttribute: 'jid',

                initialize () {
                    this.waitUntilFeaturesDiscovered = utils.getResolveablePromise();

                    this.features = new Backbone.Collection();
                    this.features.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                        b64_sha1(`converse.features-${this.get('jid')}`)
                    );
                    this.features.on('add', this.onFeatureAdded, this);

                    this.identities = new Backbone.Collection();
                    this.identities.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                        b64_sha1(`converse.identities-${this.get('jid')}`)
                    );
                    this.fetchFeatures();

                    this.items = new _converse.DiscoEntities();
                    this.items.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                        b64_sha1(`converse.disco-items-${this.get('jid')}`)
                    );
                },

                getIdentity (category, type) {
                    /* Returns a Promise which resolves with a map indicating
                     * whether a given identity is provided.
                     *
                     * Parameters:
                     *    (String) category - The identity category
                     *    (String) type - The identity type
                     */
                    const entity = this;
                    return new Promise((resolve, reject) => {
                        function fulfillPromise () {
                            const model = entity.identities.findWhere({
                                'category': category,
                                'type': type
                            });
                            resolve(model);
                        }
                        entity.waitUntilFeaturesDiscovered
                            .then(fulfillPromise)
                            .catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                    });
                },

                hasFeature (feature) {
                    /* Returns a Promise which resolves with a map indicating
                     * whether a given feature is supported.
                     *
                     * Parameters:
                     *    (String) feature - The feature that might be supported.
                     */
                    const entity = this;
                    return new Promise((resolve, reject) => {
                        function fulfillPromise () {
                            if (entity.features.findWhere({'var': feature})) {
                                resolve(entity);
                            } else {
                                resolve();
                            }
                        }
                        entity.waitUntilFeaturesDiscovered
                            .then(fulfillPromise)
                            .catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                    });
                },

                onFeatureAdded (feature) {
                    feature.entity = this;
                    _converse.emit('serviceDiscovered', feature);
                },

                fetchFeatures () {
                    if (this.features.browserStorage.records.length === 0) {
                        this.queryInfo();
                    } else {
                        this.features.fetch({
                            add: true,
                            success: () => {
                                this.waitUntilFeaturesDiscovered.resolve();
                                this.trigger('featuresDiscovered');
                            }
                        });
                        this.identities.fetch({add: true});
                    }
                },

                queryInfo () {
                    _converse.connection.disco.info(this.get('jid'), null, this.onInfo.bind(this));
                },

                onDiscoItems (stanza) {
                    _.each(stanza.querySelectorAll('query item'), (item) => {
                        if (item.getAttribute("node")) {
                            // XXX: ignore nodes for now.
                            // See: https://xmpp.org/extensions/xep-0030.html#items-nodes
                            return;
                        }
                        const jid = item.getAttribute('jid');
                        if (_.isUndefined(this.items.get(jid))) {
                            this.items.create({'jid': jid});
                        }
                    });
                },

                queryForItems () {
                    if (_.isEmpty(this.identities.where({'category': 'server'}))) {
                        // Don't fetch features and items if this is not a
                        // server or a conference component.
                        return;
                    }
                    _converse.connection.disco.items(this.get('jid'), null, this.onDiscoItems.bind(this));
                },

                onInfo (stanza) {
                    _.forEach(stanza.querySelectorAll('identity'), (identity) => {
                        this.identities.create({
                            'category': identity.getAttribute('category'),
                            'type': identity.getAttribute('type'),
                            'name': identity.getAttribute('name')
                        });
                    });
                    if (stanza.querySelector('feature[var="'+Strophe.NS.DISCO_ITEMS+'"]')) {
                        this.queryForItems();
                    }
                    _.forEach(stanza.querySelectorAll('feature'), (feature) => {
                        this.features.create({
                            'var': feature.getAttribute('var'),
                            'from': stanza.getAttribute('from')
                        });
                    });
                    this.waitUntilFeaturesDiscovered.resolve();
                    this.trigger('featuresDiscovered');
                }
            });

            _converse.DiscoEntities = Backbone.Collection.extend({
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
                /* The strophe.disco.js plugin keeps a list of features which
                 * it will advertise to any #info queries made to it.
                 *
                 * See: http://xmpp.org/extensions/xep-0030.html#info
                 */

                // See http://xmpp.org/registrar/disco-categories.html
                _converse.connection.disco.addIdentity('client', 'web', 'Converse.js');

                _converse.connection.disco.addFeature(Strophe.NS.BOSH);
                _converse.connection.disco.addFeature(Strophe.NS.CHATSTATES);
                _converse.connection.disco.addFeature(Strophe.NS.DISCO_INFO);
                _converse.connection.disco.addFeature(Strophe.NS.ROSTERX); // Limited support
                if (_converse.message_carbons) {
                    _converse.connection.disco.addFeature(Strophe.NS.CARBONS);
                }
                _converse.emit('addClientFeatures');
                return this;
            }

            function initializeDisco () {
                addClientFeatures();
                _converse.disco_entities = new _converse.DiscoEntities();
                _converse.disco_entities.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                    b64_sha1(`converse.disco-entities-${_converse.bare_jid}`)
                );

                _converse.disco_entities.fetchEntities().then((collection) => {
                    if (collection.length === 0 || !collection.get(_converse.domain)) {
                        // If we don't have an entity for our own XMPP server,
                        // create one.
                        _converse.disco_entities.create({'jid': _converse.domain});
                    }
                    _converse.emit('discoInitialized');
                }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
            }
            _converse.api.listen.on('reconnected', initializeDisco);
            _converse.api.listen.on('connected', initializeDisco);

            _converse.api.listen.on('beforeTearDown', () => {
                if (_converse.disco_entities) {
                    _converse.disco_entities.each((entity) => {
                        entity.features.reset();
                        entity.features.browserStorage._clear();
                    });
                    _converse.disco_entities.reset();
                    _converse.disco_entities.browserStorage._clear();
                }
            });

            /* We extend the default converse.js API to add methods specific to service discovery */
            _.extend(_converse.api, {
                'disco': {
                    'entities': {
                        'get' (entity_jid, create=false) {
                            return _converse.api.waitUntil('discoInitialized').then(() => {
                                if (_.isNil(entity_jid)) {
                                    return _converse.disco_entities;
                                }
                                const entity = _converse.disco_entities.get(entity_jid);
                                if (entity || !create) {
                                    return entity;
                                }
                                return _converse.disco_entities.create({'jid': entity_jid});
                            });
                        }
                    },

                    'supports' (feature, entity_jid) {
                        /* Returns a Promise which resolves with a list containing
                         * _converse.Entity instances representing the entity
                         * itself or those items associated with the entity if
                         * they support the given feature.
                         *
                         * Parameters:
                         *    (String) feature - The feature that might be
                         *         supported. In the XML stanza, this is the `var`
                         *         attribute of the `<feature>` element. For
                         *         example: 'http://jabber.org/protocol/muc'
                         *    (String) entity_jid - The JID of the entity
                         *         (and its associated items) which should be queried
                         */
                        if (_.isNil(entity_jid)) {
                            throw new TypeError('disco.supports: You need to provide an entity JID');
                        }
                        return _converse.api.waitUntil('discoInitialized').then((entity) => {
                            return new Promise((resolve, reject) => {
                                _converse.api.disco.entities.get(entity_jid, true).then((entity) => {
                                    Promise.all(
                                        _.concat(
                                            entity.items.map((item) => item.hasFeature(feature)),
                                            entity.hasFeature(feature)
                                        )
                                    ).then((result) => {
                                        resolve(f.filter(f.isObject, result));
                                    }).catch(reject);
                                })
                            });
                        }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                    },

                    'getIdentity' (category, type, entity_jid) {
                        /* Returns a Promise which resolves with a map indicating
                         * whether an identity with a given type is provided by
                         * the entity.
                         *
                         * Parameters:
                         *    (String) category - The identity category.
                         *          In the XML stanza, this is the `category`
                         *          attribute of the `<identity>` element.
                         *          For example: 'pubsub'
                         *    (String) type - The identity type.
                         *          In the XML stanza, this is the `type`
                         *          attribute of the `<identity>` element.
                         *          For example: 'pep'
                         *    (String) entity_jid - The JID of the entity which might have the identity
                         */
                        return new Promise((resolve, reject) => {
                            _converse.api.waitUntil('discoInitialized').then(() => {
                                _converse.api.disco.entities.get(entity_jid, true)
                                    .then((entity) => resolve(entity.getIdentity(category, type)));
                            })
                        }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                    }
                }
            });
        }
    });
}));
