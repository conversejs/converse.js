import { CustomElement } from 'shared/components/element.js';
import { _converse, api } from '@converse/headless/core';
import { onScrolledDown } from './utils.js';


export default class BaseChatView extends CustomElement {

    static get properties () {
        return {
            jid: { type: String }
        }
    }

    disconnectedCallback () {
        super.disconnectedCallback();
        _converse.chatboxviews.remove(this.jid, this);
    }

    updated () {
        if (this.model && this.jid !== this.model.get('jid')) {
            this.stopListening();
            _converse.chatboxviews.remove(this.model.get('jid'), this);
            delete this.model;
            this.requestUpdate();
            this.initialize();
        }
    }

    close (ev) {
        ev?.preventDefault?.();
        return this.model.close(ev);
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

    getBottomPanel () {
        if (this.model.get('type') === _converse.CHATROOMS_TYPE) {
            return this.querySelector('converse-muc-bottom-panel');
        } else {
            return this.querySelector('converse-chat-bottom-panel');
        }
    }

    getMessageForm () {
        if (this.model.get('type') === _converse.CHATROOMS_TYPE) {
            return this.querySelector('converse-muc-message-form');
        } else {
            return this.querySelector('converse-message-form');
        }
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
        if (this.model.ui.get('scrolled')) {
            this.model.ui.set({ 'scrolled': false });
        }
        onScrolledDown(this.model);
    }

    onWindowStateChanged (data) {
        if (data.state === 'visible') {
            if (!this.model.isHidden()) {
                this.model.clearUnreadMsgCounter();
            }
        } else if (data.state === 'hidden') {
            this.model.setChatState(_converse.INACTIVE, { 'silent': true });
            this.model.sendChatState();
        }
    }
}
