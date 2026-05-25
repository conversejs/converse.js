import MUCMessage from './message.js';
import { Collection } from '@converse/skeletor';

/**
 * Collection which stores MUC messages
 * @extends {Collection<MUCMessage>}
 */
class MUCMessages extends Collection {
    /**
     * @param {import('@converse/skeletor').ModelAttributes[]} [models]
     * @param {import('@converse/skeletor').CollectionOptions<MUCMessage>} [options]
     */
    constructor(models, options = {}) {
        super(models, Object.assign({ comparator: 'time' }, options));
        this.model = MUCMessage;
        this.fetched = null;
    }
}

export default MUCMessages;
