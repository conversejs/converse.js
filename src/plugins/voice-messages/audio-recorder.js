/**
 * @module voice-messages/audio-recorder
 * @description Componente para grabar mensajes de voz con accesibilidad completa
 */

import { html } from 'lit';
import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { announceToScreenReader } from '../../utils/accessibility.js';
import 'shared/components/icons.js';

import './styles/audio-recorder.scss';

/**
 * Recording states
 */
const RecordingState = {
    IDLE: 'idle',
    REQUESTING: 'requesting',
    RECORDING: 'recording',
    PAUSED: 'paused',
    PROCESSING: 'processing',
    ERROR: 'error'
};

/**
 * Accessible audio recording component
 */
export default class AudioRecorder extends CustomElement {
    
    static get properties() {
        return {
            model: { type: Object },
            state: { type: String, state: true },
            duration: { type: Number, state: true },
            error_message: { type: String, state: true }
        };
    }

    constructor() {
        super();
        this.model = null;
        this.state = RecordingState.IDLE;
        this.duration = 0;
        this.error_message = '';
        
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.startTime = null;
        this.timerInterval = null;
        this.stream = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.checkBrowserSupport();
    }

    disconnectedCallback() {
        this.cleanup();
        super.disconnectedCallback();
    }

    render() {
        return html`
            <div 
                class="audio-recorder"
                role="region"
                aria-label="${__('Grabadora de mensajes de voz')}"
            >
                ${this.renderContent()}
            </div>
        `;
    }

    renderContent() {
        switch (this.state) {
            case RecordingState.IDLE:
                return this.renderIdleState();
            case RecordingState.REQUESTING:
                return this.renderRequestingState();
            case RecordingState.RECORDING:
                return this.renderRecordingState();
            case RecordingState.PAUSED:
                return this.renderPausedState();
            case RecordingState.PROCESSING:
                return this.renderProcessingState();
            case RecordingState.ERROR:
                return this.renderErrorState();
            default:
                return '';
        }
    }

    renderIdleState() {
        return html`
            <div class="recorder-idle">
                <button
                    type="button"
                    class="btn btn-primary btn-record"
                    @click=${this.startRecording}
                    aria-label="${__('Start recording voice message')}"
                    title="${__('Grabar mensaje de voz (Alt+Shift+V)')}"
                >
                    <converse-icon 
                        class="fa fa-microphone" 
                        size="1.2em"
                        aria-hidden="true"
                    ></converse-icon>
                    <span class="btn-text">${__('Grabar voz')}</span>
                </button>
                <p class="recorder-hint" role="status">
                    ${__('Presione para comenzar a grabar un mensaje de voz')}
                </p>
            </div>
        `;
    }

    renderRequestingState() {
        return html`
            <div class="recorder-requesting">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">${__('Requesting microphone permission...')}</span>
                </div>
                <p class="recorder-message" aria-live="polite">
                    ${__('Requesting microphone access...')}
                </p>
            </div>
        `;
    }

    renderRecordingState() {
        const formattedDuration = this.formatDuration(this.duration);
        
        return html`
            <div class="recorder-active" role="group" aria-label="${__('Recording in progress')}">
                <div class="recorder-status">
                    <span 
                        class="recording-indicator pulsing" 
                        aria-label="${__('Grabando')}"
                        role="status"
                    ></span>
                    <span 
                        class="recording-duration" 
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        ${formattedDuration}
                    </span>
                </div>
                
                <div class="recorder-controls" role="toolbar" aria-label="${__('Recording controls')}">
                    <button
                        type="button"
                        class="btn btn-secondary btn-pause"
                        @click=${this.pauseRecording}
                        aria-label="${__('Pause recording')}"
                        title="${__('Pausar (Espacio)')}"
                    >
                        <converse-icon 
                            class="fa fa-pause" 
                            size="1em"
                            aria-hidden="true"
                        ></converse-icon>
                    </button>
                    
                    <button
                        type="button"
                        class="btn btn-danger btn-stop"
                        @click=${this.stopRecording}
                        aria-label="${__('Stop and send recording')}"
                        title="${__('Detener (Enter)')}"
                    >
                        <converse-icon 
                            class="fa fa-stop" 
                            size="1em"
                            aria-hidden="true"
                        ></converse-icon>
                    </button>
                    
                    <button
                        type="button"
                        class="btn btn-outline-danger btn-cancel"
                        @click=${this.cancelRecording}
                        aria-label="${__('Cancel and discard recording')}"
                        title="${__('Cancelar (Escape)')}"
                    >
                        <converse-icon 
                            class="fa fa-times" 
                            size="1em"
                            aria-hidden="true"
                        ></converse-icon>
                    </button>
                </div>
                
                <div class="recorder-waveform" aria-hidden="true">
                    ${this.renderWaveform()}
                </div>
            </div>
        `;
    }

    renderPausedState() {
        const formattedDuration = this.formatDuration(this.duration);
        
        return html`
            <div class="recorder-paused" role="group" aria-label="${__('Recording paused')}">
                <div class="recorder-status">
                    <span class="paused-indicator" aria-label="${__('Pausado')}" role="status"></span>
                    <span class="recording-duration">${formattedDuration}</span>
                </div>
                
                <div class="recorder-controls" role="toolbar" aria-label="${__('Recording controls')}">
                    <button
                        type="button"
                        class="btn btn-primary btn-resume"
                        @click=${this.resumeRecording}
                        aria-label="${__('Resume recording')}"
                        title="${__('Reanudar (Espacio)')}"
                    >
                        <converse-icon 
                            class="fa fa-play" 
                            size="1em"
                            aria-hidden="true"
                        ></converse-icon>
                    </button>
                    
                    <button
                        type="button"
                        class="btn btn-success btn-stop"
                        @click=${this.stopRecording}
                        aria-label="${__('Finalizar y enviar')}"
                    >
                        <converse-icon 
                            class="fa fa-check" 
                            size="1em"
                            aria-hidden="true"
                        ></converse-icon>
                    </button>
                    
                    <button
                        type="button"
                        class="btn btn-outline-danger btn-cancel"
                        @click=${this.cancelRecording}
                        aria-label="${__('Cancel recording')}"
                    >
                        <converse-icon 
                            class="fa fa-times" 
                            size="1em"
                            aria-hidden="true"
                        ></converse-icon>
                    </button>
                </div>
            </div>
        `;
    }

    renderProcessingState() {
        return html`
            <div class="recorder-processing">
                <div class="spinner-border text-success" role="status">
                    <span class="visually-hidden">${__('Procesando audio...')}</span>
                </div>
                <p class="recorder-message" aria-live="polite">
                    ${__('Procesando y enviando mensaje de voz...')}
                </p>
            </div>
        `;
    }

    renderErrorState() {
        return html`
            <div class="recorder-error" role="alert">
                <converse-icon 
                    class="fa fa-exclamation-triangle text-danger" 
                    size="1.5em"
                    aria-hidden="true"
                ></converse-icon>
                <p class="error-message">${this.error_message}</p>
                <button
                    type="button"
                    class="btn btn-secondary"
                    @click=${this.resetRecorder}
                    aria-label="${__('Cerrar error')}"
                >
                    ${__('Cerrar')}
                </button>
            </div>
        `;
    }

    renderWaveform() {
        // Simple waveform visualization
        const bars = Array(20).fill(0).map(() => {
            const height = Math.random() * 100;
            return html`
                <div 
                    class="waveform-bar" 
                    style="height: ${height}%"
                ></div>
            `;
        });
        return html`<div class="waveform-container">${bars}</div>`;
    }

    // ===== Recording methods =====

    checkBrowserSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.state = RecordingState.ERROR;
            this.error_message = __('Your browser does not support audio recording');
            announceToScreenReader(this.error_message, 'assertive');
        }
    }

    async startRecording() {
        this.state = RecordingState.REQUESTING;
        announceToScreenReader(__('Requesting microphone access'), 'polite');

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                } 
            });

            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: this.getBestMimeType()
            });

            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.processRecording();
            };

            this.mediaRecorder.onerror = (event) => {
                // @ts-ignore - MediaRecorderErrorEvent tiene la propiedad error
                const error = /** @type {MediaRecorderErrorEvent} */ (event).error || event;
                const message = error?.message || String(error);
                this.handleError(__('Error al grabar audio: %1$s', message));
            };

            this.mediaRecorder.start();
            this.state = RecordingState.RECORDING;
            this.startTime = Date.now();
            this.startTimer();

            announceToScreenReader(__('Recording started'), 'assertive');

            // Configurar listener de teclado
            document.addEventListener('keydown', this.handleRecordingKeyboard);

        } catch (error) {
            this.handleError(this.getPermissionErrorMessage(error));
        }
    }

    pauseRecording() {
        if (this.mediaRecorder && this.state === RecordingState.RECORDING) {
            this.mediaRecorder.pause();
            this.stopTimer();
            this.state = RecordingState.PAUSED;
            announceToScreenReader(__('Recording paused'), 'polite');
        }
    }

    resumeRecording() {
        if (this.mediaRecorder && this.state === RecordingState.PAUSED) {
            this.mediaRecorder.resume();
            this.startTimer();
            this.state = RecordingState.RECORDING;
            announceToScreenReader(__('Recording resumed'), 'polite');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && 
            (this.state === RecordingState.RECORDING || this.state === RecordingState.PAUSED)) {
            this.mediaRecorder.stop();
            this.stopTimer();
            this.state = RecordingState.PROCESSING;
            announceToScreenReader(__('Procesando mensaje de voz'), 'polite');
            
            document.removeEventListener('keydown', this.handleRecordingKeyboard);
        }
    }

    cancelRecording() {
        this.cleanup();
        this.state = RecordingState.IDLE;
        this.duration = 0;
        announceToScreenReader(__('Recording cancelled'), 'polite');
        
        document.removeEventListener('keydown', this.handleRecordingKeyboard);
    }

    processRecording() {
        try {
            const audioBlob = new Blob(this.audioChunks, { 
                type: this.mediaRecorder.mimeType 
            });

            // Emitir evento con el blob para que el componente padre lo maneje
            this.dispatchEvent(new CustomEvent('recording-stopped', {
                detail: { 
                    audioBlob: audioBlob,
                    duration: this.duration
                },
                bubbles: true,
                composed: true
            }));

            announceToScreenReader(
                __('Recording completed, sending message...'), 
                'polite'
            );

            // Limpiar
            this.cleanup();

        } catch (error) {
            this.handleError(__('Error al procesar mensaje de voz: %1$s', error.message));
        }
    }

    cleanup() {
        this.stopTimer();
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.startTime = null;
    }

    resetRecorder() {
        this.cleanup();
        this.state = RecordingState.IDLE;
        this.duration = 0;
        this.error_message = '';
    }

    // ===== Utilidades =====

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.duration = Math.floor((Date.now() - this.startTime) / 1000);
            
            // Anunciar cada 30 segundos
            if (this.duration % 30 === 0 && this.duration > 0) {
                announceToScreenReader(
                    __('Grabando: %1$s', this.formatDuration(this.duration)),
                    'polite'
                );
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    getBestMimeType() {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/ogg',
            'audio/mp4'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return 'audio/webm'; // Fallback
    }

    getFileExtension(mimeType) {
        const map = {
            'audio/webm': 'webm',
            'audio/ogg': 'ogg',
            'audio/mp4': 'm4a',
            'audio/mpeg': 'mp3'
        };
        
        for (const [mime, ext] of Object.entries(map)) {
            if (mimeType.includes(mime)) {
                return ext;
            }
        }
        
        return 'webm';
    }

    getPermissionErrorMessage(error) {
        if (error.name === 'NotAllowedError') {
            return __('Microphone permission denied. Please enable microphone access in browser settings.');
        } else if (error.name === 'NotFoundError') {
            return __('No microphone found. Please connect a microphone and try again.');
        } else {
            return __('Error accessing microphone: %1$s', error.message);
        }
    }

    handleError(message) {
        this.state = RecordingState.ERROR;
        this.error_message = message;
        this.cleanup();
        announceToScreenReader(message, 'assertive');
    }

    handleRecordingKeyboard = (event) => {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        switch (event.key) {
            case ' ':
                event.preventDefault();
                if (this.state === RecordingState.RECORDING) {
                    this.pauseRecording();
                } else if (this.state === RecordingState.PAUSED) {
                    this.resumeRecording();
                }
                break;
            
            case 'Enter':
                event.preventDefault();
                this.stopRecording();
                break;
            
            case 'Escape':
                event.preventDefault();
                this.cancelRecording();
                break;
        }
    };
}

api.elements.define('converse-audio-recorder', AudioRecorder);
