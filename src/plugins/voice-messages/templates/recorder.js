import { html } from 'lit';
import { __ } from 'i18n';
import tplComposerPanel from 'shared/chat/templates/composer-panel.js';
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
 * @param {import('../recorder').default} el
 */
function tplRecordingStatus(el) {
    const paused = el.state === PAUSED;
    const remaining = el.show_remaining ? formatDuration(el.session.remaining) : '';
    return html`
        <div class="recorder-status">
            <span class="${paused ? 'paused-indicator' : 'recording-indicator'}" aria-hidden="true"></span>
            <span class="visually-hidden">${paused ? __('Paused') : __('Recording')}</span>
            <span class="recording-duration">${formatDuration(el.session.elapsed)}</span>
            ${remaining ? html`<span class="recording-remaining">${__('%1$s left', remaining)}</span>` : ''}
            <span class="visually-hidden" aria-live="polite">${el.time_warning}</span>
        </div>
    `;
}

/**
 * @param {import('../recorder').default} el
 */
function tplRecordingControls(el) {
    const paused = el.state === PAUSED;
    const i18n_send = __('Stop and send recording');
    const i18n_pause = paused ? __('Resume recording') : __('Pause recording');
    return html`
        <button
            type="button"
            class="btn ${paused ? 'btn-resume' : 'btn-pause'}"
            title="${i18n_pause}"
            aria-label="${i18n_pause}"
            @click=${() => (paused ? el.resume() : el.pause())}
        >
            <converse-icon class="fa ${paused ? 'fa-play' : 'fa-pause'}" size="1em"></converse-icon>
        </button>
        <button
            type="button"
            class="btn btn-stop"
            title="${i18n_send}"
            aria-label="${i18n_send}"
            @click=${() => el.stop()}
        >
            <converse-icon class="fa fa-paper-plane" color="var(--background-color)" size="1em"></converse-icon>
        </button>
    `;
}

/**
 * @param {import('../recorder').default} el
 */
const tplError = (el) => html`
    <div class="recorder-error" role="alert">
        <p class="error-message">${el.error_message}</p>
    </div>
`;

/**
 * @param {import('../recorder').default} el
 */
const tplRetry = (el) => html`
    <button type="button" class="btn btn-retry" @click=${() => el.send()}>
        ${el.recording.interrupted ? __('Send') : __('Retry')}
    </button>
`;

/**
 * The parts of the composer panel for each state, and what its close button does.
 * Closing while uploading leaves the upload to carry on in the chat.
 * @param {import('../recorder').default} el
 */
function getPanelParts(el) {
    const cancel = { label: __('Cancel and discard recording'), handler: () => el.cancel() };
    switch (el.state) {
        case REQUESTING:
            return { content: tplBusy(__('Requesting microphone access…')), close: cancel };
        case RECORDING:
        case PAUSED:
            return { content: tplRecordingStatus(el), actions: tplRecordingControls(el), close: cancel };
        case UPLOADING:
            return {
                content: tplBusy(__('Sending voice message…')),
                close: { label: __('Close'), handler: () => el.close() },
            };
        case ERROR:
            return {
                content: tplError(el),
                actions: el.recording ? tplRetry(el) : undefined,
                close: {
                    label: el.recording ? __('Discard recording') : __('Close'),
                    handler: () => el.cancel(),
                },
            };
    }
}

/**
 * @param {import('../recorder').default} el
 */
export default (el) =>
    html`<div class="audio-recorder audio-recorder--${el.state}">
        ${tplComposerPanel({
            kind: 'tool',
            role: 'region',
            label: __('Voice message recorder'),
            ...getPanelParts(el),
        })}
    </div>`;
