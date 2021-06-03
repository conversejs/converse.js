import './message-history';
import debounce from 'lodash/debounce';
import { CustomElement } from 'shared/components/element.js';
import { _converse, api, converse } from '@converse/headless/core';
import { html } from 'lit';

const { u } = converse;

export default class ChatContent extends CustomElement {

    static get properties () {
        return {
            jid: { type: String }
        }
    }

    connectedCallback () {
        super.connectedCallback();
        this.debouncedMaintainScroll = debounce(this.maintainScrollPosition, 100);

        this.model = _converse.chatboxes.get(this.jid);
        this.listenTo(this.model, 'change:hidden_occupants', this.requestUpdate);
        this.listenTo(this.model, 'change:scrolled', this.requestUpdate);
        this.listenTo(this.model.messages, 'add', this.requestUpdate);
        this.listenTo(this.model.messages, 'change', this.requestUpdate);
        this.listenTo(this.model.messages, 'remove', this.requestUpdate);
        this.listenTo(this.model.messages, 'rendered', this.requestUpdate);
        this.listenTo(this.model.messages, 'reset', this.requestUpdate);
        this.listenTo(this.model.notifications, 'change', this.requestUpdate);
        this.listenTo(this.model.ui, 'change', this.requestUpdate);

        if (this.model.occupants) {
            this.listenTo(this.model.occupants, 'change', this.requestUpdate);
        }
        // We jot down whether we were scrolled down before rendering, because when an
        // image loads, it triggers 'scroll' and the chat will be marked as scrolled,
        // which is technically true, but not what we want because the user
        // didn't initiate the scrolling.
        this.was_scrolled_up = this.model.get('scrolled');
        this.addEventListener('imageLoaded', () => {
            this.debouncedMaintainScroll(this.was_scrolled_up);
        });
    }

    render () {
        return html`
            ${ this.model.ui.get('chat-content-spinner-top') ? html`<span class="spinner fa fa-spinner centered"></span>` : '' }
            <converse-message-history
                .model=${this.model}
                .messages=${[...this.model.messages.models]}>
            </converse-message-history>
            <div class="chat-content__notifications">${this.model.getNotificationsText()}</div>
        `;
    }

    updated () {
        this.was_scrolled_up = this.model.get('scrolled');
        this.debouncedMaintainScroll();
    }

    saveScrollPosition () {
        const scrollTop = this.scrollTop;
        if (scrollTop) {
            u.safeSave(this.model, { 'scrolled': true, scrollTop });
        }
    }

    maintainScrollPosition () {
        if (this.was_scrolled_up) {
            const pos = this.model.get('scrollTop');
            if (pos) {
                this.scrollTop = pos;
            }
        } else {
            this.scrollDown();
        }
    }

    scrollDown () {
        if (this.scrollTo) {
            const behavior = this.scrollTop ? 'smooth' : 'auto';
            this.scrollTo({ 'top': this.scrollHeight, behavior });
        } else {
            this.scrollTop = this.scrollHeight;
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
