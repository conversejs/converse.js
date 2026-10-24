/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api } from '@converse/headless';
import { __ } from 'i18n';
import { CustomElement } from 'shared/components/element.js';
import RecordingSession from './session.js';
import tplRecorder from './templates/recorder.js';
import {
    ERROR,
    IDLE,
    PAUSED,
    RECORDING,
    REQUESTING,
    UPLOADING,
    getUploadDurationLimit,
    sendVoiceMessage,
} from './utils.js';

/** From how many milliseconds before the limit the remaining time is shown. */
const WARNING_TIME = 30000;

/**
 * @param {Error} error - As thrown by `getUserMedia`
 * @returns {string}
 */
function getPermissionErrorMessage(error) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        return __('Microphone permission denied. Please enable microphone access in browser settings.');
    } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        return __('No microphone found. Please connect a microphone and try again.');
    }
    return __('Error accessing microphone: %1$s', error.message);
}

/**
 * Records a voice message and sends it to the chat it belongs to.
 *
 * Opened and closed through the `voice_recorder` attribute on the chat's `ui`
 * model, and renders nothing while closed.
 */
export default class AudioRecorder extends CustomElement {
    static get properties() {
        return {
            model: { type: Object },
            state: { state: true },
            error_message: { state: true },
            time_warning: { state: true },
        };
    }

    /** @type {ReturnType<typeof setInterval>|null} */
    #ticker = null;

    constructor() {
        super();
        /** @type {import('./utils').ChatModel} */
        this.model = null;
        this.state = IDLE;
        this.error_message = '';
        /** Text for screen readers, set once when the time limit approaches. */
        this.time_warning = '';
        /** @type {RecordingSession|null} */
        this.session = null;
        /** @type {import('./session').Recording|null} */
        this.recording = null;
    }

    initialize() {
        this.listenTo(this.model.ui, 'change:voice_recorder', () =>
            this.model.ui.get('voice_recorder') ? this.record() : this.#discard(),
        );
        this.listenTo(this.model.ui, 'voice-recorder:reopen', () => {
            // Ask for the microphone again, e.g. after permission was denied
            if (this.state === ERROR && !this.recording) {
                this.#discard();
                this.record();
            }
        });
        if (this.model.ui.get('voice_recorder')) this.record();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.#discard();
        this.model?.ui.set('voice_recorder', false);
    }

    render() {
        return this.state === IDLE ? '' : tplRecorder(this);
    }

    /** @returns {boolean} */
    get show_remaining() {
        return this.session?.remaining <= WARNING_TIME;
    }

    async record() {
        if (this.state !== IDLE) return;

        const bitrate = api.settings.get('voice_message_bitrate');
        const session = new RecordingSession({
            max_duration: api.settings.get('max_voice_message_duration'),
            bitrate,
            mime_type: api.settings.get('voice_message_mime_type'),
        });
        this.session = session;
        this.state = REQUESTING;
        this.#focus('.composer-panel__close');

        // Whatever the configured limit, a recording that outgrew the upload
        // service's file size limit couldn't be sent, so it's stopped before it does.
        const limit = await getUploadDurationLimit(bitrate);
        if (this.session !== session) return; // Closed while looking up the limit
        session.limitTo(limit);

        try {
            await session.start();
        } catch (e) {
            if (this.session === session) this.#fail(getPermissionErrorMessage(e));
            return;
        }
        if (this.session !== session) return; // Closed while waiting for permission

        this.state = RECORDING;
        this.time_warning = '';
        this.#ticker = setInterval(() => this.#tick(), 1000);
        this.#focus('.btn-pause');

        let recording;
        try {
            recording = await session.result;
        } catch (e) {
            if (this.session === session) this.#fail(__('Error recording audio: %1$s', e.message));
            return;
        }
        if (recording && this.session === session) {
            if (!recording.blob.size) {
                this.#fail(__('Nothing was recorded. Please check that your microphone is working.'));
                return;
            }
            this.recording = recording;
            if (recording.interrupted) {
                this.#fail(__('Recording stopped unexpectedly. Your microphone may have been disconnected.'));
            } else {
                this.send();
            }
        }
    }

    pause() {
        this.session.pause();
        this.state = PAUSED;
        this.#focus('.btn-resume');
    }

    resume() {
        this.session.resume();
        this.state = RECORDING;
        this.#focus('.btn-pause');
    }

    /** Stop recording and send what has been recorded. */
    stop() {
        this.session.stop();
    }

    /** Upload and send {@link recording}, also used to retry after a failure. */
    async send() {
        this.#stopTicker();
        this.session = null;
        // A new object on every attempt, so that an earlier upload which settles
        // after the recorder was closed or reused can tell it's no longer current.
        const recording = { ...this.recording, interrupted: false };
        this.recording = recording;
        // The control that has focus goes away, so a keyboard user's focus
        // moves to the close button rather than being dropped.
        const keyboard_focus = !!this.querySelector(':focus-visible');
        this.state = UPLOADING;
        if (keyboard_focus) this.#focus('.composer-panel__close');
        try {
            await sendVoiceMessage(this.model, recording);
        } catch (e) {
            if (this.recording === recording) this.#fail(e.message);
            return;
        }
        if (this.recording === recording) this.close();
    }

    cancel() {
        this.close();
    }

    close() {
        // Like a keyboard close of any composer panel, hand focus back to the
        // message field if the user was working the recorder from the keyboard,
        // since the control that has focus is about to disappear.
        if (this.querySelector(':focus-visible')) {
            this.dispatchEvent(new CustomEvent('composerpanelclose', { bubbles: true }));
        }
        this.model.ui.set('voice_recorder', false);
    }

    #tick() {
        this.requestUpdate();
        if (this.show_remaining && !this.time_warning) {
            this.time_warning = __('%1$s seconds left', Math.ceil(this.session.remaining / 1000));
        }
    }

    #stopTicker() {
        clearInterval(this.#ticker);
        this.#ticker = null;
    }

    /** @param {string} message */
    #fail(message) {
        this.session?.cancel();
        this.session = null;
        this.#stopTicker();
        this.error_message = message;
        this.state = ERROR;
        this.#focus('.audio-recorder button');
    }

    /** Throw away the recording and anything in progress, and render nothing. */
    #discard() {
        this.session?.cancel();
        this.session = null;
        this.recording = null;
        this.#stopTicker();
        this.error_message = '';
        this.time_warning = '';
        this.state = IDLE;
    }

    /** @param {string} selector */
    async #focus(selector) {
        await this.updateComplete;
        /** @type {HTMLElement} */ (this.querySelector(selector))?.focus();
    }
}

api.elements.define('converse-audio-recorder', AudioRecorder);
