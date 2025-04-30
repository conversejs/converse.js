/**
 * @typedef {import('shared/chat/emoji-picker.js').default} EmojiPicker
 * @typedef {import('shared/chat/emoji-dropdown.js').default} EmojiDropdown
 * @typedef {import('./message-form.js').default} MessageForm
 */
import { _converse, api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplBottomPanel from './templates/bottom-panel.js';
import { clearMessages } from './utils.js';
import './message-form.js';

import './styles/chat-bottom-panel.scss';

export default class ChatBottomPanel extends CustomElement {
    constructor() {
        super();
        this.model = null;
    }

    static get properties() {
        return {
            model: { type: Object },
        };
    }

    async connectedCallback() {
        super.connectedCallback();
        await this.initialize();
        // Don't call in initialize, since the MUCBottomPanel subclasses it
        // and we want to render after it has finished as well.
        this.requestUpdate();
    }

    async initialize() {
        await this.model.initialized;
        this.listenTo(this.model, 'change:num_unread', () => this.requestUpdate());
        this.listenTo(this.model, 'emoji-picker-autocomplete', this.autocompleteInPicker);

        this.addEventListener('click', (ev) => this.sendButtonClicked(ev));
        this.addEventListener('emojipickerblur', () =>
            /** @type {HTMLElement} */ (this.querySelector('.chat-textarea')).focus()
        );
    }

    render() {
        if (!this.model) return '';
        return tplBottomPanel({
            'model': this.model,
            'viewUnreadMessages': (ev) => this.viewUnreadMessages(ev),
        });
    }

    sendButtonClicked(ev) {
        if (ev.delegateTarget?.dataset.action === 'sendMessage') {
            const form = /** @type {MessageForm} */ (this.querySelector('converse-message-form'));
            form?.onFormSubmitted(ev);
        }
    }

    viewUnreadMessages(ev) {
        ev?.preventDefault?.();
        this.model.ui.set({ 'scrolled': false });
    }

    onDragOver(ev) {
        ev.preventDefault();
    }

    clearMessages(ev) {
        ev?.preventDefault?.();
        clearMessages(this.model);
    }

    /**
     * @typedef {Object} AutocompleteInPickerEvent
     * @property {HTMLTextAreaElement} target
     * @property {string} value
     * @param {AutocompleteInPickerEvent} ev
     */
    async autocompleteInPicker(ev) {
        const { target: input, value } = ev;
        await api.emojis.initialize();
        const emoji_picker = /** @type {EmojiPicker} */ (this.querySelector('converse-emoji-picker'));
        if (emoji_picker) {
            emoji_picker.state.set({
                ac_position: input.selectionStart,
                autocompleting: value,
                query: value,
            });
            const emoji_dropdown = /** @type {EmojiDropdown} */ (this.querySelector('converse-emoji-dropdown'));
            emoji_dropdown?.dropdown.show();
        }
    }
}

api.elements.define('converse-chat-bottom-panel', ChatBottomPanel);
