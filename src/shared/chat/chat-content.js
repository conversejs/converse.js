import "./message-history";
import debounce from 'lodash/debounce';
import { CustomElement } from 'components/element.js';
import { _converse, api } from "@converse/headless/core";
import { html } from 'lit-element';

export default class ChatContent extends CustomElement {

    static get properties () {
        return {
            jid: { type: String }
        }
    }

    connectedCallback () {
        super.connectedCallback();
        this.debouncedScrolldown = debounce(this.scrollDown, 100);
        this.model = _converse.chatboxes.get(this.jid);
        this.listenTo(this.model.messages, 'add', this.requestUpdate);
        this.listenTo(this.model.messages, 'change', this.requestUpdate);
        this.listenTo(this.model.messages, 'remove', this.requestUpdate);
        this.listenTo(this.model.messages, 'reset', this.requestUpdate);
        this.listenTo(this.model.notifications, 'change', this.requestUpdate);
        if (this.model.occupants) {
            this.listenTo(this.model.occupants, 'change', this.requestUpdate);
        }

        // We jot down whether we were scrolled down before rendering, because when an
        // image loads, it triggers 'scroll' and the chat will be marked as scrolled,
        // which is technically true, but not what we want because the user
        // didn't initiate the scrolling.
        this.was_scrolled_up = this.model.get('scrolled');
        this.addEventListener('imageLoaded', () => {
            !this.was_scrolled_up && this.scrollDown();
        });
    }

    render () {
        return html`
            <converse-message-history
                .model=${this.model}
                .messages=${[...this.model.messages.models]}>
            </converse-message-history>
            <div class="chat-content__notifications">${this.model.getNotificationsText()}</div>
        `;
    }

    updated () {
        !this.model.get('scrolled') && this.debouncedScrolldown();
    }

    scrollDown () {
        if (this.scrollTo) {
            const behavior = this.scrollTop ? 'smooth' : 'auto';
            this.scrollTo({ 'top': this.scrollHeight, behavior });
        } else {
            this.scrollTop = this.scrollHeight;
        }
    }
}

api.elements.define('converse-chat-content', ChatContent);
