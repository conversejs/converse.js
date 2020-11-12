/**
 * @module converse-chatview
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "./components/chat_content.js";
import "./components/help_messages.js";
import "./components/toolbar.js";
import "converse-chatboxviews";
import "converse-modal";
import log from "@converse/headless/log";
import tpl_chatbox from "templates/chatbox.js";
import tpl_chatbox_head from "templates/chatbox_head.js";
import tpl_chatbox_message_form from "templates/chatbox_message_form.js";
import tpl_spinner from "templates/spinner.js";
import tpl_toolbar from "templates/toolbar.js";
import tpl_user_details_modal from "templates/user_details_modal.js";
import { BootstrapModal } from "./converse-modal.js";
import { View } from '@converse/skeletor/src/view.js';
import { __ } from './i18n';
import { _converse, api, converse } from "@converse/headless/converse-core";
import { debounce } from "lodash-es";
import { html, render } from "lit-html";


const { Strophe, dayjs } = converse.env;
const u = converse.env.utils;


/**
 * The View of an open/ongoing chat conversation.
 * @class
 * @namespace _converse.ChatBoxView
 * @memberOf _converse
 */
export const ChatBoxView = View.extend({
    length: 200,
    className: 'chatbox hidden',
    is_chatroom: false,  // Leaky abstraction from MUC

    events: {
        'click .chatbox-navback': 'showControlBox',
        'click .new-msgs-indicator': 'viewUnreadMessages',
        'click .send-button': 'onFormSubmitted',
        'click .toggle-clear': 'clearMessages',
        'input .chat-textarea': 'inputChanged',
        'keydown .chat-textarea': 'onKeyDown',
        'keyup .chat-textarea': 'onKeyUp',
        'paste .chat-textarea': 'onPaste',
    },

    async initialize () {
        this.initDebounced();

        this.listenTo(this.model, 'change:composing_spoiler', this.renderMessageForm);
        this.listenTo(this.model, 'change:hidden', m => m.get('hidden') ? this.hide() : this.show());
        this.listenTo(this.model, 'change:status', this.onStatusMessageChanged);
        this.listenTo(this.model, 'destroy', this.remove);
        this.listenTo(this.model, 'show', this.show);
        this.listenTo(this.model, 'vcard:change', this.renderHeading);

        if (this.model.contact) {
            this.listenTo(this.model.contact, 'destroy', this.renderHeading);
        }
        if (this.model.rosterContactAdded) {
            this.model.rosterContactAdded.then(() => {
                this.listenTo(this.model.contact, 'change:nickname', this.renderHeading);
                this.renderHeading();
            });
        }

        this.listenTo(this.model.presence, 'change:show', this.onPresenceChanged);
        this.render();

        // Need to be registered after render has been called.
        this.listenTo(this.model.messages, 'add', this.onMessageAdded);
        this.listenTo(this.model.messages, 'remove', this.renderChatHistory);
        this.listenTo(this.model.messages, 'rendered', this.maybeScrollDown);
        this.listenTo(this.model.messages, 'reset', this.renderChatHistory);
        this.listenTo(this.model.notifications, 'change', this.renderNotifications);
        this.listenTo(this.model, 'change:show_help_messages', this.renderHelpMessages);

        await this.model.messages.fetched;
        this.insertIntoDOM();
        this.model.maybeShow();
        this.scrollDown();
        /**
         * Triggered once the {@link _converse.ChatBoxView} has been initialized
         * @event _converse#chatBoxViewInitialized
         * @type { _converse.HeadlinesBoxView }
         * @example _converse.api.listen.on('chatBoxViewInitialized', view => { ... });
         */
        api.trigger('chatBoxViewInitialized', this);
    },

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
    },

    render () {
        const result = tpl_chatbox(
            Object.assign(this.model.toJSON(), {'markScrolled': ev => this.markScrolled(ev)})
        );
        render(result, this.el);
        this.content = this.el.querySelector('.chat-content');
        this.notifications = this.el.querySelector('.chat-content__notifications');
        this.msgs_container = this.el.querySelector('.chat-content__messages');
        this.help_container = this.el.querySelector('.chat-content__help');
        this.renderChatContent();
        this.renderMessageForm();
        this.renderHeading();
        return this;
    },

    onMessageAdded (message) {
        this.renderChatHistory();

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
    },

    getNotifications () {
        if (this.model.notifications.get('chat_state') === _converse.COMPOSING) {
            return __('%1$s is typing', this.model.getDisplayName());
        } else if (this.model.notifications.get('chat_state') === _converse.PAUSED) {
            return __('%1$s has stopped typing', this.model.getDisplayName());
        } else if (this.model.notifications.get('chat_state') === _converse.GONE) {
            return __('%1$s has gone away', this.model.getDisplayName());
        } else {
            return '';
        }
    },

    getHelpMessages () {
        return [
            `<strong>/clear</strong>: ${__('Remove messages')}`,
            `<strong>/close</strong>: ${__('Close this chat')}`,
            `<strong>/me</strong>: ${__('Write in the third person')}`,
            `<strong>/help</strong>: ${__('Show this menu')}`
        ];
    },

    renderHelpMessages () {
        render(
            html`<converse-chat-help
                .model=${this.model}
                .messages=${this.getHelpMessages()}
                ?hidden=${!this.model.get('show_help_messages')}
                type="info"
                chat_type="${this.model.get('type')}"></converse-chat-help>`,

            this.help_container
        );
    },

    renderChatContent (msgs_by_ref=false) {
        if (!this.tpl_chat_content) {
            this.tpl_chat_content = (o) => {
                return html`
                    <converse-chat-content
                        .chatview=${this}
                        .messages=${o.messages}
                        notifications=${o.notifications}>
                    </converse-chat-content>`
            };
        }
        const msg_models = this.model.messages.models;
        const messages = msgs_by_ref ? msg_models : Array.from(msg_models);
        render(
            this.tpl_chat_content({ messages, 'notifications': this.getNotifications() }),
            this.msgs_container
        );
    },

    renderToolbar () {
        if (!api.settings.get('show_toolbar')) {
            return this;
        }
        const options = Object.assign({
                'model': this.model,
                'chatview': this
            },
            this.model.toJSON(),
            this.getToolbarOptions()
        );
        render(tpl_toolbar(options), this.el.querySelector('.chat-toolbar'));
        /**
         * Triggered once the _converse.ChatBoxView's toolbar has been rendered
         * @event _converse#renderToolbar
         * @type { _converse.ChatBoxView }
         * @example _converse.api.listen.on('renderToolbar', view => { ... });
         */
        api.trigger('renderToolbar', this);
        return this;
    },

    renderMessageForm () {
        const form_container = this.el.querySelector('.message-form-container');
        render(tpl_chatbox_message_form(
            Object.assign(this.model.toJSON(), {
                'hint_value': this.el.querySelector('.spoiler-hint')?.value,
                'label_message': this.model.get('composing_spoiler') ? __('Hidden message') : __('Message'),
                'label_spoiler_hint': __('Optional hint'),
                'message_value': this.el.querySelector('.chat-textarea')?.value,
                'show_send_button': api.settings.get('show_send_button'),
                'show_toolbar': api.settings.get('show_toolbar'),
                'unread_msgs': __('You have unread messages')
            })), form_container);
        this.el.addEventListener('focusin', ev => this.emitFocused(ev));
        this.el.addEventListener('focusout', ev => this.emitBlurred(ev));
        this.renderToolbar();
    },

    showControlBox () {
        // Used in mobile view, to navigate back to the controlbox
        _converse.chatboxviews.get('controlbox')?.show();
        this.hide();
    },

    showUserDetailsModal (ev) {
        ev.preventDefault();
        if (this.user_details_modal === undefined) {
            this.user_details_modal = new _converse.UserDetailsModal({model: this.model});
        }
        this.user_details_modal.show(ev);
    },

    onDragOver (evt) {
        evt.preventDefault();
    },

    onDrop (evt) {
        if (evt.dataTransfer.files.length == 0) {
            // There are no files to be dropped, so this isn’t a file
            // transfer operation.
            return;
        }
        evt.preventDefault();
        this.model.sendFiles(evt.dataTransfer.files);
    },

    async renderHeading () {
        const tpl = await this.generateHeadingTemplate();
        render(tpl, this.el.querySelector('.chat-head-chatbox'));
    },

    async getHeadingStandaloneButton (promise_or_data) {
        const data = await promise_or_data;
        return html`<a href="#"
            class="chatbox-btn ${data.a_class} fa ${data.icon_class}"
            @click=${data.handler}
            title="${data.i18n_title}"></a>`;
    },

    async getHeadingDropdownItem (promise_or_data) {
        const data = await promise_or_data;
        return html`<a href="#"
            class="dropdown-item ${data.a_class}"
            @click=${data.handler}
            title="${data.i18n_title}"><i class="fa ${data.icon_class}"></i>${data.i18n_text}</a>`;
    },

    async generateHeadingTemplate () {
        const vcard = this.model?.vcard;
        const vcard_json = vcard ? vcard.toJSON() : {};
        const heading_btns = await this.getHeadingButtons();
        const standalone_btns = heading_btns.filter(b => b.standalone);
        const dropdown_btns = heading_btns.filter(b => !b.standalone);
        return tpl_chatbox_head(
            Object.assign(
                vcard_json,
                this.model.toJSON(), {
                    '_converse': _converse,
                    'dropdown_btns': dropdown_btns.map(b => this.getHeadingDropdownItem(b)),
                    'standalone_btns': standalone_btns.map(b => this.getHeadingStandaloneButton(b)),
                    'display_name': this.model.getDisplayName()
                }
            )
        );
    },

    /**
     * Returns a list of objects which represent buttons for the chat's header.
     * @async
     * @emits _converse#getHeadingButtons
     * @private
     * @method _converse.ChatBoxView#getHeadingButtons
     */
    getHeadingButtons () {
        const buttons = [{
            'a_class': 'show-user-details-modal',
            'handler': ev => this.showUserDetailsModal(ev),
            'i18n_text': __('Details'),
            'i18n_title': __('See more information about this person'),
            'icon_class': 'fa-id-card',
            'name': 'details',
            'standalone': api.settings.get("view_mode") === 'overlayed',
        }];
        if (!api.settings.get("singleton")) {
            buttons.push({
                'a_class': 'close-chatbox-button',
                'handler': ev => this.close(ev),
                'i18n_text': __('Close'),
                'i18n_title': __('Close and end this conversation'),
                'icon_class': 'fa-times',
                'name': 'close',
                'standalone': api.settings.get("view_mode") === 'overlayed',
            });
        }
        /**
         * *Hook* which allows plugins to add more buttons to a chat's heading.
         * @event _converse#getHeadingButtons
         */
        return _converse.api.hook('getHeadingButtons', this, buttons);
    },

    getToolbarOptions () {
        //  FIXME: can this be removed?
        return {};
    },

    /**
     * Scrolls the chat down, *if* appropriate.
     *
     * Will only scroll down if we have received a message from
     * ourselves, or if the chat was scrolled down before (i.e. the
     * `scrolled` flag is `false`);
     * @param { _converse.Message|_converse.ChatRoomMessage } [message]
     *  - An optional message that serves as the cause for needing to scroll down.
     */
    maybeScrollDown (message) {
        const new_own_msg = !(message?.get('is_archived')) && message?.get('sender') === 'me';
        if ((new_own_msg || !this.model.get('scrolled')) && !this.model.isHidden()) {
            this.debouncedScrollDown();
        }
    },

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
                'scrollTop': null,
            });
        }
        if (this.msgs_container.scrollTo) {
            const behavior = this.msgs_container.scrollTop ? 'smooth' : 'auto';
            this.msgs_container.scrollTo({'top': this.msgs_container.scrollHeight, behavior});
        } else {
            this.msgs_container.scrollTop = this.msgs_container.scrollHeight;
        }
        this.onScrolledDown();
    },

    /**
     * Scroll to the previously saved scrollTop position, or scroll
     * down if it wasn't set.
     */
    maintainScrollTop () {
        const pos = this.model.get('scrollTop');
        if (pos) {
            this.msgs_container.scrollTop = pos;
        } else {
            this.scrollDown();
        }
    },

    insertIntoDOM () {
        _converse.chatboxviews.insertRowColumn(this.el);
        /**
         * Triggered once the _converse.ChatBoxView has been inserted into the DOM
         * @event _converse#chatBoxInsertedIntoDOM
         * @type { _converse.ChatBoxView | _converse.HeadlinesBoxView }
         * @example _converse.api.listen.on('chatBoxInsertedIntoDOM', view => { ... });
         */
        api.trigger('chatBoxInsertedIntoDOM', this);
        return this;
    },

    addSpinner (append=false) {
        if (this.el.querySelector('.spinner') === null) {
            const el = u.getElementFromTemplateResult(tpl_spinner());
            if (append) {
                this.content.insertAdjacentElement('beforeend', el);
                this.scrollDown();
            } else {
                this.content.insertAdjacentElement('afterbegin', el);
            }
        }
    },

    clearSpinner () {
        this.content.querySelectorAll('.spinner').forEach(u.removeElement);
    },

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
    },

    /**
     * Given a message element, determine wether it should be
     * marked as a followup message to the previous element.
     *
     * Also determine whether the element following it is a
     * followup message or not.
     *
     * Followup messages are subsequent ones written by the same
     * author with no other conversation elements in between and
     * which were posted within 10 minutes of one another.
     * @private
     * @method _converse.ChatBoxView#markFollowups
     * @param { HTMLElement } el - The message element
     */
    markFollowups (el) {
        const from = el.getAttribute('data-from');
        const previous_el = el.previousElementSibling;
        const date = dayjs(el.getAttribute('data-isodate'));
        const next_el = el.nextElementSibling;

        if (!u.hasClass('chat-msg--action', el) && !u.hasClass('chat-msg--action', previous_el) &&
                !u.hasClass('chat-info', el) && !u.hasClass('chat-info', previous_el) &&
                previous_el.getAttribute('data-from') === from &&
                date.isBefore(dayjs(previous_el.getAttribute('data-isodate')).add(10, 'minutes')) &&
                el.getAttribute('data-encrypted') === previous_el.getAttribute('data-encrypted')) {
            u.addClass('chat-msg--followup', el);
        }
        if (!next_el) { return; }

        if (!u.hasClass('chat-msg--action', el) && u.hasClass('chat-info', el) &&
                next_el.getAttribute('data-from') === from &&
                dayjs(next_el.getAttribute('data-isodate')).isBefore(date.add(10, 'minutes')) &&
                el.getAttribute('data-encrypted') === next_el.getAttribute('data-encrypted')) {
            u.addClass('chat-msg--followup', next_el);
        } else {
            u.removeClass('chat-msg--followup', next_el);
        }
    },

    parseMessageForCommands (text) {
        const match = text.replace(/^\s*/, "").match(/^\/(.*)\s*$/);
        if (match) {
            if (match[1] === "clear") {
                this.clearMessages();
                return true;
            } else if (match[1] === "close") {
                this.close();
                return true;
            } else if (match[1] === "help") {
                this.model.set({'show_help_messages': true});
                return true;
            }
        }
    },

    async onFormSubmitted (ev) {
        ev.preventDefault();
        const textarea = this.el.querySelector('.chat-textarea');
        const message_text = textarea.value.trim();
        if (api.settings.get('message_limit') && message_text.length > api.settings.get('message_limit') ||
                !message_text.replace(/\s/g, '').length) {
            return;
        }
        if (!_converse.connection.authenticated) {
            const err_msg = __('Sorry, the connection has been lost, and your message could not be sent');
            api.alert('error', __('Error'), err_msg);
            api.connection.reconnect();
            return;
        }
        let spoiler_hint, hint_el = {};
        if (this.model.get('composing_spoiler')) {
            hint_el = this.el.querySelector('form.sendXMPPMessage input.spoiler-hint');
            spoiler_hint = hint_el.value;
        }
        u.addClass('disabled', textarea);
        textarea.setAttribute('disabled', 'disabled');
        this.el.querySelector('converse-emoji-dropdown')?.hideMenu();

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
        if (api.settings.get("view_mode") === 'overlayed') {
            // XXX: Chrome flexbug workaround. The .chat-content area
            // doesn't resize when the textarea is resized to its original size.
            this.msgs_container.parentElement.style.display = 'none';
        }
        textarea.removeAttribute('disabled');
        u.removeClass('disabled', textarea);

        if (api.settings.get("view_mode") === 'overlayed') {
            // XXX: Chrome flexbug workaround.
            this.msgs_container.parentElement.style.display = '';
        }
        // Suppress events, otherwise superfluous CSN gets set
        // immediately after the message, causing rate-limiting issues.
        this.model.setChatState(_converse.ACTIVE, {'silent': true});
        textarea.focus();
    },

    updateCharCounter (chars) {
        if (api.settings.get('message_limit')) {
            const message_limit = this.el.querySelector('.message-limit');
            const counter = api.settings.get('message_limit') - chars.length;
            message_limit.textContent = counter;
            if (counter < 1) {
                u.addClass('error', message_limit);
            } else {
                u.removeClass('error', message_limit);
            }
        }
    },

    onPaste (ev) {
        if (ev.clipboardData.files.length !== 0) {
            ev.preventDefault();
            // Workaround for quirk in at least Firefox 60.7 ESR:
            // It seems that pasted files disappear from the event payload after
            // the event has finished, which apparently happens during async
            // processing in sendFiles(). So we copy the array here.
            this.model.sendFiles(Array.from(ev.clipboardData.files));
            return;
        }
        this.updateCharCounter(ev.clipboardData.getData('text/plain'));
    },

    autocompleteInPicker (input, value) {
        const emoji_dropdown = this.el.querySelector('converse-emoji-dropdown');
        const emoji_picker = this.el.querySelector('converse-emoji-picker');
        if (emoji_picker && emoji_dropdown) {
            emoji_picker.model.set({
                'ac_position': input.selectionStart,
                'autocompleting': value,
                'query': value
            });
            emoji_dropdown.showMenu();
            return true;
        }
    },

    onEmojiReceivedFromPicker (emoji) {
        const model = this.el.querySelector('converse-emoji-picker').model;
        const autocompleting = model.get('autocompleting');
        const ac_position = model.get('ac_position');
        this.insertIntoTextArea(emoji, autocompleting, false, ac_position);
    },

    /**
     * Event handler for when a depressed key goes up
     * @private
     * @method _converse.ChatBoxView#onKeyUp
     */
    onKeyUp (ev) {
        this.updateCharCounter(ev.target.value);
    },

    /**
     * Event handler for when a key is pressed down in a chat box textarea.
     * @private
     * @method _converse.ChatBoxView#onKeyDown
     * @param { Event } ev
     */
    onKeyDown (ev) {
        if (ev.ctrlKey) {
            // When ctrl is pressed, no chars are entered into the textarea.
            return;
        }
        if (!ev.shiftKey && !ev.altKey && !ev.metaKey) {
            if (ev.keyCode === converse.keycodes.TAB) {
                const value = u.getCurrentWord(ev.target, null, /(:.*?:)/g);
                if (value.startsWith(':') && this.autocompleteInPicker(ev.target, value)) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }
            } else if (ev.keyCode === converse.keycodes.FORWARD_SLASH) {
                // Forward slash is used to run commands. Nothing to do here.
                return;
            } else if (ev.keyCode === converse.keycodes.ESCAPE) {
                return this.onEscapePressed(ev);
            } else if (ev.keyCode === converse.keycodes.ENTER) {
                return this.onEnterPressed(ev);
            } else if (ev.keyCode === converse.keycodes.UP_ARROW && !ev.target.selectionEnd) {
                const textarea = this.el.querySelector('.chat-textarea');
                if (!textarea.value || u.hasClass('correcting', textarea)) {
                    return this.editEarlierMessage();
                }
            } else if (ev.keyCode === converse.keycodes.DOWN_ARROW &&
                    ev.target.selectionEnd === ev.target.value.length &&
                    u.hasClass('correcting', this.el.querySelector('.chat-textarea'))) {
                return this.editLaterMessage();
            }
        }
        if ([converse.keycodes.SHIFT,
                converse.keycodes.META,
                converse.keycodes.META_RIGHT,
                converse.keycodes.ESCAPE,
                converse.keycodes.ALT].includes(ev.keyCode)) {
            return;
        }
        if (this.model.get('chat_state') !== _converse.COMPOSING) {
            // Set chat state to composing if keyCode is not a forward-slash
            // (which would imply an internal command and not a message).
            this.model.setChatState(_converse.COMPOSING);
        }
    },

    getOwnMessages () {
        return this.model.messages.filter({'sender': 'me'});
    },

    onEnterPressed (ev) {
        return this.onFormSubmitted(ev);
    },

    onEscapePressed (ev) {
        ev.preventDefault();
        const idx = this.model.messages.findLastIndex('correcting');
        const message = idx >=0 ? this.model.messages.at(idx) : null;
        if (message) {
            message.save('correcting', false);
        }
        this.insertIntoTextArea('', true, false);
    },

    async onMessageRetractButtonClicked (message) {
        if (message.get('sender') !== 'me') {
            return log.error("onMessageRetractButtonClicked called for someone else's message!");
        }
        const retraction_warning =
            __("Be aware that other XMPP/Jabber clients (and servers) may "+
                "not yet support retractions and that this message may not "+
                "be removed everywhere.");

        const messages = [__('Are you sure you want to retract this message?')];
        if (api.settings.get('show_retraction_warning')) {
            messages[1] = retraction_warning;
        }
        const result = await api.confirm(__('Confirm'), messages);
        if (result) {
            this.model.retractOwnMessage(message);
        }
    },

    onMessageEditButtonClicked (message) {
        const currently_correcting = this.model.messages.findWhere('correcting');
        const unsent_text = this.el.querySelector('.chat-textarea')?.value;
        if (unsent_text && (!currently_correcting || currently_correcting.get('message') !== unsent_text)) {
            if (! confirm(__("You have an unsent message which will be lost if you continue. Are you sure?"))) {
                return;
            }
        }

        if (currently_correcting !== message) {
            currently_correcting?.save('correcting', false);
            message.save('correcting', true);
            this.insertIntoTextArea(u.prefixMentions(message), true, true);
        } else {
            message.save('correcting', false);
            this.insertIntoTextArea('', true, false);
        }
    },

    editLaterMessage () {
        let message;
        let idx = this.model.messages.findLastIndex('correcting');
        if (idx >= 0) {
            this.model.messages.at(idx).save('correcting', false);
            while (idx < this.model.messages.length-1) {
                idx += 1;
                const candidate = this.model.messages.at(idx);
                if (candidate.get('editable')) {
                    message = candidate;
                    break;
                }
            }
        }
        if (message) {
            this.insertIntoTextArea(u.prefixMentions(message), true, true);
            message.save('correcting', true);
        } else {
            this.insertIntoTextArea('', true, false);
        }
    },

    editEarlierMessage () {
        let message;
        let idx = this.model.messages.findLastIndex('correcting');
        if (idx >= 0) {
            this.model.messages.at(idx).save('correcting', false);
            while (idx > 0) {
                idx -= 1;
                const candidate = this.model.messages.at(idx);
                if (candidate.get('editable')) {
                    message = candidate;
                    break;
                }
            }
        }
        message = message || this.getOwnMessages().reverse().find(m => m.get('editable'));
        if (message) {
            this.insertIntoTextArea(u.prefixMentions(message), true, true);
            message.save('correcting', true);
        }
    },

    inputChanged (ev) {
        const height = ev.target.scrollHeight + 'px';
        if (ev.target.style.height != height) {
            ev.target.style.height = 'auto';
            ev.target.style.height = height;
        }
    },

    async clearMessages (ev) {
        if (ev && ev.preventDefault) { ev.preventDefault(); }
        const result = confirm(__("Are you sure you want to clear the messages from this conversation?"));
        if (result === true) {
            await this.model.clearMessages();
        }
        return this;
    },

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
    insertIntoTextArea (value, replace=false, correcting=false, position) {
        const textarea = this.el.querySelector('.chat-textarea');
        if (correcting) {
            u.addClass('correcting', textarea);
        } else {
            u.removeClass('correcting', textarea);
        }
        if (replace) {
            if (position && typeof replace == 'string') {
                textarea.value = textarea.value.replace(
                    new RegExp(replace, 'g'),
                    (match, offset) => (offset == position-replace.length ? value+' ' : match)
                );
            } else {
                textarea.value = value;
            }
        } else {
            let existing = textarea.value;
            if (existing && (existing[existing.length-1] !== ' ')) {
                existing = existing + ' ';
            }
            textarea.value = existing+value+' ';
        }
        this.updateCharCounter(textarea.value);
        u.placeCaretAtEnd(textarea);
    },

    onPresenceChanged (item) {
        const show = item.get('show');
        const fullname = this.model.getDisplayName();

        let text;
        if (u.isVisible(this.el)) {
            if (show === 'offline') {
                text = __('%1$s has gone offline', fullname);
            } else if (show === 'away') {
                text = __('%1$s has gone away', fullname);
            } else if ((show === 'dnd')) {
                text = __('%1$s is busy', fullname);
            } else if (show === 'online') {
                text = __('%1$s is online', fullname);
            }
            text && this.model.createMessage({'message': text, 'type': 'info'});
        }
    },

    async close (ev) {
        if (ev && ev.preventDefault) { ev.preventDefault(); }
        if (_converse.router.history.getFragment() === "converse/chat?jid="+this.model.get('jid')) {
            _converse.router.navigate('');
        }
        if (api.connection.connected()) {
            // Immediately sending the chat state, because the
            // model is going to be destroyed afterwards.
            this.model.setChatState(_converse.INACTIVE);
            this.model.sendChatState();
        }
        await this.model.close();
        this.remove();
        /**
         * Triggered once a chatbox has been closed.
         * @event _converse#chatBoxClosed
         * @type { _converse.ChatBoxView | _converse.ChatRoomView }
         * @example _converse.api.listen.on('chatBoxClosed', view => { ... });
         */
        api.trigger('chatBoxClosed', this);
        return this;
    },

    emitBlurred (ev) {
        if (this.el.contains(document.activeElement) || this.el.contains(ev.relatedTarget)) {
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
    },

    emitFocused (ev) {
        if (this.el.contains(ev.relatedTarget)) {
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
    },

    focus () {
        const textarea_el = this.el.getElementsByClassName('chat-textarea')[0];
        if (textarea_el && document.activeElement !== textarea_el) {
            textarea_el.focus();
        }
        return this;
    },

    maybeFocus () {
        api.settings.get('auto_focus') && this.focus();
    },

    hide () {
        this.el.classList.add('hidden');
        return this;
    },

    afterShown () {
        this.model.clearUnreadMsgCounter();
        this.model.setChatState(_converse.ACTIVE);
        this.scrollDown();
        this.maybeFocus();
    },

    show () {
        if (this.model.get('hidden')) {
            log.debug(`Not showing chat ${this.model.get('jid')} because it's set as hidden`);
            return;
        }
        if (u.isVisible(this.el)) {
            this.maybeFocus();
            return;
        }
        if (api.settings.get('animate')) {
            u.fadeIn(this.el, () => this.afterShown());
        } else {
            u.showElement(this.el);
            this.afterShown();
        }
    },

    showNewMessagesIndicator () {
        u.showElement(this.el.querySelector('.new-msgs-indicator'));
    },

    hideNewMessagesIndicator () {
        const new_msgs_indicator = this.el.querySelector('.new-msgs-indicator');
        if (new_msgs_indicator !== null) {
            new_msgs_indicator.classList.add('hidden');
        }
    },

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
    _markScrolled: function (ev) {
        let scrolled = true;
        let scrollTop = null;
        const is_at_bottom =
            (this.msgs_container.scrollTop + this.msgs_container.clientHeight) >=
                this.msgs_container.scrollHeight - 62; // sigh...

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
    },

    viewUnreadMessages () {
        this.model.save({'scrolled': false, 'scrollTop': null});
        this.scrollDown();
    },

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
        api.trigger('chatBoxScrolledDown', {'chatbox': this.model}); // TODO: clean up
    },

    onWindowStateChanged (state) {
        if (state === 'visible') {
            if (!this.model.isHidden()) {
                // this.model.setChatState(_converse.ACTIVE);
                if (this.model.get('num_unread', 0)) {
                    this.model.clearUnreadMsgCounter();
                }
            }
        } else if (state === 'hidden') {
            this.model.setChatState(_converse.INACTIVE, {'silent': true});
            this.model.sendChatState();
        }
    }
});


converse.plugins.add('converse-chatview', {
    /* Plugin dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin.
     *
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found. By default it's
     * false, which means these plugins are only loaded opportunistically.
     *
     * NB: These plugins need to have already been loaded via require.js.
     */
    dependencies: [
        "converse-chatboxviews",
        "converse-chat",
        "converse-disco",
        "converse-modal"
    ],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        api.settings.extend({
            'auto_focus': true,
            'debounced_content_rendering': true,
            'filter_url_query_params': null,
            'image_urls_regex': null,
            'message_limit': 0,
            'muc_hats': ['xep317'],
            'show_images_inline': true,
            'show_message_avatar': true,
            'show_retraction_warning': true,
            'show_send_button': true,
            'show_toolbar': true,
            'time_format': 'HH:mm',
            'use_system_emojis': true,
            'visible_toolbar_buttons': {
                'call': false,
                'clear': true,
                'emoji': true,
                'spoiler': true
            },
        });

        _converse.ChatBoxView = ChatBoxView;


        _converse.UserDetailsModal = BootstrapModal.extend({
            id: "user-details-modal",

            events: {
                'click button.refresh-contact': 'refreshContact',
                'click .fingerprint-trust .btn input': 'toggleDeviceTrust'
            },

            initialize () {
                BootstrapModal.prototype.initialize.apply(this, arguments);
                this.model.rosterContactAdded.then(() => this.registerContactEventHandlers());
                this.listenTo(this.model, 'change', this.render);
                this.registerContactEventHandlers();
                /**
                 * Triggered once the _converse.UserDetailsModal has been initialized
                 * @event _converse#userDetailsModalInitialized
                 * @type { _converse.ChatBox }
                 * @example _converse.api.listen.on('userDetailsModalInitialized', chatbox => { ... });
                 */
                api.trigger('userDetailsModalInitialized', this.model);
            },

            toHTML () {
                const vcard = this.model?.vcard;
                const vcard_json = vcard ? vcard.toJSON() : {};
                return tpl_user_details_modal(Object.assign(
                    this.model.toJSON(),
                    vcard_json, {
                    '_converse': _converse,
                    'allow_contact_removal': api.settings.get('allow_contact_removal'),
                    'display_name': this.model.getDisplayName(),
                    'is_roster_contact': this.model.contact !== undefined,
                    'removeContact': ev => this.removeContact(ev),
                    'view': this,
                    'utils': u
                }));
            },

            registerContactEventHandlers () {
                if (this.model.contact !== undefined) {
                    this.listenTo(this.model.contact, 'change', this.render);
                    this.listenTo(this.model.contact.vcard, 'change', this.render);
                    this.model.contact.on('destroy', () => {
                        delete this.model.contact;
                        this.render();
                    });
                }
            },

            async refreshContact (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                const refresh_icon = this.el.querySelector('.fa-refresh');
                u.addClass('fa-spin', refresh_icon);
                try {
                    await api.vcard.update(this.model.contact.vcard, true);
                } catch (e) {
                    log.fatal(e);
                    this.alert(__('Sorry, something went wrong while trying to refresh'), 'danger');
                }
                u.removeClass('fa-spin', refresh_icon);
            },

            removeContact (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                if (!api.settings.get('allow_contact_removal')) { return; }
                const result = confirm(__("Are you sure you want to remove this contact?"));
                if (result === true) {
                    this.modal.hide();
                    // XXX: This is annoying but necessary to get tests to pass.
                    // The `dismissHandler` in bootstrap.native tries to
                    // reference the remove button after it's been cleared from
                    // the DOM, so we delay removing the contact to give it time.
                    setTimeout(() => {
                        this.model.contact.removeFromRoster(
                            () => this.model.contact.destroy(),
                            (err) => {
                                log.error(err);
                                api.alert('error', __('Error'), [
                                    __('Sorry, there was an error while trying to remove %1$s as a contact.',
                                    this.model.contact.getDisplayName())
                                ]);
                            }
                        );
                    }, 1);
                }
            },
        });


        api.listen.on('chatBoxViewsInitialized', () => {
            const views = _converse.chatboxviews;
            _converse.chatboxes.on('add', async item => {
                if (!views.get(item.get('id')) && item.get('type') === _converse.PRIVATE_CHAT_TYPE) {
                    await item.initialized;
                    views.add(item.get('id'), new _converse.ChatBoxView({model: item}));
                }
            });
        });


        /************************ BEGIN Event Handlers ************************/
        function onWindowStateChanged (data) {
            if (_converse.chatboxviews) {
                _converse.chatboxviews.forEach(view => {
                    if (view.model.get('id') !== 'controlbox') {
                        view.onWindowStateChanged(data.state);
                    }
                });
            }
        }
        api.listen.on('windowStateChanged', onWindowStateChanged);
        api.listen.on('connected', () => api.disco.own.features.add(Strophe.NS.SPOILER));
        /************************ END Event Handlers ************************/


        /************************ BEGIN API ************************/
        Object.assign(api, {
            /**
             * The "chatview" namespace groups methods pertaining to views
             * for one-on-one chats.
             *
             * @namespace _converse.api.chatviews
             * @memberOf _converse.api
             */
            chatviews: {
                 /**
                  * Get the view of an already open chat.
                  * @method _converse.api.chatviews.get
                  * @param { Array.string | string } jids
                  * @returns { _converse.ChatBoxView|undefined }  The chat should already be open, otherwise `undefined` will be returned.
                  * @example
                  * // To return a single view, provide the JID of the contact:
                  * _converse.api.chatviews.get('buddy@example.com')
                  * @example
                  * // To return an array of views, provide an array of JIDs:
                  * _converse.api.chatviews.get(['buddy1@example.com', 'buddy2@example.com'])
                  */
                get (jids) {
                    if (jids === undefined) {
                        return Object.values(_converse.chatboxviews.getAll());
                    }
                    if (typeof jids === 'string') {
                        return _converse.chatboxviews.get(jids);
                    }
                    return jids.map(jid => _converse.chatboxviews.get(jid));
                }
            }
        });
        /************************ END API ************************/
    }
});
