import Message from './message.js';
import { Collection } from '@converse/skeletor';

class Messages extends Collection {

    constructor () {
        super();
        this.comparator = 'time';
        this.model = Message;
        this.fetched = null;
        this.chatbox = null;
    }
}

export default Messages;
