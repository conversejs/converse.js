import { Strophe } from 'strophe.js';
import api from '../../shared/api/index.js';
import BaseMessage from '../../shared/message.js';

/**
 * Represents a (non-MUC) message.
 * These can be either `chat`, `normal` or `headline` messages.
 * @namespace _converse.Message
 * @memberOf _converse
 * @example const msg = new Message({'message': 'hello world!'});
 */
class Message extends BaseMessage {
    initialize() {
        super.initialize();
        this.initialized = this.setup();
    }

    async setup() {
        // If `type` changes from `error` to `chat`, we want to set the contact. See #2733
        this.on('change:type', () => this.setContact());

        await this.setContact();
        /**
         * Triggered once a {@link Message} has been created and initialized.
         * @event _converse#messageInitialized
         * @type {Message}
         * @example _converse.api.listen.on('messageInitialized', model => { ... });
         */
        await api.trigger('messageInitialized', this, { synchronous: true });
    }

    setContact() {
        if (['chat', 'normal'].includes(this.get('type'))) {
            return this.setModelContact(Strophe.getBareJidFromJid(this.get('from')));
        }
    }

    getDisplayName() {
        if (this.contact) {
            return this.contact.getDisplayName();
        } else if (this.vcard) {
            return this.vcard.getDisplayName();
        } else {
            return this.get('from');
        }
    }
}

export default Message;
