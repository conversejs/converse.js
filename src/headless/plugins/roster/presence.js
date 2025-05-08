import Resources from './resources.js';
import { Model } from '@converse/skeletor';
import converse from '../../shared/api/public.js';
import { initStorage } from '../../utils/storage.js';

const { Strophe, dayjs, sizzle } = converse.env;

class Presence extends Model {
    get idAttribute() {
        // eslint-disable-line class-methods-use-this
        return 'jid';
    }

    defaults() {
        // eslint-disable-line class-methods-use-this
        return {
            'show': 'offline',
        };
    }

    initialize() {
        super.initialize();
        this.resources = new Resources();
        const id = `converse.identities-${this.get('jid')}`;
        initStorage(this.resources, id, 'session');

        this.listenTo(this.resources, 'update', this.onResourcesChanged);
        this.listenTo(this.resources, 'change', this.onResourcesChanged);
    }

    onResourcesChanged() {
        const hpr = this.getHighestPriorityResource();
        const show = hpr?.attributes?.show || 'offline';
        if (this.get('show') !== show) {
            this.save({ show });
        }
    }

    /**
     * Return the resource with the highest priority.
     * If multiple resources have the same priority, take the latest one.
     * @private
     */
    getHighestPriorityResource() {
        return this.resources.sortBy((r) => `${r.get('priority')}-${r.get('timestamp')}`).reverse()[0];
    }

    /**
     * Adds a new resource and it's associated attributes as taken
     * from the passed in presence stanza.
     * Also updates the presence if the resource has higher priority (and is newer).
     * @param { Element } presence: The presence stanza
     */
    addResource(presence) {
        const jid = presence.getAttribute('from');
        const name = Strophe.getResourceFromJid(jid);
        const delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, presence).pop();
        const priority = presence.querySelector('priority')?.textContent;
        const resource = this.resources.get(name);
        const settings = {
            name,
            'priority': Number.isNaN(parseInt(priority, 10)) ? 0 : parseInt(priority, 10),
            'show': presence.querySelector('show')?.textContent ?? 'online',
            'timestamp': delay ? dayjs(delay.getAttribute('stamp')).toISOString() : new Date().toISOString(),
        };
        if (resource) {
            resource.save(settings);
        } else {
            this.resources.create(settings);
        }
    }

    /**
     * Remove the passed in resource from the resources map.
     * Also redetermines the presence given that there's one less
     * resource.
     * @param { string } name: The resource name
     */
    removeResource(name) {
        const resource = this.resources.get(name);
        resource?.destroy();
    }
}

export default Presence;
