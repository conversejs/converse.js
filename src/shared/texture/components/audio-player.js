/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Accessible audio player component that works with screen readers
 */
import { html } from "lit";
import { api, u } from "@converse/headless";
import { CustomElement } from "shared/components/element.js";
import { __ } from "i18n";

import "shared/components/icons.js";
import "../styles/audio-player.scss";

/**
 * Format time in seconds to MM:SS format
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
    if (!isFinite(seconds) || isNaN(seconds)) {
        return "0:00";
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Accessible audio player component
 * Provides custom controls that work with screen readers like NVDA and JAWS
 */
export default class AudioPlayer extends CustomElement {
    static get properties() {
        return {
            src: { type: String },
            title: { type: String },
            hide_url: { type: Boolean },
            // Internal state
            is_playing: { state: true },
            current_time: { state: true },
            duration: { state: true },
            volume: { state: true },
            is_muted: { state: true },
            is_loading: { state: true },
            has_error: { state: true },
        };
    }

    constructor() {
        super();
        this.src = "";
        this.title = "";
        this.hide_url = false;
        this.is_playing = false;
        this.current_time = 0;
        this.duration = 0;
        this.volume = 1;
        this.is_muted = false;
        this.is_loading = true;
        this.has_error = false;
        /** @type {HTMLAudioElement|null} */
        this.audio = null;
        this.id = u.getUniqueId();
    }

    connectedCallback() {
        super.connectedCallback();
        this.#setupAudio();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.#cleanupAudio();
    }

    #setupAudio() {
        this.audio = new Audio();
        this.audio.preload = "metadata";
        this.audio.src = this.src;

        // Event listeners
        this.audio.addEventListener("loadedmetadata", this.#onLoadedMetadata);
        this.audio.addEventListener("timeupdate", this.#onTimeUpdate);
        this.audio.addEventListener("play", this.#onPlay);
        this.audio.addEventListener("pause", this.#onPause);
        this.audio.addEventListener("ended", this.#onEnded);
        this.audio.addEventListener("volumechange", this.#onVolumeChange);
        this.audio.addEventListener("error", this.#onError);
        this.audio.addEventListener("canplay", this.#onCanPlay);
        this.audio.addEventListener("waiting", this.#onWaiting);
    }

    #cleanupAudio() {
        if (this.audio) {
            this.audio.pause();
            this.audio.removeEventListener("loadedmetadata", this.#onLoadedMetadata);
            this.audio.removeEventListener("timeupdate", this.#onTimeUpdate);
            this.audio.removeEventListener("play", this.#onPlay);
            this.audio.removeEventListener("pause", this.#onPause);
            this.audio.removeEventListener("ended", this.#onEnded);
            this.audio.removeEventListener("volumechange", this.#onVolumeChange);
            this.audio.removeEventListener("error", this.#onError);
            this.audio.removeEventListener("canplay", this.#onCanPlay);
            this.audio.removeEventListener("waiting", this.#onWaiting);
            this.audio = null;
        }
    }

    #onLoadedMetadata = () => {
        this.duration = this.audio?.duration || 0;
        this.is_loading = false;
        this.requestUpdate();
    };

    #onTimeUpdate = () => {
        this.current_time = this.audio?.currentTime || 0;
        this.requestUpdate();
    };

    #onPlay = () => {
        this.is_playing = true;
        this.requestUpdate();
    };

    #onPause = () => {
        this.is_playing = false;
        this.requestUpdate();
    };

    #onEnded = () => {
        this.is_playing = false;
        this.current_time = 0;
        if (this.audio) {
            this.audio.currentTime = 0;
        }
        this.requestUpdate();
    };

    #onVolumeChange = () => {
        if (this.audio) {
            this.volume = this.audio.volume;
            this.is_muted = this.audio.muted;
        }
        this.requestUpdate();
    };

    #onError = () => {
        this.has_error = true;
        this.is_loading = false;
        this.requestUpdate();
    };

    #onCanPlay = () => {
        this.is_loading = false;
        this.requestUpdate();
    };

    #onWaiting = () => {
        this.is_loading = true;
        this.requestUpdate();
    };

    /**
     * Toggle play/pause
     * @param {Event} [ev]
     */
    togglePlay(ev) {
        ev?.preventDefault();
        if (!this.audio || this.has_error) return;

        if (this.is_playing) {
            this.audio.pause();
        } else {
            this.audio.play().catch((error) => {
                console.error("Audio playback failed:", error);
                this.has_error = true;
                this.requestUpdate();
            });
        }
    }

    /**
     * Handle keyboard events for play/pause button
     * @param {KeyboardEvent} ev
     */
    #onPlayPauseKeyDown = (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            this.togglePlay();
        }
    };

    /**
     * Handle seek slider change
     * @param {Event} ev
     */
    #onSeekChange = (ev) => {
        if (!this.audio) return;
        const target = /** @type {HTMLInputElement} */ (ev.target);
        const newTime = parseFloat(target.value);
        this.audio.currentTime = newTime;
        this.current_time = newTime;
    };

    /**
     * Handle seek slider keyboard navigation
     * @param {KeyboardEvent} ev
     */
    #onSeekKeyDown = (ev) => {
        if (!this.audio) return;
        const step = this.duration > 60 ? 5 : 1; // 5 seconds for longer audio, 1 for short

        if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") {
            ev.preventDefault();
            const newTime = Math.max(0, this.current_time - step);
            this.audio.currentTime = newTime;
        } else if (ev.key === "ArrowRight" || ev.key === "ArrowUp") {
            ev.preventDefault();
            const newTime = Math.min(this.duration, this.current_time + step);
            this.audio.currentTime = newTime;
        } else if (ev.key === "Home") {
            ev.preventDefault();
            this.audio.currentTime = 0;
        } else if (ev.key === "End") {
            ev.preventDefault();
            this.audio.currentTime = this.duration;
        }
    };

    /**
     * Toggle mute
     * @param {Event} [ev]
     */
    toggleMute(ev) {
        ev?.preventDefault();
        if (!this.audio) return;
        this.audio.muted = !this.audio.muted;
    }

    /**
     * Handle keyboard events for mute button
     * @param {KeyboardEvent} ev
     */
    #onMuteKeyDown = (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            this.toggleMute();
        }
    };

    /**
     * Handle volume slider change
     * @param {Event} ev
     */
    #onVolumeChange2 = (ev) => {
        if (!this.audio) return;
        const target = /** @type {HTMLInputElement} */ (ev.target);
        const newVolume = parseFloat(target.value);
        this.audio.volume = newVolume;
        if (newVolume > 0 && this.audio.muted) {
            this.audio.muted = false;
        }
    };

    /**
     * Handle volume slider keyboard navigation
     * @param {KeyboardEvent} ev
     */
    #onVolumeKeyDown = (ev) => {
        if (!this.audio) return;
        const step = 0.1;

        if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") {
            ev.preventDefault();
            const newVolume = Math.max(0, this.volume - step);
            this.audio.volume = newVolume;
        } else if (ev.key === "ArrowRight" || ev.key === "ArrowUp") {
            ev.preventDefault();
            const newVolume = Math.min(1, this.volume + step);
            this.audio.volume = newVolume;
        }
    };

    /**
     * Get the appropriate volume icon based on current state
     * @returns {string}
     */
    #getVolumeIcon() {
        if (this.is_muted || this.volume === 0) {
            return "fa fa-volume-xmark";
        } else if (this.volume < 0.5) {
            return "fa fa-volume-low";
        } else {
            return "fa fa-volume-high";
        }
    }

    render() {
        const { hostname } = this.src ? u.getURL(this.src) : { hostname: "" };
        const i18n_play = __("Play");
        const i18n_pause = __("Pause");
        const i18n_mute = __("Mute");
        const i18n_unmute = __("Unmute");
        const i18n_seek = __("Seek");
        const i18n_volume = __("Volume");
        const i18n_audio_player = __("Audio player");
        const i18n_loading = __("Loading audio...");
        const i18n_error = __("Error loading audio");
        const i18n_current_time = __("Current time");
        const i18n_duration = __("Duration");

        const play_pause_label = this.is_playing ? i18n_pause : i18n_play;
        const mute_label = this.is_muted ? i18n_unmute : i18n_mute;
        const progress_percent = this.duration > 0 ? (this.current_time / this.duration) * 100 : 0;
        const volume_percent = this.volume * 100;

        return html`
            <figure class="audio-player" role="group" aria-label="${i18n_audio_player}">
                ${this.title || !this.hide_url
                    ? html`<figcaption class="audio-player__caption">
                          ${this.title ? html`<span class="audio-player__title">${this.title}</span>` : ""}
                          ${this.hide_url || !hostname
                              ? ""
                              : html`<a
                                    class="audio-player__link"
                                    target="_blank"
                                    rel="noopener"
                                    title="${this.src}"
                                    href="${this.src}"
                                    >${hostname}</a
                                >`}
                      </figcaption>`
                    : ""}

                <div class="audio-player__controls">
                    <!-- Play/Pause Button -->
                    <button
                        type="button"
                        class="audio-player__btn audio-player__play-btn"
                        @click=${this.togglePlay}
                        @keydown=${this.#onPlayPauseKeyDown}
                        aria-label="${play_pause_label}"
                        aria-pressed="${this.is_playing}"
                        ?disabled=${this.has_error || this.is_loading}
                    >
                        ${this.is_loading
                            ? html`<converse-icon
                                  aria-hidden="true"
                                  class="fa fa-spinner audio-player__spinner"
                                  size="1.2em"
                              ></converse-icon>`
                            : this.is_playing
                              ? html`<converse-icon
                                    aria-hidden="true"
                                    class="fa fa-pause"
                                    size="1.2em"
                                ></converse-icon>`
                              : html`<converse-icon
                                    aria-hidden="true"
                                    class="fa fa-play"
                                    size="1.2em"
                                ></converse-icon>`}
                    </button>

                    <!-- Time Display -->
                    <span class="audio-player__time" aria-live="off">
                        <span class="visually-hidden">${i18n_current_time}:</span>
                        <span>${formatTime(this.current_time)}</span>
                        <span aria-hidden="true">/</span>
                        <span class="visually-hidden">${i18n_duration}:</span>
                        <span>${formatTime(this.duration)}</span>
                    </span>

                    <!-- Seek Slider -->
                    <div class="audio-player__seek-container">
                        <label for="seek-${this.id}" class="visually-hidden">${i18n_seek}</label>
                        <input
                            type="range"
                            id="seek-${this.id}"
                            class="audio-player__seek"
                            min="0"
                            max="${this.duration || 0}"
                            step="0.1"
                            .value="${this.current_time}"
                            @input=${this.#onSeekChange}
                            @keydown=${this.#onSeekKeyDown}
                            aria-valuemin="0"
                            aria-valuemax="${this.duration || 0}"
                            aria-valuenow="${this.current_time}"
                            aria-valuetext="${formatTime(this.current_time)} of ${formatTime(this.duration)}"
                            ?disabled=${this.has_error || this.duration === 0}
                            style="--progress-percent: ${progress_percent}%"
                        />
                    </div>

                    <!-- Mute Button -->
                    <button
                        type="button"
                        class="audio-player__btn audio-player__mute-btn"
                        @click=${this.toggleMute}
                        @keydown=${this.#onMuteKeyDown}
                        aria-label="${mute_label}"
                        aria-pressed="${this.is_muted}"
                        ?disabled=${this.has_error}
                    >
                        <converse-icon aria-hidden="true" class="${this.#getVolumeIcon()}" size="1.2em"></converse-icon>
                    </button>

                    <!-- Volume Slider -->
                    <div class="audio-player__volume-container">
                        <label for="volume-${this.id}" class="visually-hidden">${i18n_volume}</label>
                        <input
                            type="range"
                            id="volume-${this.id}"
                            class="audio-player__volume"
                            min="0"
                            max="1"
                            step="0.01"
                            .value="${this.is_muted ? 0 : this.volume}"
                            @input=${this.#onVolumeChange2}
                            @keydown=${this.#onVolumeKeyDown}
                            aria-valuemin="0"
                            aria-valuemax="100"
                            aria-valuenow="${Math.round(this.is_muted ? 0 : this.volume * 100)}"
                            aria-valuetext="${Math.round(this.is_muted ? 0 : this.volume * 100)}%"
                            ?disabled=${this.has_error}
                            style="--volume-percent: ${this.is_muted ? 0 : volume_percent}%"
                        />
                    </div>
                </div>

                <!-- Status announcements for screen readers -->
                <div
                    class="visually-hidden"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    ${this.has_error ? i18n_error : this.is_loading ? i18n_loading : ""}
                </div>
            </figure>
        `;
    }
}

api.elements.define("converse-audio-player", AudioPlayer);
