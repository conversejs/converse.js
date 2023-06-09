import isNaN from "lodash-es/isNaN";
import { Collection } from "@converse/skeletor/src/collection";
import { Model } from '@converse/skeletor/src/model.js';
import { converse } from "@converse/headless/core";
import { initStorage } from '@converse/headless/utils/storage.js';

const { Strophe, dayjs, sizzle } = converse.env;

export const Resource = Model.extend({'idAttribute': 'name'});
export const Resources = Collection.extend({'model': Resource});


export const Presence = Model.extend({
    idAttribute: 'jid',

    defaults: {
        'show': 'offline'
    },

    initialize () {
        this.resources = new Resources();
        const id = `converse.identities-${this.get('jid')}`;
        initStorage(this.resources, id, 'session');

        this.listenTo(this.resources, 'update', this.onResourcesChanged);
        this.listenTo(this.resources, 'change', this.onResourcesChanged);
    },

    onResourcesChanged () {
        const hpr = this.getHighestPriorityResource();
        const show = hpr?.attributes?.show || 'offline';
        if (this.get('show') !== show) {
            this.save({ show });
        }
    },

    /**
     * Return the resource with the highest priority.
     * If multiple resources have the same priority, take the latest one.
     * @private
     */
    getHighestPriorityResource () {
        return this.resources.sortBy(r => `${r.get('priority')}-${r.get('timestamp')}`).reverse()[0];
    },

    /**
     * Adds a new resource and it's associated attributes as taken
     * from the passed in presence stanza.
     * Also updates the presence if the resource has higher priority (and is newer).
     * @private
     * @param { Element } presence: The presence stanza
     */
    addResource (presence) {
        const jid = presence.getAttribute('from');
        const name = Strophe.getResourceFromJid(jid);
        const delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, presence).pop();
        const priority = presence.querySelector('priority')?.textContent;
        const resource = this.resources.get(name);
        const settings = {
            name,
            'priority': isNaN(parseInt(priority, 10)) ? 0 : parseInt(priority, 10),
            'show': presence.querySelector('show')?.textContent ?? 'online',
            'timestamp': delay ? dayjs(delay.getAttribute('stamp')).toISOString() : (new Date()).toISOString()
        };
        if (resource) {
            resource.save(settings);
        } else {
            this.resources.create(settings);
        }
    },

    /**
     * Remove the passed in resource from the resources map.
     * Also redetermines the presence given that there's one less
     * resource.
     * @private
     * @param { string } name: The resource name
     */
    removeResource (name) {
        const resource = this.resources.get(name);
        resource?.destroy();
    }
});


export const Presences = Collection.extend({'model': Presence });
