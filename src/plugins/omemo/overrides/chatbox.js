import { _converse } from '@converse/headless/core';

const ChatBox = {
    async sendMessage (text, spoiler_hint) {
        if (this.get('omemo_active') && text) {
            const attrs = this.getOutgoingMessageAttributes(text, spoiler_hint);
            attrs['is_encrypted'] = true;
            attrs['plaintext'] = attrs.message;
            let message, stanza;
            try {
                const devices = await _converse.getBundlesAndBuildSessions(this);
                message = await this.createMessage(attrs);
                stanza = await _converse.createOMEMOMessageStanza(this, message, devices);
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
