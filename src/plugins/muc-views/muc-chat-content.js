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
        this.listenTo(this.model.session, 'change:mam_initialized', () => this.requestUpdate());
    }

    render() {
        const content = super.render();
        const session = this.model?.session;
        // Only show the empty state once we've entered *and* the initial MAM
        // history fetch has settled — otherwise it flashes while history loads.
        if (
            session?.get('connection_status') === ROOMSTATUS.ENTERED &&
            session.get('mam_initialized') &&
            this.#hasNoConversation()
        ) {
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
