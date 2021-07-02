import './message-form.js';
import debounce from 'lodash-es/debounce';
import tpl_bottom_panel from './templates/bottom-panel.js';
import { ElementView } from '@converse/skeletor/src/element.js';
import { _converse, api } from '@converse/headless/core';
import { clearMessages } from './utils.js';
import { render } from 'lit';

import './styles/chat-bottom-panel.scss';


export default class ChatBottomPanel extends ElementView {
    events = {
        'click .send-button': 'sendButtonClicked',
        'click .toggle-clear': 'clearMessages'
    };

    constructor () {
        super();
        this.debouncedRender = debounce(this.render, 100);
    }

    async connectedCallback () {
        super.connectedCallback();
        await this.initialize();
        this.render(); // don't call in initialize, since the MUCBottomPanel subclasses it
                       // and we want to render after it has finished as wel.
    }

    async initialize () {
        this.model = await api.chatboxes.get(this.getAttribute('jid'));
        await this.model.initialized;
        this.listenTo(this.model, 'change:num_unread', this.debouncedRender)
        this.listenTo(this.model, 'emoji-picker-autocomplete', this.autocompleteInPicker);

        this.addEventListener('focusin', ev => this.emitFocused(ev));
        this.addEventListener('focusout', ev => this.emitBlurred(ev));
    }

    render () {
        render(tpl_bottom_panel({
            'model': this.model,
            'viewUnreadMessages': ev => this.viewUnreadMessages(ev)
        }), this);
    }

    sendButtonClicked (ev) {
        this.querySelector('converse-message-form')?.onFormSubmitted(ev);
    }

    viewUnreadMessages (ev) {
        ev?.preventDefault?.();
        this.model.ui.set({ 'scrolled': false });
    }

    emitFocused (ev) {
        _converse.chatboxviews.get(this.getAttribute('jid'))?.emitFocused(ev);
    }

    emitBlurred (ev) {
        _converse.chatboxviews.get(this.getAttribute('jid'))?.emitBlurred(ev);
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

    async autocompleteInPicker (input, value) {
        await api.emojis.initialize();
        const emoji_picker = this.querySelector('converse-emoji-picker');
        if (emoji_picker) {
            emoji_picker.model.set({
                'ac_position': input.selectionStart,
                'autocompleting': value,
                'query': value
            });
            const emoji_dropdown = this.querySelector('converse-emoji-dropdown');
            emoji_dropdown?.showMenu();
        }
    }
}

api.elements.define('converse-chat-bottom-panel', ChatBottomPanel);
