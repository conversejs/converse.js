import { html } from 'lit';
import { __ } from 'i18n';
import { constants } from '@converse/headless';
import { getCallName, formatDuration, endedSummary } from '../utils.js';

const { CALL_STATES, CALL_DIRECTION } = constants;

/**
 * @param {() => void} handler
 * @param {string} icon - sprite icon name (e.g. `fa-phone`)
 * @param {string} title
 * @param {string} extra_class
 */
const tplButton = (handler, icon, title, extra_class) => html`
    <button type="button" class="btn call-action ${extra_class}" @click=${handler} title="${title}">
        <converse-icon class="fa ${icon}" size="1.2em"></converse-icon>
    </button>`;

/**
 * @param {import('../call.js').default} el
 */
function tplActions(el) {
    const call = el.model;
    const state = call.get('state');
    const incoming = call.get('direction') === CALL_DIRECTION.INCOMING;

    const hangup = tplButton(() => el.hangup(), 'fa-times', __('Hang up'), 'hangup');

    if (state === CALL_STATES.RINGING && incoming) {
        return html`
            ${tplButton(() => el.accept(), 'fa-phone', __('Accept'), 'accept')}
            ${tplButton(() => el.reject(), 'fa-times', __('Decline'), 'reject')}`;
    }

    if (state === CALL_STATES.ACTIVE) {
        const muted = call.get('muted_audio');
        const mute = tplButton(
            () => el.toggleMute(),
            muted ? 'fa-volume-xmark' : 'fa-volume-high',
            muted ? __('Unmute') : __('Mute'),
            `mute ${muted ? 'is-muted' : ''}`
        );
        return html`${mute}${hangup}`;
    }

    if ([CALL_STATES.ENDED, CALL_STATES.FAILED].includes(state)) {
        return '';
    }

    // calling / ringing (outgoing) / connecting
    return hangup;
}

/**
 * @param {import('../call.js').default} el
 */
function statusText(el) {
    const call = el.model;
    const incoming = call.get('direction') === CALL_DIRECTION.INCOMING;
    switch (call.get('state')) {
        case CALL_STATES.CALLING:
            return __('Calling…');
        case CALL_STATES.RINGING:
            return incoming ? __('Incoming call') : __('Ringing…');
        case CALL_STATES.CONNECTING:
            return incoming ? __('Connecting…') : __('Ringing…');
        case CALL_STATES.ACTIVE:
            return formatDuration(Date.now() - call.get('started_at'));
        case CALL_STATES.ENDED:
        case CALL_STATES.FAILED:
            return endedSummary(call);
        default:
            return '';
    }
}

/**
 * @param {import('../call.js').default} el
 */
export default (el) => {
    const call = el.model;
    const name = getCallName(call);
    return html`
        <div class="call-card call-card--${call.get('state')}">
            <converse-avatar .model=${call} name="${name}" height="48" width="48" class="avatar"></converse-avatar>
            <div class="call-info">
                <span class="call-name">${name}</span>
                <span class="call-status">${statusText(el)}</span>
            </div>
            <div class="call-actions">${tplActions(el)}</div>
            <audio autoplay .srcObject=${call.remote_stream}></audio>
        </div>`;
};
