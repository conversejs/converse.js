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
        if (!this.model) return '';
        return tplBottomPanel({
            'model': this.model,
            'viewUnreadMessages': (ev) => this.viewUnreadMessages(ev),
            'show_voice_recorder': this.model.get('show_voice_recorder') || false,
            'handleRecordingCompleted': (e) => this.handleRecordingCompleted(e),
            'hideVoiceRecorder': () => this.hideVoiceRecorder(),
        });
    }

    showVoiceRecorder() {
        this.model.set('show_voice_recorder', true);
        this.requestUpdate();
        
        // Esperar a que se renderice y luego enfocar
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
            // Crear archivo de audio
            if (!api.voice_messages || !api.voice_messages.createAudioFile) {
                throw new Error('API de mensajes de voz no disponible');
            }
            
            const file = api.voice_messages.createAudioFile(audioBlob);
            
            // Anunciar a lectores de pantalla
            if (api.accessibility && api.accessibility.announce) {
                api.accessibility.announce(
                    __('Enviando mensaje de voz de %1$s segundos', Math.round(duration)),
                    'polite'
                );
            }
            
            // Send using the model's method
            await this.model.sendFiles([file]);
            
            // Ocultar el grabador
            this.hideVoiceRecorder();
            
            // Confirm send
            if (api.accessibility && api.accessibility.announce) {
                api.accessibility.announce(
                    __('Mensaje de voz enviado correctamente'),
                    'assertive'
                );
            }
        } catch (error) {
            console.error('Error al enviar mensaje de voz:', error);
            
            // Anunciar error
            if (api.accessibility && api.accessibility.announce) {
                api.accessibility.announce(
                    __('Error al enviar mensaje de voz: %1$s', error.message),
                    'assertive'
                );
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
            emoji_dropdown?.dropdown.show();
        }
    }
}

api.elements.define('converse-chat-bottom-panel', ChatBottomPanel);
