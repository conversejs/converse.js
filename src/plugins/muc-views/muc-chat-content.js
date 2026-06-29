import { html } from 'lit';
import { api, constants } from '@converse/headless';
import ChatContent from 'shared/chat/chat-content.js';
import 'shared/chat/message-history.js';
import './empty.js';

import './styles/muc-chat-content.scss';

const { ROOMSTATUS } = constants;

export default class MUCChatContent extends ChatContent {
    async initialize() {
        await super.initialize();
        this.listenTo(this.model, 'change:hidden_occupants', () => this.requestUpdate());
        this.listenTo(this.model.occupants, 'change', () => this.requestUpdate());
        this.listenTo(this.model.session, 'change:connection_status', () => this.requestUpdate());
    }

    render() {
        const content = super.render();
        if (this.model?.session?.get('connection_status') === ROOMSTATUS.ENTERED && this.#hasNoConversation()) {
            return html`${content}<converse-muc-empty .model=${this.model}></converse-muc-empty>`;
        }
        return content;
    }

    /**
     * Whether the room holds no real conversation yet.
     * @returns {boolean}
     */
    #hasNoConversation() {
        return !this.model.messages.models.some((m) => !m.get('is_ephemeral') && m.get('type') !== 'info');
    }
}

api.elements.define('converse-muc-chat-content', MUCChatContent);
