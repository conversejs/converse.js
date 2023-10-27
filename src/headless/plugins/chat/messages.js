import Message from './message.js';
import { Collection } from '@converse/skeletor/src/collection';

class Messages extends Collection {

    get comparator () {
        return 'time';
    }

    constructor () {
        super();
        this.model = Message;
        this.fetched = null;
        this.chatbox = null;
    }
}

export default Messages;
