import log from '@converse/headless/log';
import tpl_chatbox_message_form from 'templates/chatbox_message_form.js';
import tpl_toolbar from 'templates/toolbar.js';
import { ElementView } from '@converse/skeletor/src/element.js';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless/core';
import { debounce } from 'lodash-es';
import { html, render } from 'lit-html';

const u = converse.env.utils;

export default class BaseChatView extends ElementView {

    initDebounced () {
        this.markScrolled = debounce(this._markScrolled, 100);
        this.debouncedScrollDown = debounce(this.scrollDown, 100);

        // For tests that use Jasmine.Clock we want to turn of
        // debouncing, since setTimeout breaks.
        if (api.settings.get('debounced_content_rendering')) {
            this.renderChatHistory = debounce(() => this.renderChatContent(false), 100);
            this.renderNotifications = debounce(() => this.renderChatContent(true), 100);
        } else {
            this.renderChatHistory = () => this.renderChatContent(false);
            this.renderNotifications = () => this.renderChatContent(true);
        }
    }

    renderChatContent (msgs_by_ref = false) {
        if (!this.tpl_chat_content) {
            this.tpl_chat_content = o => {
                return html`
                    <converse-chat-content .chatview=${this} .messages=${o.messages} notifications=${o.notifications}>
                    </converse-chat-content>
                `;
            };
        }
        const msg_models = this.model.messages.models;
        const messages = msgs_by_ref ? msg_models : Array.from(msg_models);
        render(this.tpl_chat_content({ messages, 'notifications': this.getNotifications() }), this.msgs_container);
    }

    renderMessageForm () {
        const form_container = this.querySelector('.message-form-container');
        render(
            tpl_chatbox_message_form(
                Object.assign(this.model.toJSON(), {
                    'hint_value': this.querySelector('.spoiler-hint')?.value,
                    'label_message': this.model.get('composing_spoiler') ? __('Hidden message') : __('Message'),
                    'label_spoiler_hint': __('Optional hint'),
                    'message_value': this.querySelector('.chat-textarea')?.value,
                    'show_send_button': api.settings.get('show_send_button'),
                    'show_toolbar': api.settings.get('show_toolbar'),
                    'unread_msgs': __('You have unread messages')
                })
            ),
            form_container
        );
        this.addEventListener('focusin', ev => this.emitFocused(ev));
        this.addEventListener('focusout', ev => this.emitBlurred(ev));
        this.renderToolbar();
    }

    renderToolbar () {
        if (!api.settings.get('show_toolbar')) {
            return this;
        }
        const options = Object.assign(
            {
                'model': this.model,
                'chatview': this
            },
            this.model.toJSON(),
            this.getToolbarOptions()
        );
        render(tpl_toolbar(options), this.querySelector('.chat-toolbar'));
        /**
         * Triggered once the _converse.ChatBoxView's toolbar has been rendered
         * @event _converse#renderToolbar
         * @type { _converse.ChatBoxView }
         * @example _converse.api.listen.on('renderToolbar', view => { ... });
         */
        api.trigger('renderToolbar', this);
        return this;
    }

    async getHeadingStandaloneButton (promise_or_data) { // eslint-disable-line class-methods-use-this
        const data = await promise_or_data;
        return html`
            <a
                href="#"
                class="chatbox-btn ${data.a_class} fa ${data.icon_class}"
                @click=${data.handler}
                title="${data.i18n_title}"
            ></a>
        `;
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

    async getHeadingDropdownItem (promise_or_data) { // eslint-disable-line class-methods-use-this
        const data = await promise_or_data;
        return html`
            <a href="#" class="dropdown-item ${data.a_class}" @click=${data.handler} title="${data.i18n_title}"
                ><i class="fa ${data.icon_class}"></i>${data.i18n_text}</a
            >
        `;
    }

    autocompleteInPicker (input, value) {
        const emoji_dropdown = this.querySelector('converse-emoji-dropdown');
        const emoji_picker = this.querySelector('converse-emoji-picker');
        if (emoji_picker && emoji_dropdown) {
            emoji_picker.model.set({
                'ac_position': input.selectionStart,
                'autocompleting': value,
                'query': value
            });
            emoji_dropdown.showMenu();
            return true;
        }
    }

    onEmojiReceivedFromPicker (emoji) {
        const model = this.querySelector('converse-emoji-picker').model;
        const autocompleting = model.get('autocompleting');
        const ac_position = model.get('ac_position');
        this.insertIntoTextArea(emoji, autocompleting, false, ac_position);
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
        const textarea = this.querySelector('.chat-textarea');
        if (correcting) {
            u.addClass('correcting', textarea);
        } else {
            u.removeClass('correcting', textarea);
        }
        if (replace) {
            if (position && typeof replace == 'string') {
                textarea.value = textarea.value.replace(new RegExp(replace, 'g'), (match, offset) =>
                    offset == position - replace.length ? value + ' ' : match
                );
            } else {
                textarea.value = value;
            }
        } else {
            let existing = textarea.value;
            if (existing && existing[existing.length - 1] !== ' ') {
                existing = existing + ' ';
            }
            textarea.value = existing + value + ' ';
        }
        this.updateCharCounter(textarea.value);
        u.placeCaretAtEnd(textarea);
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
        const is_at_bottom =
            this.msgs_container.scrollTop + this.msgs_container.clientHeight >= this.msgs_container.scrollHeight - 62; // sigh...

        if (is_at_bottom) {
            scrolled = false;
            this.onScrolledDown();
        } else if (this.msgs_container.scrollTop === 0) {
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
        if (this.msgs_container.scrollTo) {
            const behavior = this.msgs_container.scrollTop ? 'smooth' : 'auto';
            this.msgs_container.scrollTo({ 'top': this.msgs_container.scrollHeight, behavior });
        } else {
            this.msgs_container.scrollTop = this.msgs_container.scrollHeight;
        }
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

    onWindowStateChanged (state) {
        if (state === 'visible') {
            if (!this.model.isHidden() && this.model.get('num_unread', 0)) {
                this.model.clearUnreadMsgCounter();
            }
        } else if (state === 'hidden') {
            this.model.setChatState(_converse.INACTIVE, { 'silent': true });
            this.model.sendChatState();
        }
    }

    async onFormSubmitted (ev) {
        ev.preventDefault();
        const textarea = this.querySelector('.chat-textarea');
        const message_text = textarea.value.trim();
        if (
            (api.settings.get('message_limit') && message_text.length > api.settings.get('message_limit')) ||
            !message_text.replace(/\s/g, '').length
        ) {
            return;
        }
        if (!_converse.connection.authenticated) {
            const err_msg = __('Sorry, the connection has been lost, and your message could not be sent');
            api.alert('error', __('Error'), err_msg);
            api.connection.reconnect();
            return;
        }
        let spoiler_hint,
            hint_el = {};
        if (this.model.get('composing_spoiler')) {
            hint_el = this.querySelector('form.sendXMPPMessage input.spoiler-hint');
            spoiler_hint = hint_el.value;
        }
        u.addClass('disabled', textarea);
        textarea.setAttribute('disabled', 'disabled');
        this.querySelector('converse-emoji-dropdown')?.hideMenu();

        const is_command = this.parseMessageForCommands(message_text);
        const message = is_command ? null : await this.model.sendMessage(message_text, spoiler_hint);
        if (is_command || message) {
            hint_el.value = '';
            textarea.value = '';
            u.removeClass('correcting', textarea);
            textarea.style.height = 'auto';
            this.updateCharCounter(textarea.value);
        }
        if (message) {
            /**
             * Triggered whenever a message is sent by the user
             * @event _converse#messageSend
             * @type { _converse.Message }
             * @example _converse.api.listen.on('messageSend', message => { ... });
             */
            api.trigger('messageSend', message);
        }
        if (api.settings.get('view_mode') === 'overlayed') {
            // XXX: Chrome flexbug workaround. The .chat-content area
            // doesn't resize when the textarea is resized to its original size.
            this.msgs_container.parentElement.style.display = 'none';
        }
        textarea.removeAttribute('disabled');
        u.removeClass('disabled', textarea);

        if (api.settings.get('view_mode') === 'overlayed') {
            // XXX: Chrome flexbug workaround.
            this.msgs_container.parentElement.style.display = '';
        }
        // Suppress events, otherwise superfluous CSN gets set
        // immediately after the message, causing rate-limiting issues.
        this.model.setChatState(_converse.ACTIVE, { 'silent': true });
        textarea.focus();
    }

    onEnterPressed (ev) {
        return this.onFormSubmitted(ev);
    }

    updateCharCounter (chars) {
        if (api.settings.get('message_limit')) {
            const message_limit = this.querySelector('.message-limit');
            const counter = api.settings.get('message_limit') - chars.length;
            message_limit.textContent = counter;
            if (counter < 1) {
                u.addClass('error', message_limit);
            } else {
                u.removeClass('error', message_limit);
            }
        }
    }
}
