// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//

/* This is a Converse.js plugin which add support for XEP-0030: Service Discovery */

/*global Backbone, define, window, document */
(function (root, factory) {
    define(["converse-core", "sizzle", "strophe.disco"], factory);
}(this, function (converse, sizzle) {

    const { Backbone, Promise, Strophe, b64_sha1, _ } = converse.env;

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
                * See XEP-0030: https://xmpp.org/extensions/xep-0030.html
                */
                initialize (settings) {
                    if (_.isNil(settings.jid)) {
                        throw new Error('DiscoEntity must be instantiated with a JID');
                    }
                    this.features = new _converse.Features({'jid': settings.jid});
                }
            });

            _converse.DiscoEntities = Backbone.Collection.extend({
                model: _converse.DiscoEntity,

                initialize () {
                    this.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                        b64_sha1(`converse.disco-entities-${_converse.bare_jid}`)
                    );
                    this.fetchEntities().then(
                        _.partial(_converse.emit, 'discoInitialized'),
                        _.partial(_converse.emit, 'discoInitialized')
                    );
                },

                fetchEntities () {
                    return new Promise((resolve, reject) => {
                        this.fetch({
                            add: true,
                            success: function (collection) {
                                if (collection.length === 0) {
                                    /* The sessionStorage is empty */
                                    // TODO: check for domain in collection even if
                                    // not empty
                                    this.create({
                                        'id': _converse.domain,
                                        'jid': _converse.domain
                                    });
                                }
                                resolve();
                            }.bind(this),
                            error () {
                                reject (new Error("Could not fetch disco entities"));
                            }
                        });
                    });
                }
            });

            _converse.Features = Backbone.Collection.extend({
                /* Service Discovery
                * -----------------
                * This collection stores Feature Models, representing features
                * provided by available XMPP entities (e.g. servers)
                * See XEP-0030 for more details: http://xmpp.org/extensions/xep-0030.html
                * All features are shown here: http://xmpp.org/registrar/disco-features.html
                */
                model: Backbone.Model,

                initialize (settings) {
                    const jid = settings.jid;
                    if (_.isNil(jid)) {
                        throw new Error('DiscoEntity must be instantiated with a JID');
                    }
                    this.addClientIdentities().addClientFeatures();
                    this.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                        b64_sha1(`converse.features-${jid}`)
                    );
                    this.on('add', this.onFeatureAdded, this);
                    this.fetchFeatures(jid);
                },

                fetchFeatures (jid) {
                    if (this.browserStorage.records.length === 0) {
                        // browserStorage is empty, so we've likely never queried this
                        // domain for features yet
                        _converse.connection.disco.info(jid, null, this.onInfo.bind(this));
                        _converse.connection.disco.items(jid, null, this.onItems.bind(this));
                    } else {
                        this.fetch({add:true});
                    }
                },

                onFeatureAdded (feature) {
                    _converse.emit('serviceDiscovered', feature);
                },

                addClientIdentities () {
                    /* See http://xmpp.org/registrar/disco-categories.html
                    */
                    _converse.connection.disco.addIdentity('client', 'web', 'Converse.js');
                    return this;
                },

                addClientFeatures () {
                    /* The strophe.disco.js plugin keeps a list of features which
                    * it will advertise to any #info queries made to it.
                    *
                    * See: http://xmpp.org/extensions/xep-0030.html#info
                    */
                    _converse.connection.disco.addFeature(Strophe.NS.BOSH);
                    _converse.connection.disco.addFeature(Strophe.NS.CHATSTATES);
                    _converse.connection.disco.addFeature(Strophe.NS.DISCO_INFO);
                    _converse.connection.disco.addFeature(Strophe.NS.ROSTERX); // Limited support
                    if (_converse.message_carbons) {
                        _converse.connection.disco.addFeature(Strophe.NS.CARBONS);
                    }
                    _converse.emit('addClientFeatures');
                    return this;
                },

                onItems (stanza) {
                    _.each(stanza.querySelectorAll('query item'), (item) => {
                        _converse.connection.disco.info(
                            item.getAttribute('jid'),
                            null,
                            this.onInfo.bind(this));
                    });
                },

                onInfo (stanza) {
                    if ((sizzle('identity[category=server][type=im]', stanza).length === 0) &&
                        (sizzle('identity[category=conference][type=text]', stanza).length === 0)) {
                        // This isn't an IM server component
                        return;
                    }
                    _.forEach(stanza.querySelectorAll('feature'), (feature) => {
                        const namespace = feature.getAttribute('var');
                        this[namespace] = true;
                        this.create({
                            'var': namespace,
                            'from': stanza.getAttribute('from')
                        });
                    });
                }
            });

            function initializeDisco () {
                _converse.disco_entities = new _converse.DiscoEntities();
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
        }
    });
}));
