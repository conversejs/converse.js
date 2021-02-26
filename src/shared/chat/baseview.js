import debounce from 'lodash/debounce';
import log from '@converse/headless/log';
import tpl_spinner from 'templates/spinner.js';
import { ElementView } from '@converse/skeletor/src/element.js';
import { _converse, api, converse } from '@converse/headless/core';
import { html, render } from 'lit-html';

const u = converse.env.utils;

export default class BaseChatView extends ElementView {

    initDebounced () {
        this.markScrolled = debounce(this._markScrolled, 100);
        this.debouncedScrollDown = debounce(this.scrollDown, 100);
    }

    renderHelpMessages () {
        render(
            html`
                <converse-chat-help
                    .model=${this.model}
                    .messages=${this.getHelpMessages()}
                    ?hidden=${!this.model.get('show_help_messages')}
                    type="info"
                    chat_type="${this.model.get('type')}"
                ></converse-chat-help>
            `,
            this.help_container
        );
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
        if (this.querySelector('.spinner') === null) {
            const el = u.getElementFromTemplateResult(tpl_spinner());
            if (append) {
                this.content.insertAdjacentElement('beforeend', el);
                this.scrollDown();
            } else {
                this.content.insertAdjacentElement('afterbegin', el);
            }
        }
    }

    clearSpinner () {
        this.content.querySelectorAll('.spinner').forEach(u.removeElement);
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

    onEmojiReceivedFromPicker (emoji) {
        const model = this.querySelector('converse-emoji-picker').model;
        const autocompleting = model.get('autocompleting');
        const ac_position = model.get('ac_position');
        this.insertIntoTextArea(emoji, autocompleting, false, ac_position);
    }

    onMessageCorrecting (message) {
        if (message.get('correcting')) {
            this.insertIntoTextArea(u.prefixMentions(message), true, true);
        } else {
            const currently_correcting = this.model.messages.findWhere('correcting');
            if (currently_correcting && currently_correcting !== message) {
                this.insertIntoTextArea(u.prefixMentions(message), true, true);
            } else {
                this.insertIntoTextArea('', true, false);
            }
        }
    }

    /**
     * Insert a particular string value into the textarea of this chat box.
     * @private
     * @method _converse.ChatBoxView#insertIntoTextArea
     * @param {string} value - The value to be inserted.
     * @param {(boolean|string)} [replace] - Whether an existing value
     *  should be replaced. If set to `true`, the entire textarea will
     *  be replaced with the new value. If set to a string, then only
     *  that string will be replaced *if* a position is also specified.
     * @param {integer} [position] - The end index of the string to be
     * replaced with the new value.
     */
    insertIntoTextArea (value, replace = false, correcting = false, position) {
        let bottom_panel;
        if (this.model.get('type') === _converse.CHATROOMS_TYPE) {
            bottom_panel = this.querySelector('converse-muc-bottom-panel');
        } else {
            bottom_panel = this.querySelector('converse-chat-bottom-panel');
        }
        bottom_panel.insertIntoTextArea(value, replace, correcting, position);
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
        this.querySelector('.chat-content__messages').scrollDown();
        this.onScrolledDown();
    }

    onScrolledDown () {
        this.hideNewMessagesIndicator();
        if (!this.model.isHidden()) {
            this.model.clearUnreadMsgCounter();
            // Clear location hash if set to one of the messages in our history
            const hash = window.location.hash;
            hash && this.model.messages.get(hash.slice(1)) && _converse.router.history.navigate();
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
