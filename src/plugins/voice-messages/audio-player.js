/**
 * @module voice-messages/audio-player
 * @description Reproductor de audio accesible para mensajes de voz
 */

import { html } from 'lit';
import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { announceToScreenReader } from '../../utils/accessibility.js';
import 'shared/components/icons.js';

import './styles/audio-player.scss';

/**
 * Reproductor de audio accesible
 */
export default class AudioPlayer extends CustomElement {
    
    static get properties() {
        return {
            src: { type: String },
            title: { type: String },
            duration: { type: Number, state: true },
            currentTime: { type: Number, state: true },
            isPlaying: { type: Boolean, state: true },
            isLoading: { type: Boolean, state: true },
            error: { type: String, state: true },
            playbackRate: { type: Number, state: true },
            volume: { type: Number, state: true }
        };
    }

    constructor() {
        super();
        this.src = '';
        this.title = '';
        this.duration = 0;
        this.currentTime = 0;
        this.isPlaying = false;
        this.isLoading = false;
        this.error = '';
        this.playbackRate = 1.0;
        this.volume = 1.0;
        this.audioElement = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.initAudioElement();
    }

    disconnectedCallback() {
        this.cleanup();
        super.disconnectedCallback();
    }

    render() {
        if (this.error) {
            return this.renderError();
        }

        const progress = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;

        return html`
            <div 
                class="audio-player"
                role="region"
                aria-label="${this.title || __('Reproductor de mensaje de voz')}"
            >
                <audio
                    src="${this.src}"
                    @loadedmetadata=${this.onLoadedMetadata}
                    @timeupdate=${this.onTimeUpdate}
                    @ended=${this.onEnded}
                    @error=${this.onError}
                    @play=${() => { this.isPlaying = true; }}
                    @pause=${() => { this.isPlaying = false; }}
                    preload="metadata"
                    style="display: none;"
                ></audio>

                <div class="player-controls" role="toolbar" aria-label="${__('Playback controls')}">
                    <!-- Play/pause button -->
                    <button
                        type="button"
                        class="btn btn-player btn-play-pause"
                        @click=${this.togglePlayPause}
                        ?disabled=${this.isLoading}
                        aria-label="${this.isPlaying ? __('Pausar') : __('Reproducir')}"
                        title="${this.isPlaying ? __('Pausar (Espacio)') : __('Reproducir (Espacio)')}"
                    >
                        ${this.isLoading 
                            ? html`<span class="spinner-border spinner-border-sm" role="status"></span>`
                            : html`<converse-icon 
                                class="fa fa-${this.isPlaying ? 'pause' : 'play'}" 
                                size="1em"
                                aria-hidden="true"
                            ></converse-icon>`
                        }
                    </button>

                    <!-- Barra de progreso -->
                    <div class="player-progress-container">
                        <input
                            type="range"
                            class="player-progress"
                            min="0"
                            max="${this.duration || 100}"
                            .value="${this.currentTime}"
                            @input=${this.onSeek}
                            @change=${this.onSeekEnd}
                            aria-label="${__('Playback position')}"
                            aria-valuemin="0"
                            aria-valuemax="${this.duration}"
                            aria-valuenow="${this.currentTime}"
                            aria-valuetext="${this.formatTime(this.currentTime)} de ${this.formatTime(this.duration)}"
                            ?disabled=${this.isLoading}
                        />
                        <div 
                            class="progress-bar-fill" 
                            style="width: ${progress}%"
                            aria-hidden="true"
                        ></div>
                    </div>

                    <!-- Tiempo -->
                    <div class="player-time" aria-live="off">
                        <span class="time-current" aria-label="${__('Tiempo actual')}">
                            ${this.formatTime(this.currentTime)}
                        </span>
                        <span class="time-separator">/</span>
                        <span class="time-total" aria-label="${__('Total duration')}">
                            ${this.formatTime(this.duration)}
                        </span>
                    </div>

                    <!-- Playback speed -->
                    <div class="dropdown player-speed-control">
                        <button
                            type="button"
                            class="btn btn-player btn-speed"
                            data-bs-toggle="dropdown"
                            aria-expanded="false"
                            aria-label="${__('Playback speed: %1$sx', this.playbackRate)}"
                            title="${__('Cambiar velocidad')}"
                        >
                            ${this.playbackRate}x
                        </button>
                        <ul class="dropdown-menu" role="menu" aria-label="${__('Velocidades disponibles')}">
                            ${[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(rate => html`
                                <li role="none">
                                    <button
                                        type="button"
                                        class="dropdown-item ${this.playbackRate === rate ? 'active' : ''}"
                                        @click=${() => this.setPlaybackRate(rate)}
                                        role="menuitemradio"
                                        aria-checked="${this.playbackRate === rate}"
                                    >
                                        ${rate}x
                                        ${rate === 1.0 ? html`<span class="badge bg-secondary ms-2">${__('Normal')}</span>` : ''}
                                    </button>
                                </li>
                            `)}
                        </ul>
                    </div>

                    <!-- Download button -->
                    <a
                        href="${this.src}"
                        download="${this.title || 'voice-message.webm'}"
                        class="btn btn-player btn-download"
                        aria-label="${__('Descargar mensaje de voz')}"
                        title="${__('Descargar')}"
                    >
                        <converse-icon 
                            class="fa fa-download" 
                            size="1em"
                            aria-hidden="true"
                        ></converse-icon>
                    </a>
                </div>

                <!-- Indicador visual de forma de onda (decorativo) -->
                <div class="player-waveform" aria-hidden="true">
                    ${this.renderWaveform(progress)}
                </div>
            </div>
        `;
    }

    renderError() {
        return html`
            <div class="audio-player-error" role="alert">
                <converse-icon 
                    class="fa fa-exclamation-circle text-danger" 
                    size="1.2em"
                    aria-hidden="true"
                ></converse-icon>
                <span class="error-text">${this.error}</span>
            </div>
        `;
    }

    renderWaveform(progress) {
        const bars = Array(30).fill(0).map((_, index) => {
            const height = 30 + Math.random() * 70;
            const isActive = (index / 30 * 100) < progress;
            return html`
                <div 
                    class="waveform-bar ${isActive ? 'active' : ''}" 
                    style="height: ${height}%"
                ></div>
            `;
        });
        return html`<div class="waveform-container">${bars}</div>`;
    }

    // ===== Playback methods =====

    initAudioElement() {
        this.updateComplete.then(() => {
            this.audioElement = this.querySelector('audio');
            
            if (this.audioElement) {
                this.audioElement.volume = this.volume;
                this.audioElement.playbackRate = this.playbackRate;
                
                // Configurar listeners de teclado
                this.addEventListener('keydown', this.handleKeyboard);
            }
        });
    }

    cleanup() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.src = '';
        }
        this.removeEventListener('keydown', this.handleKeyboard);
    }

    async togglePlayPause() {
        if (!this.audioElement) return;

        try {
            if (this.isPlaying) {
                this.audioElement.pause();
                announceToScreenReader(__('Pausado'), 'polite');
            } else {
                await this.audioElement.play();
                announceToScreenReader(__('Reproduciendo'), 'polite');
            }
        } catch (error) {
            this.handleError(__('Error al reproducir: %1$s', error.message));
        }
    }

    onSeek(event) {
        if (this.audioElement) {
            this.audioElement.currentTime = parseFloat(event.target.value);
        }
    }

    onSeekEnd(event) {
        const time = parseFloat(event.target.value);
        announceToScreenReader(
            __('Position: %1$s', this.formatTime(time)),
            'polite'
        );
    }

    setPlaybackRate(rate) {
        this.playbackRate = rate;
        if (this.audioElement) {
            this.audioElement.playbackRate = rate;
        }
        announceToScreenReader(
            __('Velocidad cambiada a %1$sx', rate),
            'polite'
        );
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.audioElement) {
            this.audioElement.volume = this.volume;
        }
    }

    skipForward(seconds = 10) {
        if (this.audioElement) {
            this.audioElement.currentTime = Math.min(
                this.duration,
                this.audioElement.currentTime + seconds
            );
            announceToScreenReader(__('Adelantado %1$s segundos', seconds), 'polite');
        }
    }

    skipBackward(seconds = 10) {
        if (this.audioElement) {
            this.audioElement.currentTime = Math.max(
                0,
                this.audioElement.currentTime - seconds
            );
            announceToScreenReader(__('Retrocedido %1$s segundos', seconds), 'polite');
        }
    }

    // ===== Event handlers =====

    onLoadedMetadata(event) {
        this.duration = event.target.duration;
        this.isLoading = false;
    }

    onTimeUpdate(event) {
        this.currentTime = event.target.currentTime;
    }

    onEnded() {
        this.isPlaying = false;
        this.currentTime = 0;
        if (this.audioElement) {
            this.audioElement.currentTime = 0;
        }
        announceToScreenReader(__('Playback finished'), 'polite');
    }

    onError(event) {
        const error = event.target.error;
        let message = __('Error al cargar el audio');
        
        if (error) {
            switch (error.code) {
                case error.MEDIA_ERR_ABORTED:
                    message = __('Carga de audio abortada');
                    break;
                case error.MEDIA_ERR_NETWORK:
                    message = __('Error de red al cargar audio');
                    break;
                case error.MEDIA_ERR_DECODE:
                    message = __('Error al decodificar audio');
                    break;
                case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    message = __('Formato de audio no soportado');
                    break;
            }
        }
        
        this.handleError(message);
    }

    handleError(message) {
        this.error = message;
        this.isLoading = false;
        announceToScreenReader(message, 'assertive');
    }

    // ===== Utilidades =====

    formatTime(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) {
            return '0:00';
        }
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    handleKeyboard = (event) => {
        // Only process if focus is on the player
        if (!this.contains(document.activeElement)) {
            return;
        }

        switch (event.key) {
            case ' ':
            case 'k':
                event.preventDefault();
                this.togglePlayPause();
                break;
            
            case 'ArrowLeft':
                event.preventDefault();
                this.skipBackward(5);
                break;
            
            case 'ArrowRight':
                event.preventDefault();
                this.skipForward(5);
                break;
            
            case 'j':
                event.preventDefault();
                this.skipBackward(10);
                break;
            
            case 'l':
                event.preventDefault();
                this.skipForward(10);
                break;
            
            case 'Home':
                event.preventDefault();
                if (this.audioElement) {
                    this.audioElement.currentTime = 0;
                    announceToScreenReader(__('Volver al inicio'), 'polite');
                }
                break;
            
            case 'End':
                event.preventDefault();
                if (this.audioElement) {
                    this.audioElement.currentTime = this.duration;
                    announceToScreenReader(__('Ir al final'), 'polite');
                }
                break;
            
            case 'ArrowUp':
                event.preventDefault();
                this.setVolume(this.volume + 0.1);
                announceToScreenReader(
                    __('Volumen: %1$s%', Math.round(this.volume * 100)),
                    'polite'
                );
                break;
            
            case 'ArrowDown':
                event.preventDefault();
                this.setVolume(this.volume - 0.1);
                announceToScreenReader(
                    __('Volumen: %1$s%', Math.round(this.volume * 100)),
                    'polite'
                );
                break;
        }
    };
}

api.elements.define('converse-audio-player', AudioPlayer);
