import './message-history';
import debounce from 'lodash/debounce';
import { CustomElement } from 'shared/components/element.js';
import { _converse, api } from '@converse/headless/core';
import { html } from 'lit';
import { onScrolledDown } from './utils.js';
import { safeSave } from '@converse/headless/utils/core.js';

import './styles/chat-content.scss';


export default class ChatContent extends CustomElement {

    static get properties () {
        return {
            jid: { type: String }
        }
    }

    connectedCallback () {
        super.connectedCallback();
        this.markScrolled = debounce(this._markScrolled, 50);

        this.model = _converse.chatboxes.get(this.jid);
        this.listenTo(this.model, 'change:hidden_occupants', this.requestUpdate);
        this.listenTo(this.model, 'change:scrolled', this.scrollDown);
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
        this.addEventListener('scroll', () => this.markScrolled());
    }

    render () {
        // This element has "flex-direction: reverse", so elements here are
        // shown in reverse order.
        return html`
            <div class="chat-content__notifications">${this.model.getNotificationsText()}</div>
            <converse-message-history
                .model=${this.model}
                .messages=${[...this.model.messages.models]}>
            </converse-message-history>
            ${ this.model.ui?.get('chat-content-spinner-top') ? html`<span class="spinner fa fa-spinner centered"></span>` : '' }
        `;
    }

    /**
     * Called when the chat content is scrolled up or down.
     * We want to record when the user has scrolled away from
     * the bottom, so that we don't automatically scroll away
     * from what the user is reading when new messages are received.
     *
     * Don't call this method directly, instead, call `markScrolled`,
     * which debounces this method by 100ms.
     * @private
     */
    _markScrolled () {
        let scrolled = true;
        const is_at_bottom = this.scrollTop === 0;
        const is_at_top =
            Math.ceil(this.clientHeight-this.scrollTop) >= (this.scrollHeight-Math.ceil(this.scrollHeight/20));

        if (is_at_bottom) {
            scrolled = false;
            onScrolledDown(this.model);
        } else if (is_at_top) {
            /**
             * Triggered once the chat's message area has been scrolled to the top
             * @event _converse#chatBoxScrolledUp
             * @property { _converse.ChatBoxView | _converse.ChatRoomView } view
             * @example _converse.api.listen.on('chatBoxScrolledUp', obj => { ... });
             */
            api.trigger('chatBoxScrolledUp', this);
        }
        if (this.model.get('scolled') !== scrolled) {
            safeSave(this.model, { scrolled });
        }
    }

    scrollDown () {
        if (this.model.get('scrolled')) {
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
