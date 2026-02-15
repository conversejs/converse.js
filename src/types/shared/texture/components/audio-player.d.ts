/**
 * Accessible audio player component
 * Provides custom controls that work with screen readers like NVDA and JAWS
 */
export default class AudioPlayer extends CustomElement {
    static get properties(): {
        src: {
            type: StringConstructor;
        };
        title: {
            type: StringConstructor;
        };
        hide_url: {
            type: BooleanConstructor;
        };
        is_playing: {
            state: boolean;
        };
        current_time: {
            state: boolean;
        };
        duration: {
            state: boolean;
        };
        volume: {
            state: boolean;
        };
        is_muted: {
            state: boolean;
        };
        is_loading: {
            state: boolean;
        };
        has_error: {
            state: boolean;
        };
        playback_speed: {
            state: boolean;
        };
    };
    src: string;
    hide_url: boolean;
    is_playing: boolean;
    current_time: number;
    duration: number;
    volume: number;
    is_muted: boolean;
    is_loading: boolean;
    has_error: boolean;
    playback_speed: number;
    /** @type {HTMLAudioElement|null} */
    audio: HTMLAudioElement | null;
    connectedCallback(): void;
    /**
     * Toggle play/pause
     * @param {Event} [ev]
     */
    togglePlay(ev?: Event): void;
    /**
     * Toggle mute
     * @param {Event} [ev]
     */
    toggleMute(ev?: Event): void;
    /**
     * Cycle through playback speeds
     * @param {Event} [ev]
     */
    cyclePlaybackSpeed(ev?: Event): void;
    render(): import("lit-html").TemplateResult<1>;
    #private;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=audio-player.d.ts.map