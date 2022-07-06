import { html } from 'lit';
import { __ } from "i18n";
import { JINGLE_CALL_STATUS } from '../constants';

export default (el) => {
    const call_color = '--chat-toolbar-btn-color';
    const end_call_color = '--chat-toolbar-btn-close-color';
    const jingle_status = el.model.get('jingle_status');
    let button_color, i18n_start_call;
    if (jingle_status === JINGLE_CALL_STATUS.OUTGOING_PENDING || jingle_status === JINGLE_CALL_STATUS.ACTIVE) {
        button_color = end_call_color;
        i18n_start_call = __('Stop the call');
    }
    else {
        button_color = call_color;
        i18n_start_call = __('Start a call');
    }
    return html`
        <button class="toggle-call" @click=${el.toggleJingleCallStatus} title="${i18n_start_call}">
            <converse-icon id="temp" color="var(${ button_color })" class="fa fa-phone" size="1em"></converse-icon>
        </button>`
}
