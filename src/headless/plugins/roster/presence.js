import Resources from './resources.js';
import { Model } from '@converse/skeletor';
import { initStorage } from '../../utils/storage.js';
import {parsePresence} from './parsers.js';

/**
 * @extends {Model<import('./types').PresenceAttrs>}
 */
class Presence extends Model {
    get idAttribute() {
        return 'jid';
    }

    defaults() {
        return {
            presence: /** @type {import('./types').PresenceTypes | 'offline'} */('offline'),
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
        const { presence, show } = hpr?.attributes ?? {};
        this.save({ presence, show });
    }

    getStatus() {
        const presence = this.get('presence');
        if (presence === 'offline') {
            return 'offline';
        }
        return this.get('show') || presence || 'offline';
    }

    /**
     * Return the resource with the highest priority.
     * If multiple resources have the same priority, take the latest one.
     */
    getHighestPriorityResource() {
        return this.resources.sortBy((r) => `${r.get('priority')}-${r.get('timestamp')}`).reverse()[0];
    }

    /**
     * Adds a new resource and it's associated attributes as taken
     * from the passed in presence stanza.
     * Also updates the presence if the resource has higher priority (and is newer).
     * @param {Element} presence: The presence stanza
     */
    addResource(presence) {
        const attrs = parsePresence(presence);
        const settings = {
            name: attrs.resource,
            presence: attrs.type === 'unavailable' ? 'offline' : 'online',
            priority: attrs.priority,
            show: attrs.show,
            timestamp: attrs.timestamp,
        };
        const resource = this.resources.get(settings.name);
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
     * @param {string} name: The resource name
     */
    removeResource(name) {
        const resource = this.resources.get(name);
        resource?.destroy();
    }
}

export default Presence;
