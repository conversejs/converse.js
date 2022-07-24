import { html } from 'lit';
import { __ } from 'i18n';
import { JINGLE_CALL_STATUS } from '../constants';

const tpl_active_call = (o) => {
    const button = __('End Call');
    return html`
        <div>
            <a class="jingle-call-initiated-button" @click=${o.endCall}>${ button }</a>
        </div>
    `;
}

    // ${(jingle_status === JINGLE_CALL_STATUS.ACTIVE) ? html`${tpl_active_call(el)}` : html`` }
export default (el) => {
    const jingle_status = el.model.get('jingle_status');
    return html`
        <div>
            ${(jingle_status === JINGLE_CALL_STATUS.OUTGOING_PENDING) ? html`Calling...` : '' }
        </div>
        <div>
            ${(jingle_status === JINGLE_CALL_STATUS.OUTGOING_PENDING) ? tpl_active_call(el) : '' }
            ${(jingle_status === JINGLE_CALL_STATUS.ENDED) ? html`Call Ended` :  '' }
        </div>
    `;
}
