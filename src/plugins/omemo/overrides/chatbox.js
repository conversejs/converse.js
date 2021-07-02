import { _converse } from '@converse/headless/core';
import { createOMEMOMessageStanza, getBundlesAndBuildSessions } from '../utils.js';

const ChatBox = {
    async sendMessage (attrs) {
        if (this.get('omemo_active') && attrs?.body) {
            const plaintext = attrs?.body;
            attrs = this.getOutgoingMessageAttributes(attrs);
            attrs['is_encrypted'] = true;
            attrs['plaintext'] = plaintext;
            let message, stanza;
            try {
                const devices = await getBundlesAndBuildSessions(this);
                message = await this.createMessage(attrs);
                stanza = await createOMEMOMessageStanza(this, message, devices);
            } catch (e) {
                this.handleMessageSendError(e);
                return null;
            }
            _converse.api.send(stanza);
            return message;
        } else {
            return this.__super__.sendMessage.apply(this, arguments);
        }
    }
}

export default ChatBox;
