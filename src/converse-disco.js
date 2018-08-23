// Converse.js
// http://conversejs.org
//
// Copyright (c) 2013-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

/* This is a Converse.js plugin which add support for XEP-0030: Service Discovery */

/*global Backbone, define, window */
(function (root, factory) {
    define(["converse-core", "sizzle"], factory);
}(this, function (converse, sizzle) {

    const { Backbone, Promise, Strophe, $iq, b64_sha1, utils, _, f } = converse.env;

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

                    this.dataforms = new Backbone.Collection();
                    this.dataforms.browserStorage = new Backbone.BrowserStorage.session(
                        b64_sha1(`converse.dataforms-{this.get('jid')}`)
                    );

                    this.features = new Backbone.Collection();
                    this.features.browserStorage = new Backbone.BrowserStorage.session(
                        b64_sha1(`converse.features-${this.get('jid')}`)
                    );
                    this.features.on('add', this.onFeatureAdded, this);

                    this.identities = new Backbone.Collection();
                    this.identities.browserStorage = new Backbone.BrowserStorage.session(
                        b64_sha1(`converse.identities-${this.get('jid')}`)
                    );
                    this.fetchFeatures();

                    this.items = new _converse.DiscoEntities();
                    this.items.browserStorage = new Backbone.BrowserStorage.session(
                        b64_sha1(`converse.disco-items-${this.get('jid')}`)
                    );
                    this.items.fetch();
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
                    _converse.api.disco.info(this.get('jid'), null)
                        .then((stanza) => this.onInfo(stanza))
                        .catch((iq) => {
                            this.waitUntilFeaturesDiscovered.resolve();
                            _converse.log(iq, Strophe.LogLevel.ERROR);
                        });
                },

                onDiscoItems (stanza) {
                    _.each(sizzle(`query[xmlns="${Strophe.NS.DISCO_ITEMS}"] item`, stanza), (item) => {
                        if (item.getAttribute("node")) {
                            // XXX: ignore nodes for now.
                            // See: https://xmpp.org/extensions/xep-0030.html#items-nodes
                            return;
                        }
                        const jid = item.getAttribute('jid');
                        if (_.isUndefined(this.items.get(jid))) {
                            const entity = _converse.disco_entities.get(jid);
                            if (entity) {
                                this.items.add(entity);
                            } else {
                                this.items.create({'jid': jid});
                            }
                        }
                    });
                },

                queryForItems () {
                    if (_.isEmpty(this.identities.where({'category': 'server'}))) {
                        // Don't fetch features and items if this is not a
                        // server or a conference component.
                        return;
                    }
                    _converse.api.disco.items(this.get('jid'), null, this.onDiscoItems.bind(this));
                },

                onInfo (stanza) {
                    _.forEach(stanza.querySelectorAll('identity'), (identity) => {
                        this.identities.create({
                            'category': identity.getAttribute('category'),
                            'type': identity.getAttribute('type'),
                            'name': identity.getAttribute('name')
                        });
                    });

                    _.each(sizzle(`x[type="result"][xmlns="${Strophe.NS.XFORM}"]`, stanza), (form) => {
                        const data = {};
                        _.each(form.querySelectorAll('field'), (field) => {
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
                // See http://xmpp.org/registrar/disco-categories.html
                _converse.api.disco.own.identities.add('client', 'web', 'Converse.js');

                _converse.api.disco.own.features.add(Strophe.NS.BOSH);
                _converse.api.disco.own.features.add(Strophe.NS.CHATSTATES);
                _converse.api.disco.own.features.add(Strophe.NS.DISCO_INFO);
                _converse.api.disco.own.features.add(Strophe.NS.ROSTERX); // Limited support
                if (_converse.message_carbons) {
                    _converse.api.disco.own.features.add(Strophe.NS.CARBONS);
                }
                _converse.emit('addClientFeatures');
                return this;
            }

            function initStreamFeatures () {
                _converse.stream_features = new Backbone.Collection();
                _converse.stream_features.browserStorage = new Backbone.BrowserStorage.session(
                    b64_sha1(`converse.stream-features-${_converse.bare_jid}`)
                );
                _converse.stream_features.fetch({
                    success (collection) {
                        if (collection.length === 0 && _converse.connection.features) {
                            _.forEach(
                                _converse.connection.features.childNodes,
                                (feature) => {
                                    _converse.stream_features.create({
                                        'name': feature.nodeName,
                                        'xmlns': feature.getAttribute('xmlns')
                                    });
                                });
                        }
                    }
                });
                _converse.emit('streamFeaturesAdded');
            }

            function initializeDisco () {
                addClientFeatures();
                _converse.connection.addHandler(onDiscoInfoRequest, Strophe.NS.DISCO_INFO, 'iq', 'get', null, null);

                _converse.disco_entities = new _converse.DiscoEntities();
                _converse.disco_entities.browserStorage = new Backbone.BrowserStorage.session(
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

            _converse.api.listen.on('sessionInitialized', initStreamFeatures);
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
                _.each(plugin._identities, (identity) => {
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
                _.each(plugin._features, (feature) => {
                    iqresult.c('feature', {'var': feature}).up();
                });
                _converse.connection.send(iqresult.tree());
                return true;
            }

            /* We extend the default converse.js API to add methods specific to service discovery */
            _.extend(_converse.api, {
                /**
                 * The service discovery API
                 * @namespace
                 */
                'disco': {
                    'stream': {
                        'getFeature': function (name, xmlns) {
                            if (_.isNil(name) || _.isNil(xmlns)) {
                                throw new Error("name and xmlns need to be provided when calling disco.stream.getFeature");
                            }
                            return _converse.stream_features.findWhere({'name': name, 'xmlns': xmlns});
                        }
                    },

                    /**
                     * The "own" grouping
                     * @namespace
                     */
                    'own': {
                        /**
                         * The "identities" grouping
                         * @namespace
                         */
                        'identities': {
                            /**
                             * Lets you add new identities for this client (i.e. instance of Converse.js)
                             * @function
                             *
                             * @param {String} category - server, client, gateway, directory, etc.
                             * @param {String} type - phone, pc, web, etc.
                             * @param {String} name - "Converse.js"
                             * @param {String} lang - en, el, de, etc.
                             *
                             * @example
                             * _converse.api.disco.own.identities.clear();
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
                             * @function
                             *
                             * @example
                             * _converse.api.disco.own.identities.clear();
                             */
                            clear () {
                                plugin._identities = []
                            },
                            /**
                             * Returns all of the identities registered for this client
                             * (i.e. instance of Converse.js).
                             * @function
                             *
                             * @example
                             * const identities = _converse.api.disco.own.identities.get();
                             */
                            get () {
                                return plugin._identities;
                            }
                        },
                        /**
                         * The "features" grouping
                         * @namespace
                         */
                        'features': {
                            /**
                             * Lets you register new disco features for this client (i.e. instance of Converse.js)
                             * @function
                             *
                             * @param {String} name - e.g. http://jabber.org/protocol/caps
                             *
                             * @example
                             * _converse.api.disco.own.features.add("http://jabber.org/protocol/caps");
                             */
                            add (name) {
                                for (var i=0; i<plugin._features.length; i++) {
                                    if (plugin._features[i] == name) { return false; }
                                }
                                plugin._features.push(name);
                            },
                            /**
                             * Clears all previously registered features.
                             * @function
                             *
                             * @example
                             * _converse.api.disco.own.features.clear();
                             */
                            clear () {
                                plugin._features = []
                            },
                            /**
                             * Returns all of the features registered for this client
                             * (i.e. instance of Converse.js).
                             * @function
                             *
                             * @example
                             * const features = _converse.api.disco.own.features.get();
                             */
                            get () {
                                return plugin._features;
                            }
                        }
                    },

                    'info' (jid, node) {
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

                    'items' (jid, node, callback, errback, timeout) {
                        const attrs = {'xmlns': Strophe.NS.DISCO_ITEMS};
                        if (node) {
                            attrs.node = node;
                        }
                        const items = $iq({
                            'from': _converse.connection.jid,
                            'to':jid,
                            'type':'get'
                        }).c('query', attrs);
                        _converse.connection.sendIQ(items, callback, errback, timeout);
                    },

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
                        return new Promise((resolve, reject) => {
                            return _converse.api.waitUntil('discoInitialized').then(() => {
                                _converse.api.disco.entities.get(entity_jid, true).then((entity) => {
                                    entity.waitUntilFeaturesDiscovered.then(() => {
                                        const promises = _.concat(
                                            entity.items.map((item) => item.hasFeature(feature)),
                                            entity.hasFeature(feature)
                                        );
                                        Promise.all(promises).then((result) => {
                                            resolve(f.filter(f.isObject, result));
                                        }).catch(reject);
                                    }).catch(reject);
                                }).catch(reject);
                            }).catch(reject);
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
                            _converse.api.disco.entities.get(entity_jid, true)
                                .then((entity) => resolve(entity.getIdentity(category, type)));
                        }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                    }
                }
            });
        }
    });
}));
