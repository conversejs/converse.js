import MUCMessage from './message';
import { Collection } from '@converse/skeletor';

/**
 * Collection which stores MUC messages
 * @extends {Collection<MUCMessage>}
 */
class MUCMessages extends Collection {

    constructor (attrs, options={}) {
        super(attrs, Object.assign({ comparator: 'time' }, options));
        this.model = MUCMessage;
        this.fetched = null;
    }
}

export default MUCMessages;
