/**
 * @typedef {import('shared/chat/emoji-picker.js').default} EmojiPicker
 * @typedef {import('shared/chat/emoji-dropdown.js').default} EmojiDropdown
 * @typedef {import('./message-form.js').default} MessageForm
 */
import './message-form.js';
import tplBottomPanel from './templates/bottom-panel.js';
import { CustomElement } from 'shared/components/element.js';
import { _converse, api } from '@converse/headless';
import { clearMessages } from './utils.js';

import './styles/chat-bottom-panel.scss';


export default class ChatBottomPanel extends CustomElement {

    async connectedCallback () {
        super.connectedCallback();
        await this.initialize();
        // Don't call in initialize, since the MUCBottomPanel subclasses it
        // and we want to render after it has finished as well.
        this.requestUpdate();
    }

    async initialize () {
        this.model = await api.chatboxes.get(this.getAttribute('jid'));
        await this.model.initialized;
        this.listenTo(this.model, 'change:num_unread', () => this.requestUpdate());
        this.listenTo(this.model, 'emoji-picker-autocomplete', this.autocompleteInPicker);

        this.addEventListener('focusin', ev => this.emitFocused(ev));
        this.addEventListener('focusout', ev => this.emitBlurred(ev));
        this.addEventListener('click', ev => this.sendButtonClicked(ev));
    }

    render () {
        if (!this.model) return '';
        return tplBottomPanel({
            'model': this.model,
            'viewUnreadMessages': ev => this.viewUnreadMessages(ev)
        });
    }

    sendButtonClicked (ev) {
        if (ev.delegateTarget?.dataset.action === 'sendMessage') {
            const form = /** @type {MessageForm} */(this.querySelector('converse-message-form'));
            form?.onFormSubmitted(ev);
        }
    }

    viewUnreadMessages (ev) {
        ev?.preventDefault?.();
        this.model.ui.set({ 'scrolled': false });
    }

    emitFocused (ev) {
        const { chatboxviews } = _converse.state;
        chatboxviews.get(this.getAttribute('jid'))?.emitFocused(ev);
    }

    emitBlurred (ev) {
        const { chatboxviews } = _converse.state;
        chatboxviews.get(this.getAttribute('jid'))?.emitBlurred(ev);
    }

    onDragOver (ev) { // eslint-disable-line class-methods-use-this
        ev.preventDefault();
    }

    clearMessages (ev) {
        ev?.preventDefault?.();
        clearMessages(this.model);
    }

    async autocompleteInPicker (input, value) {
        await api.emojis.initialize();
        const emoji_picker = /** @type {EmojiPicker} */(this.querySelector('converse-emoji-picker'));
        if (emoji_picker) {
            emoji_picker.model.set({
                'ac_position': input.selectionStart,
                'autocompleting': value,
                'query': value
            });
            const emoji_dropdown = /** @type {EmojiDropdown} */(this.querySelector('converse-emoji-dropdown'));
            emoji_dropdown?.showMenu();
        }
    }
}

api.elements.define('converse-chat-bottom-panel', ChatBottomPanel);
