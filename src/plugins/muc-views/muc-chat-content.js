import { api } from '@converse/headless';
import ChatContent from 'shared/chat/chat-content.js';
import 'shared/chat/message-history.js';

import './styles/muc-chat-content.scss';

export default class MUCChatContent extends ChatContent {
    async initialize() {
        await super.initialize();
        this.listenTo(this.model, 'change:hidden_occupants', () => this.requestUpdate());
        this.listenTo(this.model.occupants, 'change', () => this.requestUpdate());
    }
}

api.elements.define('converse-muc-chat-content', MUCChatContent);
