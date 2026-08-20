import { Collection } from '@converse/skeletor';
import Resource from './resource.js';
import { initStorage } from '../../utils/storage.js';

/**
 * @extends {Collection<Resource>}
 */
class Resources extends Collection {
    /**
     * Auto-hydrate the persisted resources from storage on construction.
     * @returns {boolean}
     */
    get autoSync() {
        return true;
    }

    /**
     * @param {Resource[]} _models
     * @param {{ jid: string }} [options]
     */
    initialize(_models, options) {
        this.model = Resource;
        // Storage is set here before skeletor's autoSync hydration check.
        initStorage(this, `converse.resources-${options?.jid}`, 'session');
    }
}

export default Resources;
