import debounce from 'lodash-es/debounce';
import log from '@converse/headless/log';
import tpl_spinner from 'templates/spinner.js';
import { ElementView } from '@converse/skeletor/src/element.js';
import { _converse, api, converse } from '@converse/headless/core';

const u = converse.env.utils;

export default class BaseChatView extends ElementView {

    initDebounced () {
        this.markScrolled = debounce(this._markScrolled, 100);
        this.debouncedScrollDown = debounce(this.scrollDown, 100);
    }

    disconnectedCallback () {
        super.disconnectedCallback();
        const jid = this.getAttribute('jid');
        _converse.chatboxviews.remove(jid, this);
    }

    hideNewMessagesIndicator () {
        const new_msgs_indicator = this.querySelector('.new-msgs-indicator');
        if (new_msgs_indicator !== null) {
            new_msgs_indicator.classList.add('hidden');
        }
    }

    maybeFocus () {
        api.settings.get('auto_focus') && this.focus();
    }

    focus () {
        const textarea_el = this.getElementsByClassName('chat-textarea')[0];
        if (textarea_el && document.activeElement !== textarea_el) {
            textarea_el.focus();
        }
        return this;
    }

    show () {
        if (this.model.get('hidden')) {
            log.debug(`Not showing chat ${this.model.get('jid')} because it's set as hidden`);
            return;
        }
        if (u.isVisible(this)) {
            this.maybeFocus();
            return;
        }
        this.afterShown();
    }

    async close (ev) {
        ev?.preventDefault?.();
        if (api.connection.connected()) {
            // Immediately sending the chat state, because the
            // model is going to be destroyed afterwards.
            this.model.setChatState(_converse.INACTIVE);
            this.model.sendChatState();
        }
        await this.model.close(ev);
        /**
         * Triggered once a chatbox has been closed.
         * @event _converse#chatBoxClosed
         * @type { _converse.ChatBoxView | _converse.ChatRoomView }
         * @example _converse.api.listen.on('chatBoxClosed', view => { ... });
         */
        api.trigger('chatBoxClosed', this);
    }

    emitBlurred (ev) {
        if (this.contains(document.activeElement) || this.contains(ev.relatedTarget)) {
            // Something else in this chatbox is still focused
            return;
        }
        /**
         * Triggered when the focus has been removed from a particular chat.
         * @event _converse#chatBoxBlurred
         * @type { _converse.ChatBoxView | _converse.ChatRoomView }
         * @example _converse.api.listen.on('chatBoxBlurred', (view, event) => { ... });
         */
        api.trigger('chatBoxBlurred', this, ev);
    }

    emitFocused (ev) {
        if (this.contains(ev.relatedTarget)) {
            // Something else in this chatbox was already focused
            return;
        }
        /**
         * Triggered when the focus has been moved to a particular chat.
         * @event _converse#chatBoxFocused
         * @type { _converse.ChatBoxView | _converse.ChatRoomView }
         * @example _converse.api.listen.on('chatBoxFocused', (view, event) => { ... });
         */
        api.trigger('chatBoxFocused', this, ev);
    }

    /**
     * Scroll to the previously saved scrollTop position, or scroll
     * down if it wasn't set.
     */
    maintainScrollTop () {
        const pos = this.model.get('scrollTop');
        if (pos) {
            const msgs_container = this.querySelector('.chat-content__messages');
            msgs_container.scrollTop = pos;
        } else {
            this.scrollDown();
        }
    }

    addSpinner (append = false) {
        const content = this.querySelector('.chat-content');
        if (this.querySelector('.spinner') === null) {
            const el = u.getElementFromTemplateResult(tpl_spinner());
            if (append) {
                content.insertAdjacentElement('beforeend', el);
                this.scrollDown();
            } else {
                content.insertAdjacentElement('afterbegin', el);
            }
        }
    }

    clearSpinner () {
        this.querySelectorAll('.chat-content .spinner').forEach(u.removeElement);
    }

    onStatusMessageChanged (item) {
        this.renderHeading();
        /**
         * When a contact's custom status message has changed.
         * @event _converse#contactStatusMessageChanged
         * @type {object}
         * @property { object } contact - The chat buddy
         * @property { string } message - The message text
         * @example _converse.api.listen.on('contactStatusMessageChanged', obj => { ... });
         */
        api.trigger('contactStatusMessageChanged', {
            'contact': item.attributes,
            'message': item.get('status')
        });
    }

    showNewMessagesIndicator () {
        u.showElement(this.querySelector('.new-msgs-indicator'));
    }

    onMessageAdded (message) {
        if (u.isNewMessage(message)) {
            if (message.get('sender') === 'me') {
                // We remove the "scrolled" flag so that the chat area
                // gets scrolled down. We always want to scroll down
                // when the user writes a message as opposed to when a
                // message is received.
                this.model.set('scrolled', false);
            } else if (this.model.get('scrolled', true)) {
                this.showNewMessagesIndicator();
            }
        }
    }

    getBottomPanel () {
        if (this.model.get('type') === _converse.CHATROOMS_TYPE) {
            return this.querySelector('converse-muc-bottom-panel');
        } else {
            return this.querySelector('converse-chat-bottom-panel');
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
    _markScrolled (ev) {
        let scrolled = true;
        let scrollTop = null;
        const msgs_container = this.querySelector('.chat-content__messages');
        const is_at_bottom =
            msgs_container.scrollTop + msgs_container.clientHeight >= msgs_container.scrollHeight - 62; // sigh...

        if (is_at_bottom) {
            scrolled = false;
            this.onScrolledDown();
        } else if (msgs_container.scrollTop === 0) {
            /**
             * Triggered once the chat's message area has been scrolled to the top
             * @event _converse#chatBoxScrolledUp
             * @property { _converse.ChatBoxView | _converse.ChatRoomView } view
             * @example _converse.api.listen.on('chatBoxScrolledUp', obj => { ... });
             */
            api.trigger('chatBoxScrolledUp', this);
        } else {
            scrollTop = ev.target.scrollTop;
        }
        u.safeSave(this.model, { scrolled, scrollTop });
    }

    /**
     * Scrolls the chat down.
     *
     * This method will always scroll the chat down, regardless of
     * whether the user scrolled up manually or not.
     * @param { Event } [ev] - An optional event that is the cause for needing to scroll down.
     */
    scrollDown (ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        if (this.model.get('scrolled')) {
            u.safeSave(this.model, {
                'scrolled': false,
                'scrollTop': null
            });
        }
        this.querySelector('.chat-content__messages')?.scrollDown();
        this.onScrolledDown();
    }

    onScrolledDown () {
        this.hideNewMessagesIndicator();
        if (!this.model.isHidden()) {
            this.model.clearUnreadMsgCounter();
            if (api.settings.get('allow_url_history_change')) {
                // Clear location hash if set to one of the messages in our history
                const hash = window.location.hash;
                hash && this.model.messages.get(hash.slice(1)) && _converse.router.history.navigate();
            }
        }
        /**
         * Triggered once the chat's message area has been scrolled down to the bottom.
         * @event _converse#chatBoxScrolledDown
         * @type {object}
         * @property { _converse.ChatBox | _converse.ChatRoom } chatbox - The chat model
         * @example _converse.api.listen.on('chatBoxScrolledDown', obj => { ... });
         */
        api.trigger('chatBoxScrolledDown', { 'chatbox': this.model }); // TODO: clean up
    }

    onWindowStateChanged (data) {
        if (data.state === 'visible') {
            if (!this.model.isHidden() && this.model.get('num_unread', 0)) {
                this.model.clearUnreadMsgCounter();
            }
        } else if (data.state === 'hidden') {
            this.model.setChatState(_converse.INACTIVE, { 'silent': true });
            this.model.sendChatState();
        }
    }
}
