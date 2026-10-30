import { Collection } from '@converse/skeletor';
import _converse from '../../shared/_converse.js';
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
        const bare_jid = _converse.session.get('bare_jid');
        initStorage(this, `converse.resources-${bare_jid}-${options?.jid}`, 'session');
    }
}

export default Resources;
