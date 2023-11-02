import MUCMessage from './message';
import { Collection } from '@converse/skeletor';

/**
 * Collection which stores MUC messages
 * @namespace _converse.ChatRoomMessages
 * @memberOf _converse
 */
class MUCMessages extends Collection {

    get comparator () {
        return 'time';
    }

    constructor () {
        super();
        this.model = MUCMessage;
    }
}

export default MUCMessages;
