import MUCMessage from './message';
import { Collection } from '@converse/skeletor/src/collection';

/**
 * Collection which stores MUC messages
 * @namespace _converse.ChatRoomMessages
 * @memberOf _converse
 */
class MUCMessages extends Collection {

    // eslint-disable-next-line class-methods-use-this
    get comparator () {
        return 'time';
    }

    constructor () {
        super();
        this.model = MUCMessage;
    }
}

export default MUCMessages;
