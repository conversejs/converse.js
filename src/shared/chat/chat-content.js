import './message-history';
import debounce from 'lodash/debounce';
import { CustomElement } from 'shared/components/element.js';
import { _converse, api } from '@converse/headless/core';
import { html } from 'lit';
import { onScrolledDown } from './utils.js';
import { safeSave } from '@converse/headless/utils/core.js';


export default class ChatContent extends CustomElement {

    static get properties () {
        return {
            jid: { type: String }
        }
    }

    connectedCallback () {
        super.connectedCallback();
        this.debouncedMaintainScroll = debounce(this.maintainScrollPosition, 100);
        this.markScrolled = debounce(this._markScrolled, 100);

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
        this.addEventListener('scroll', () => this.markScrolled());
        this.initIntersectionObserver();
    }

    render () {
        return html`
            ${ this.model.ui.get('chat-content-spinner-top') ? html`<span class="spinner fa fa-spinner centered"></span>` : '' }
            <converse-message-history
                .model=${this.model}
                .observer=${this.observer}
                .messages=${[...this.model.messages.models]}>
            </converse-message-history>
            <div class="chat-content__notifications">${this.model.getNotificationsText()}</div>
        `;
    }

    updated () {
        this.was_scrolled_up = this.model.get('scrolled');
        this.debouncedMaintainScroll();
    }

    initIntersectionObserver () {
      if (this.observer) {
          this.observer.disconnect();
      } else {
          const options = {
              root: this,
              threshold: [0.1]
          }
          const handler = ev => this.setAnchoredMessage(ev);
          this.observer = new IntersectionObserver(handler, options);
      }
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
        const is_at_bottom = this.scrollTop + this.clientHeight >= this.scrollHeight;
        if (is_at_bottom) {
            scrolled = false;
            onScrolledDown(this.model);
        } else if (this.scrollTop === 0) {
            /**
             * Triggered once the chat's message area has been scrolled to the top
             * @event _converse#chatBoxScrolledUp
             * @property { _converse.ChatBoxView | _converse.ChatRoomView } view
             * @example _converse.api.listen.on('chatBoxScrolledUp', obj => { ... });
             */
            api.trigger('chatBoxScrolledUp', this);
        }
        safeSave(this.model, { scrolled });
    }

    setAnchoredMessage (entries) {
        if (this.model.ui.get('chat-content-spinner-top')) {
            return;
        }
        entries = entries.filter(e => e.isIntersecting);
        const current = entries.reduce((p, c) => c.boundingClientRect.y >= (p?.boundingClientRect.y || 0) ? c : p, null);
        if (current) {
            this.anchored_message = current.target;
        }
    }

    maintainScrollPosition () {
        if (this.was_scrolled_up) {
            console.warn('scrolling into view');
            this.anchored_message?.scrollIntoView(true);
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
