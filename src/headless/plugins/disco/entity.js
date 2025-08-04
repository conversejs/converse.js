import { Collection, Model } from '@converse/skeletor';
import { getOpenPromise } from '@converse/openpromise';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { parseErrorStanza } from '../../shared/parsers.js';
import log from '@converse/log';
import sizzle from 'sizzle';
import { createStore } from '../../utils/storage.js';

const { Strophe, u } = converse.env;

/**
 * @class
 * @namespace _converse.DiscoEntity
 * @memberOf _converse
 *
 * A Disco Entity is a JID addressable entity that can be queried for features.
 *
 * See XEP-0030: https://xmpp.org/extensions/xep-0030.html
 */
class DiscoEntity extends Model {
    get idAttribute() {
        return 'jid';
    }

    initialize(_, options) {
        super.initialize();
        this.waitUntilFeaturesDiscovered = getOpenPromise();
        this.waitUntilItemsFetched = getOpenPromise();

        this.dataforms = new Collection();
        let id = `converse.dataforms-${this.get('jid')}`;
        this.dataforms.browserStorage = createStore(id, 'session');

        this.features = new Collection();
        id = `converse.features-${this.get('jid')}`;
        this.features.browserStorage = createStore(id, 'session');
        this.listenTo(this.features, 'add', this.onFeatureAdded);

        this.fields = new Collection();
        id = `converse.fields-${this.get('jid')}`;
        this.fields.browserStorage = createStore(id, 'session');
        this.listenTo(this.fields, 'add', this.onFieldAdded);

        this.items = new Collection();
        id = `converse.items-${this.get('jid')}`;
        this.items.browserStorage = createStore(id, 'session');

        this.identities = new Collection();
        id = `converse.identities-${this.get('jid')}`;
        this.identities.browserStorage = createStore(id, 'session');

        this.fetchFeatures(options);
    }

    /**
     * Returns a Promise which resolves with a map indicating
     * whether a given identity is provided by this entity.
     * @method _converse.DiscoEntity#getIdentity
     * @param {String} category - The identity category
     * @param {String} type - The identity type
     */
    async getIdentity(category, type) {
        await this.waitUntilItemsFetched;
        return this.identities.findWhere({ category, type });
    }

    /**
     * Returns a Promise which resolves with a map indicating
     * whether a given feature is supported.
     * @method _converse.DiscoEntity#getFeature
     * @param {String} feature - The feature that might be supported.
     */
    async getFeature(feature) {
        await this.waitUntilFeaturesDiscovered;
        if (this.features.findWhere({ var: feature })) {
            return this;
        }
    }

    onFeatureAdded(feature) {
        feature.entity = this;
        /**
         * Triggered when Converse has learned of a service provided by the XMPP server.
         * See XEP-0030.
         * @event _converse#serviceDiscovered
         * @type { Model }
         * @example _converse.api.listen.on('featuresDiscovered', feature => { ... });
         */
        api.trigger('serviceDiscovered', feature);
    }

    onFieldAdded(field) {
        field.entity = this;
        /**
         * Triggered when Converse has learned of a disco extension field.
         * See XEP-0030.
         * @event _converse#discoExtensionFieldDiscovered
         * @example _converse.api.listen.on('discoExtensionFieldDiscovered', () => { ... });
         */
        api.trigger('discoExtensionFieldDiscovered', field);
    }

    /**
     * @param {import('./types').FetchEntityFeaturesOptions} options
     */
    async fetchFeatures(options) {
        if (options.ignore_cache) {
            await this.queryInfo(options);
        } else {
            const store_id = this.features.browserStorage.name;

            // Checking only whether features have been cached, even though
            // there are other things that should be cached as well. We assume
            // that if features have been cached, everything else has been also.
            const result = await this.features.browserStorage.store.getItem(store_id);
            if ((result && result.length === 0) || result === null) {
                await this.queryInfo();
            } else {
                await new Promise((resolve) => this.fetch({ success: resolve, error: resolve }));

                await new Promise((resolve) =>
                    this.features.fetch({
                        add: true,
                        success: () => {
                            this.waitUntilFeaturesDiscovered.resolve(this);
                            this.trigger('featuresDiscovered');
                            resolve();
                        },
                        error: resolve,
                    })
                );

                await new Promise((resolve) => this.identities.fetch({ add: true, success: resolve, error: resolve }));

                const items = this.get('items');
                if (Array.isArray(items)) {
                    await Promise.all(
                        items.map(/** @param {string} jid */ async (jid) => await api.disco.entities.get(jid, true))
                    );
                } else {
                    await this.queryForItems();
                }
                this.waitUntilItemsFetched.resolve();
            }
        }
    }

    /**
     * @param {import('./types').DiscoInfoOptions} [options]
     */
    async queryInfo(options) {
        let stanza;
        try {
            stanza = await api.disco.info(this.get('jid'), null, options);
        } catch (iq) {
            if (u.isElement(iq)) {
                const e = await parseErrorStanza(iq);
                if (e.message !== 'item-not-found') {
                    log.error(`Error querying disco#info for ${this.get('jid')}: ${e.message}`);
                }
                this.save({ error: e.message });
                this.waitUntilFeaturesDiscovered.resolve(e);
                this.waitUntilItemsFetched.resolve(e);
            } else {
                if (iq === null) {
                    log.error(`Timeout for disco#info query for ${this.get('jid')}`);
                } else {
                    log.error(`Error querying disco#info for ${this.get('jid')}: ${iq}`);
                }
                this.waitUntilFeaturesDiscovered.resolve(iq);
                this.waitUntilItemsFetched.resolve(iq);
            }
            return;
        }
        this.onInfo(stanza);
    }

    /**
     * @param {Element} stanza
     */
    onDiscoItems(stanza) {
        const item_els = sizzle(`query[xmlns="${Strophe.NS.DISCO_ITEMS}"] item`, stanza);
        const item_jids = [];
        item_els.forEach((item) => {
            if (item.getAttribute('node')) {
                // XXX: Ignore nodes for now.
                // See: https://xmpp.org/extensions/xep-0030.html#items-nodes
                return;
            }
            const jid = item.getAttribute('jid');
            let entity = _converse.state.disco_entities.get(jid);
            if (entity) {
                const parent_jids = entity.get('parent_jids');
                entity.set({ parent_jids: [...parent_jids, this.get('jid')] });
            } else {
                entity = api.disco.entities.create({
                    jid,
                    parent_jids: [this.get('jid')],
                    name: item.getAttribute('name'),
                });
            }
            item_jids.push(entity.get('jid'));
        });
        this.save({ items: item_jids });
    }

    async queryForItems() {
        if (this.identities.where({ category: 'server' }).length === 0) {
            // Don't fetch features and items if this is not a
            // server or a conference component.
            return;
        }
        const stanza = await api.disco.items(this.get('jid'));
        this.onDiscoItems(stanza);
    }

    /**
     * @param {Element} stanza
     */
    async onInfo(stanza) {
        Array.from(stanza.querySelectorAll('identity')).forEach((identity) => {
            this.identities.create({
                category: identity.getAttribute('category'),
                type: identity.getAttribute('type'),
                name: identity.getAttribute('name'),
            });
        });

        sizzle(`x[type="result"][xmlns="${Strophe.NS.XFORM}"]`, stanza).forEach((form) => {
            const data = {};
            sizzle('field', form).forEach((field) => {
                data[field.getAttribute('var')] = {
                    'value': field.querySelector('value')?.textContent,
                    'type': field.getAttribute('type'),
                };
            });
            this.dataforms.create(data);
        });

        if (stanza.querySelector(`feature[var="${Strophe.NS.DISCO_ITEMS}"]`)) {
            await this.queryForItems();
        }
        this.waitUntilItemsFetched.resolve();

        Array.from(stanza.querySelectorAll('feature')).forEach((feature) => {
            this.features.create({
                'var': feature.getAttribute('var'),
                'from': stanza.getAttribute('from'),
            });
        });

        // XEP-0128 Service Discovery Extensions
        sizzle('x[type="result"][xmlns="jabber:x:data"] field', stanza).forEach((field) => {
            this.fields.create({
                'var': field.getAttribute('var'),
                'value': field.querySelector('value')?.textContent,
                'from': stanza.getAttribute('from'),
            });
        });

        this.waitUntilFeaturesDiscovered.resolve(this);
        this.trigger('featuresDiscovered');
    }
}

export default DiscoEntity;
