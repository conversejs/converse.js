import './message-history';
import tplSpinner from "templates/spinner.js";
import { CustomElement } from '../components/element.js';
import { api } from '@converse/headless';
import { html } from 'lit';
import { markScrolled } from './utils.js';

import './styles/chat-content.scss';


export default class ChatContent extends CustomElement {

    constructor () {
        super();
        this.model = null;
    }

    static get properties () {
        return {
            model: { type: Object }
        }
    }

    disconnectedCallback () {
        super.disconnectedCallback();
        this.removeEventListener('scroll', markScrolled);
    }

    async initialize () {
        await this.model.initialized;
        this.listenTo(this.model.messages, 'add', () => this.requestUpdate());
        this.listenTo(this.model.messages, 'change', () => this.requestUpdate());
        this.listenTo(this.model.messages, 'remove', () => this.requestUpdate());
        this.listenTo(this.model.messages, 'rendered', () => this.requestUpdate());
        this.listenTo(this.model.messages, 'reset', () => this.requestUpdate());
        this.listenTo(this.model.notifications, 'change', () => this.requestUpdate());
        this.listenTo(this.model.ui, 'change', () => this.requestUpdate());
        this.listenTo(this.model.ui, 'change:scrolled', this.scrollDown);
        this.addEventListener('scroll', markScrolled);
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
            ${ this.model.ui?.get('chat-content-spinner-top') ? tplSpinner() : '' }
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
