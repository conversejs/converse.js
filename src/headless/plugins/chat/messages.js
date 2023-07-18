import Message from './message.js';
import { Collection } from '@converse/skeletor/src/collection';

class Messages extends Collection {

    // eslint-disable-next-line class-methods-use-this
    get comparator () {
        return 'time';
    }

    constructor () {
        super();
        this.model = Message;
    }
}

export default Messages;
