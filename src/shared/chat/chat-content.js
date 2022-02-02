import './message-history';
import tpl_spinner from "templates/spinner.js";
import { CustomElement } from 'shared/components/element.js';
import { api } from '@converse/headless/core';
import { html } from 'lit';
import { markScrolled } from './utils.js';

import './styles/chat-content.scss';


export default class ChatContent extends CustomElement {

    static get properties () {
        return {
            jid: { type: String }
        }
    }

    disconnectedCallback () {
        super.disconnectedCallback();
        this.removeEventListener('scroll', markScrolled);
    }

    async initialize () {
        await this.setModels();
        this.listenTo(this.model, 'change:hidden_occupants', this.requestUpdate);
        this.listenTo(this.model.messages, 'add', this.requestUpdate);
        this.listenTo(this.model.messages, 'change', this.requestUpdate);
        this.listenTo(this.model.messages, 'remove', this.requestUpdate);
        this.listenTo(this.model.messages, 'rendered', this.requestUpdate);
        this.listenTo(this.model.messages, 'reset', this.requestUpdate);
        this.listenTo(this.model.notifications, 'change', this.requestUpdate);
        this.listenTo(this.model.ui, 'change', this.requestUpdate);
        this.listenTo(this.model.ui, 'change:scrolled', this.scrollDown);

        if (this.model.occupants) {
            this.listenTo(this.model.occupants, 'change', this.requestUpdate);
        }
        this.addEventListener('scroll', markScrolled);
    }

    async setModels () {
        this.model = await api.chatboxes.get(this.jid);
        await this.model.initialized;
        this.requestUpdate();
    }

    render () {
        if (!this.model) {
            return '';
        }
        // This element has "flex-direction: reverse", so elements here are
        // shown in reverse order.
        return html`
            <div class="chat-content__notifications">${this.model.getNotificationsText()}</div>
            <converse-message-history
                .model=${this.model}
                .messages=${[...this.model.messages.models]}>
            </converse-message-history>
            ${ this.model.ui?.get('chat-content-spinner-top') ? tpl_spinner() : '' }
        `;
    }

    scrollDown () {
        if (this.model.ui.get('scrolled')) {
            return;
        }
        if (this.scrollTo) {
            const behavior = this.scrollTop ? 'smooth' : 'auto';
            this.scrollTo({ 'top': 0, behavior });
        } else {
            this.scrollTop = 0;
        }
        /**
         * Triggered once the converse-chat-content element has been scrolled down to the bottom.
         * @event _converse#chatBoxScrolledDown
         * @type {object}
         * @property { _converse.ChatBox | _converse.ChatRoom } chatbox - The chat model
         * @example _converse.api.listen.on('chatBoxScrolledDown', obj => { ... });
         */
        api.trigger('chatBoxScrolledDown', { 'chatbox': this.model });
    }
}

api.elements.define('converse-chat-content', ChatContent);
