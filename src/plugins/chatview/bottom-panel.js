/**
 * @typedef {import('shared/chat/emoji-picker.js').default} EmojiPicker
 * @typedef {import('shared/chat/emoji-dropdown.js').default} EmojiDropdown
 * @typedef {import('./message-form.js').default} MessageForm
 */
import { api } from '@converse/headless';
import { __ } from 'i18n';
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
        this.listenTo(this.model, 'startVoiceRecording', () => this.showVoiceRecorder());

        this.addEventListener('emojipickerblur', () =>
            /** @type {HTMLElement} */ (this.querySelector('.chat-textarea')).focus()
        );
    }

    render() {
        return this.model ? tplBottomPanel(this) : '';
    }

    showVoiceRecorder() {
        this.model.set('show_voice_recorder', true);
        this.requestUpdate();

        // Wait for it to render, then focus it
        setTimeout(() => {
            const recorder = /** @type {HTMLElement} */ (this.querySelector('converse-audio-recorder'));
            if (recorder) {
                recorder.focus();
            }
        }, 100);
    }

    hideVoiceRecorder() {
        this.model.set('show_voice_recorder', false);
        this.requestUpdate();
    }

    async handleRecordingCompleted(event) {
        const { audioBlob, duration } = event.detail;

        try {
            // Create the audio file
            if (!api.voice_messages || !api.voice_messages.createAudioFile) {
                throw new Error('Voice messages API not available');
            }

            const file = api.voice_messages.createAudioFile(audioBlob);

            // Announce to screen readers
            if (api.accessibility && api.accessibility.announce) {
                api.accessibility.announce(__('Sending a %1$s second voice message', Math.round(duration)), 'polite');
            }

            // Send using the model's method
            await this.model.sendFiles([file]);

            // Hide the recorder
            this.hideVoiceRecorder();

            // Confirm send
            if (api.accessibility && api.accessibility.announce) {
                api.accessibility.announce(__('Voice message sent'), 'assertive');
            }
        } catch (error) {
            console.error('Error sending voice message:', error);

            // Announce the error
            if (api.accessibility && api.accessibility.announce) {
                api.accessibility.announce(__('Error sending voice message: %1$s', error.message), 'assertive');
            }
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
            emoji_dropdown?.show();
        }
    }
}

api.elements.define('converse-chat-bottom-panel', ChatBottomPanel);
