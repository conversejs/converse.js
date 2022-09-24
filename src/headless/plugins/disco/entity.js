import log from "@converse/headless/log.js";
import sizzle from "sizzle";
import { Collection } from "@converse/skeletor/src/collection";
import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api, converse } from "@converse/headless/core.js";
import { getOpenPromise } from '@converse/openpromise';

const { Strophe } = converse.env;

/**
 * @class
 * @namespace _converse.DiscoEntity
 * @memberOf _converse
 *
 * A Disco Entity is a JID addressable entity that can be queried for features.
 *
 * See XEP-0030: https://xmpp.org/extensions/xep-0030.html
 */
const DiscoEntity = Model.extend({
    idAttribute: 'jid',

    async initialize (_, options) {
        this.waitUntilFeaturesDiscovered = getOpenPromise();

        this.dataforms = new Collection();
        let id = `converse.dataforms-${this.get('jid')}`;
        this.dataforms.browserStorage = _converse.createStore(id, 'session');

        this.features = new Collection();
        id = `converse.features-${this.get('jid')}`;
        this.features.browserStorage = _converse.createStore(id, 'session');
        this.listenTo(this.features, 'add', this.onFeatureAdded)

        this.fields = new Collection();
        id = `converse.fields-${this.get('jid')}`;
        this.fields.browserStorage = _converse.createStore(id, 'session');
        this.listenTo(this.fields, 'add', this.onFieldAdded)

        this.items = new _converse.DiscoEntities();
        id = `converse.disco-items-${this.get('jid')}`;
        this.items.browserStorage = _converse.createStore(id, 'session');
        await new Promise(f => this.items.fetch({'success': f, 'error': f}));

        this.identities = new Collection();
        id = `converse.identities-${this.get('jid')}`;
        this.identities.browserStorage = _converse.createStore(id, 'session');
        this.fetchFeatures(options);
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
         * @type { Model }
         * @example _converse.api.listen.on('featuresDiscovered', feature => { ... });
         */
        api.trigger('serviceDiscovered', feature);
    },

    onFieldAdded (field) {
        field.entity = this;
        /**
         * Triggered when Converse has learned of a disco extension field.
         * See XEP-0030.
         * @event _converse#discoExtensionFieldDiscovered
         * @example _converse.api.listen.on('discoExtensionFieldDiscovered', () => { ... });
         */
        api.trigger('discoExtensionFieldDiscovered', field);
    },

    async fetchFeatures (options) {
        if (options.ignore_cache) {
            this.queryInfo();
        } else {
            const store_id = this.features.browserStorage.name;
            const result = await this.features.browserStorage.store.getItem(store_id);
            if (result && result.length === 0 || result === null) {
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
        }
    },

    async queryInfo () {
        let stanza;
        try {
            stanza = await api.disco.info(this.get('jid'), null);
        } catch (iq) {
            iq === null ? log.error(`Timeout for disco#info query for ${this.get('jid')}`) : log.error(iq);
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
                const entities = _converse.disco_entities;
                const entity = entities.get(jid) || entities.create({ jid, name: item.getAttribute('name') });
                this.items.create(entity);
            }
        });
    },

    async queryForItems () {
        if (this.identities.where({'category': 'server'}).length === 0) {
            // Don't fetch features and items if this is not a
            // server or a conference component.
            return;
        }
        const stanza = await api.disco.items(this.get('jid'));
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
                    'value': field.querySelector('value')?.textContent,
                    'type': field.getAttribute('type')
                };
            });
            this.dataforms.create(data);
        });

        if (stanza.querySelector(`feature[var="${Strophe.NS.DISCO_ITEMS}"]`)) {
            this.queryForItems();
        }
        Array.from(stanza.querySelectorAll('feature')).forEach(feature => {
            this.features.create({
                'var': feature.getAttribute('var'),
                'from': stanza.getAttribute('from')
            });
        });

        // XEP-0128 Service Discovery Extensions
        sizzle('x[type="result"][xmlns="jabber:x:data"] field', stanza).forEach(field => {
            this.fields.create({
                'var': field.getAttribute('var'),
                'value': field.querySelector('value')?.textContent,
                'from': stanza.getAttribute('from')
            });
        });

        this.waitUntilFeaturesDiscovered.resolve(this);
        this.trigger('featuresDiscovered');
    }
});

export default DiscoEntity;
