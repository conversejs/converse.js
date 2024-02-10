import MUCMessage from './message';
import { Collection } from '@converse/skeletor';

/**
 * Collection which stores MUC messages
 */
class MUCMessages extends Collection {

    constructor (attrs, options={}) {
        super(attrs, Object.assign({ comparator: 'time' }, options));
        this.model = MUCMessage;
    }
}

export default MUCMessages;
