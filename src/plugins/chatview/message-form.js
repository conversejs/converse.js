import tpl_message_form from './templates/message-form.js';
import { ElementView } from '@converse/skeletor/src/element.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";
import { parseMessageForCommands } from './utils.js';

const { u } = converse.env;


export default class MessageForm extends ElementView {

    async connectedCallback () {
        super.connectedCallback();
        this.model = _converse.chatboxes.get(this.getAttribute('jid'));
        await this.model.initialized;
        this.listenTo(this.model.messages, 'change:correcting', this.onMessageCorrecting);
        this.render();
    }

    toHTML () {
        return tpl_message_form(
            Object.assign(this.model.toJSON(), {
                'onDrop': ev => this.onDrop(ev),
                'hint_value': this.querySelector('.spoiler-hint')?.value,
                'message_value': this.querySelector('.chat-textarea')?.value,
                'onChange': ev => this.model.set({'draft': ev.target.value}),
                'onKeyDown': ev => this.onKeyDown(ev),
                'onKeyUp': ev => this.onKeyUp(ev),
                'onPaste': ev => this.onPaste(ev),
                'viewUnreadMessages': ev => this.viewUnreadMessages(ev)
            })
        );
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
        textarea.dispatchEvent(ev);
        u.placeCaretAtEnd(textarea);
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

    onEscapePressed (ev) {
        ev.preventDefault();
        const idx = this.model.messages.findLastIndex('correcting');
        const message = idx >= 0 ? this.model.messages.at(idx) : null;
        if (message) {
            message.save('correcting', false);
        }
        this.insertIntoTextArea('', true, false);
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
        this.model.set({'draft': ev.clipboardData.getData('text/plain')});
    }

    onKeyUp (ev) {
        this.model.set({'draft': ev.target.value});
    }

    onKeyDown (ev) {
        if (ev.ctrlKey) {
            // When ctrl is pressed, no chars are entered into the textarea.
            return;
        }
        if (!ev.shiftKey && !ev.altKey && !ev.metaKey) {
            if (ev.keyCode === converse.keycodes.TAB) {
                const value = u.getCurrentWord(ev.target, null, /(:.*?:)/g);
                if (value.startsWith(':')) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    this.model.trigger('emoji-picker-autocomplete', ev.target, value);
                }
            } else if (ev.keyCode === converse.keycodes.FORWARD_SLASH) {
                // Forward slash is used to run commands. Nothing to do here.
                return;
            } else if (ev.keyCode === converse.keycodes.ESCAPE) {
                return this.onEscapePressed(ev, this);
            } else if (ev.keyCode === converse.keycodes.ENTER) {
                return this.onFormSubmitted(ev);
            } else if (ev.keyCode === converse.keycodes.UP_ARROW && !ev.target.selectionEnd) {
                const textarea = this.querySelector('.chat-textarea');
                if (!textarea.value || u.hasClass('correcting', textarea)) {
                    return this.model.editEarlierMessage();
                }
            } else if (
                ev.keyCode === converse.keycodes.DOWN_ARROW &&
                ev.target.selectionEnd === ev.target.value.length &&
                u.hasClass('correcting', this.querySelector('.chat-textarea'))
            ) {
                return this.model.editLaterMessage();
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

        const is_command = await parseMessageForCommands(this.model, message_text);
        const message = is_command ? null : await this.model.sendMessage({'body': message_text, spoiler_hint});
        if (is_command || message) {
            hint_el.value = '';
            textarea.value = '';
            u.removeClass('correcting', textarea);
            textarea.style.height = 'auto';
            this.model.set({'draft': ''});
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
}

api.elements.define('converse-message-form', MessageForm);
