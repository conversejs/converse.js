import tpl_chatbox_message_form from './templates/chatbox_message_form.js';
import tpl_toolbar from './templates/toolbar.js';
import { ElementView } from '@converse/skeletor/src/element.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";
import { html, render } from 'lit-html';
import { clearMessages, parseMessageForCommands } from './utils.js';

const { u } = converse.env;

export default class ChatBottomPanel extends ElementView {

    events = {
        'click .send-button': 'onFormSubmitted',
        'click .toggle-clear': 'clearMessages',
    }

    async connectedCallback () {
        super.connectedCallback();
        this.model = _converse.chatboxes.get(this.getAttribute('jid'));
        this.listenTo(this.model, 'change:composing_spoiler', this.renderMessageForm);
        await this.model.initialized;
        this.listenTo(this.model.messages, 'change:correcting', this.onMessageCorrecting);
        this.render();
        api.listen.on('chatBoxScrolledDown', () => this.hideNewMessagesIndicator());
    }

    render () {
        render(html`<div class="message-form-container"></div>`, this);
        this.renderMessageForm();
    }

    renderToolbar () {
        if (!api.settings.get('show_toolbar')) {
            return this;
        }
        const options = Object.assign({
                'model': this.model,
                'chatview': _converse.chatboxviews.get(this.getAttribute('jid'))
            },
            this.model.toJSON(),
            this.getToolbarOptions()
        );
        render(tpl_toolbar(options), this.querySelector('.chat-toolbar'));
        /**
         * Triggered once the _converse.ChatBoxView's toolbar has been rendered
         * @event _converse#renderToolbar
         * @type { _converse.ChatBoxView }
         * @example _converse.api.listen.on('renderToolbar', this => { ... });
         */
        api.trigger('renderToolbar', this);
        return this;
    }

    renderMessageForm () {
        const form_container = this.querySelector('.message-form-container');
        render(
            tpl_chatbox_message_form(
                Object.assign(this.model.toJSON(), {
                    'onDrop': ev => this.onDrop(ev),
                    'inputChanged': ev => this.inputChanged(ev),
                    'onKeyDown': ev => this.onKeyDown(ev),
                    'onKeyUp': ev => this.onKeyUp(ev),
                    'onPaste': ev => this.onPaste(ev),
                    'onChange': ev => this.updateCharCounter(ev.target.value),
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

    hideNewMessagesIndicator () {
        this.querySelector('.new-msgs-indicator')?.classList.add('hidden');
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

    emitFocused (ev) {
        _converse.chatboxviews.get(this.getAttribute('jid'))?.emitFocused(ev);
    }

    emitBlurred (ev) {
        _converse.chatboxviews.get(this.getAttribute('jid'))?.emitBlurred(ev);
    }

    getToolbarOptions () { // eslint-disable-line class-methods-use-this
        return {};
    }

    inputChanged (ev) { // eslint-disable-line class-methods-use-this
        if (ev.target.value) {
            const height = ev.target.scrollHeight + 'px';
            if (ev.target.style.height != height) {
                ev.target.style.height = 'auto';
                ev.target.style.height = height;
            }
        } else {
            ev.target.style = '';
        }
    }

    onDrop (evt) {
        if (evt.dataTransfer.files.length == 0) {
            // There are no files to be dropped, so this isn’t a file
            // transfer operation.
            return;
        }
        evt.preventDefault();
        this.model.sendFiles(evt.dataTransfer.files);
    }

    onDragOver (ev) { // eslint-disable-line class-methods-use-this
        ev.preventDefault();
    }

    clearMessages (ev) {
        ev?.preventDefault?.();
        clearMessages(this.model);
    }

    parseMessageForCommands (text) {
        return parseMessageForCommands(this.model, text);
    }

    async onFormSubmitted (ev) {
        ev?.preventDefault?.();

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
            const chatview = _converse.chatboxviews.get(this.getAttribute('jid'));
            const msgs_container = chatview.querySelector('.chat-content__messages');
            msgs_container.parentElement.style.display = 'none';
        }
        textarea.removeAttribute('disabled');
        u.removeClass('disabled', textarea);

        if (api.settings.get('view_mode') === 'overlayed') {
            // XXX: Chrome flexbug workaround.
            const chatview = _converse.chatboxviews.get(this.getAttribute('jid'));
            const msgs_container = chatview.querySelector('.chat-content__messages');
            msgs_container.parentElement.style.display = '';
        }
        // Suppress events, otherwise superfluous CSN gets set
        // immediately after the message, causing rate-limiting issues.
        this.model.setChatState(_converse.ACTIVE, { 'silent': true });
        textarea.focus();
    }

    /**
     * Insert a particular string value into the textarea of this chat box.
     * @param {string} value - The value to be inserted.
     * @param {(boolean|string)} [replace] - Whether an existing value
     *  should be replaced. If set to `true`, the entire textarea will
     *  be replaced with the new value. If set to a string, then only
     *  that string will be replaced *if* a position is also specified.
     * @param {integer} [position] - The end index of the string to be
     *  replaced with the new value.
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
        const ev = document.createEvent('HTMLEvents');
        ev.initEvent('change', false, true);
        textarea.dispatchEvent(ev)
        u.placeCaretAtEnd(textarea);
    }

    onEscapePressed (ev) {
        ev.preventDefault();
        const idx = this.model.messages.findLastIndex('correcting');
        const message = idx >= 0 ? this.model.messages.at(idx) : null;
        if (message) {
            message.save('correcting', false);
        }
        this.insertIntoTextArea('', true, false);
    }

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
        message =
            message ||
            this.model.messages.filter({ 'sender': 'me' })
                .reverse()
                .find(m => m.get('editable'));
        if (message) {
            message.save('correcting', true);
        }
    }

    editLaterMessage () {
        let message;
        let idx = this.model.messages.findLastIndex('correcting');
        if (idx >= 0) {
            this.model.messages.at(idx).save('correcting', false);
            while (idx < this.model.messages.length - 1) {
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
                return this.onEscapePressed(ev, this);
            } else if (ev.keyCode === converse.keycodes.ENTER) {
                return this.onFormSubmitted();
            } else if (ev.keyCode === converse.keycodes.UP_ARROW && !ev.target.selectionEnd) {
                const textarea = this.querySelector('.chat-textarea');
                if (!textarea.value || u.hasClass('correcting', textarea)) {
                    return this.editEarlierMessage();
                }
            } else if (
                ev.keyCode === converse.keycodes.DOWN_ARROW &&
                ev.target.selectionEnd === ev.target.value.length &&
                u.hasClass('correcting', this.querySelector('.chat-textarea'))
            ) {
                return this.editLaterMessage();
            }
        }
        if (
            [
                converse.keycodes.SHIFT,
                converse.keycodes.META,
                converse.keycodes.META_RIGHT,
                converse.keycodes.ESCAPE,
                converse.keycodes.ALT
            ].includes(ev.keyCode)
        ) {
            return;
        }
        if (this.model.get('chat_state') !== _converse.COMPOSING) {
            // Set chat state to composing if keyCode is not a forward-slash
            // (which would imply an internal command and not a message).
            this.model.setChatState(_converse.COMPOSING);
        }
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

    onKeyUp (ev) {
        this.updateCharCounter(ev.target.value);
    }

    onPaste (ev) {
        ev.stopPropagation();
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
    }
}

api.elements.define('converse-chat-bottom-panel', ChatBottomPanel);
