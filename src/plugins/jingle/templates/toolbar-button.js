import { html } from 'lit';
import { __ } from "i18n";
import { JINGLE_CALL_STATUS } from '../constants';

export default (el) => {
    const call_color = '--chat-toolbar-btn-color';
    const end_call_color = '--chat-toolbar-btn-close-color';
    const i18n_start_call = __('Start a call');
    const jingle_status = el.model.get('jingle_status');
    return html`
        <button class="toggle-call" @click=${el.toggleJingleCallStatus()} title="${i18n_start_call}">
            <converse-icon id="temp" color="var(${( jingle_status ||jingle_status === JINGLE_CALL_STATUS.PENDING ||  jingle_status === JINGLE_CALL_STATUS.ACTIVE ) ? end_call_color : call_color })" class="fa fa-phone" size="1em"></converse-icon>
        </button>`
}
