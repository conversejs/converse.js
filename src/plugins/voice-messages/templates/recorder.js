import { html } from 'lit';
import { __ } from 'i18n';
import { ERROR, PAUSED, RECORDING, REQUESTING, UPLOADING, formatDuration } from '../utils.js';

/**
 * @param {string} message
 */
const tplBusy = (message) => html`
    <div class="recorder-busy">
        <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
        <span class="recorder-message">${message}</span>
    </div>
`;

/**
 * The upload carries on in the chat after the recorder is closed.
 * @param {import('../recorder').default} el
 */
const tplUploading = (el) => html`
    ${tplBusy(__('Sending voice message…'))}
    <div class="recorder-controls">
        <button type="button" class="btn btn-outline-secondary btn-cancel" @click=${() => el.close()}>
            ${__('Close')}
        </button>
    </div>
`;

/**
 * @param {import('../recorder').default} el
 */
function tplRecording(el) {
    const paused = el.state === PAUSED;
    const i18n_cancel = __('Cancel and discard recording');
    const i18n_send = __('Stop and send recording');
    const i18n_pause = paused ? __('Resume recording') : __('Pause recording');
    const remaining = el.show_remaining ? formatDuration(el.session.remaining) : '';
    return html`
        <div class="recorder-status">
            <span class="${paused ? 'paused-indicator' : 'recording-indicator'}" aria-hidden="true"></span>
            <span class="visually-hidden">${paused ? __('Paused') : __('Recording')}</span>
            <span class="recording-duration">${formatDuration(el.session.elapsed)}</span>
            ${remaining ? html`<span class="recording-remaining">${__('%1$s left', remaining)}</span>` : ''}
            <span class="visually-hidden" aria-live="polite">${el.time_warning}</span>
        </div>
        <div class="recorder-controls">
            <button
                type="button"
                class="btn btn-outline-secondary btn-cancel"
                title="${i18n_cancel}"
                aria-label="${i18n_cancel}"
                @click=${() => el.cancel()}
            >
                <converse-icon class="fa fa-times" size="1em"></converse-icon>
            </button>
            <button
                type="button"
                class="btn btn-outline-secondary ${paused ? 'btn-resume' : 'btn-pause'}"
                title="${i18n_pause}"
                aria-label="${i18n_pause}"
                @click=${() => (paused ? el.resume() : el.pause())}
            >
                <converse-icon class="fa ${paused ? 'fa-play' : 'fa-pause'}" size="1em"></converse-icon>
            </button>
            <button
                type="button"
                class="btn btn-primary btn-stop"
                title="${i18n_send}"
                aria-label="${i18n_send}"
                @click=${() => el.stop()}
            >
                <converse-icon class="fa fa-paper-plane" size="1em"></converse-icon>
            </button>
        </div>
    `;
}

/**
 * @param {import('../recorder').default} el
 */
const tplError = (el) => html`
    <div class="recorder-error" role="alert">
        <p class="error-message">${el.error_message}</p>
        <div class="recorder-controls">
            ${
                el.recording
                    ? html`<button type="button" class="btn btn-primary btn-retry" @click=${() => el.send()}>
                          ${el.recording.interrupted ? __('Send') : __('Retry')}
                      </button>`
                    : ''
            }
            <button type="button" class="btn btn-outline-secondary btn-cancel" @click=${() => el.cancel()}>
                ${el.recording ? __('Discard') : __('Close')}
            </button>
        </div>
    </div>
`;

/**
 * @param {import('../recorder').default} el
 */
export default (el) => {
    let content;
    switch (el.state) {
        case REQUESTING:
            content = tplBusy(__('Requesting microphone access…'));
            break;
        case RECORDING:
        case PAUSED:
            content = tplRecording(el);
            break;
        case UPLOADING:
            content = tplUploading(el);
            break;
        case ERROR:
            content = tplError(el);
            break;
    }
    return html`<div
        class="audio-recorder audio-recorder--${el.state}"
        role="region"
        tabindex="-1"
        aria-label="${__('Voice message recorder')}"
        @keydown=${(/** @type {KeyboardEvent} */ ev) => el.onKeyDown(ev)}
    >
        ${content}
    </div>`;
};
