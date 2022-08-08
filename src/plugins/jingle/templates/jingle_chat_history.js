import { __ } from 'i18n';
import { html } from "lit";
import { JINGLE_CALL_STATUS } from "../constants.js";

export default (o) => {
    const ended_call = __('Call Ended');
    const pending_call = __('Calling');
    return html`
    ${ (o.get('jingle_status') === JINGLE_CALL_STATUS.OUTGOING_PENDING &&  o.get('jingle_status')!= undefined ) ? html`${pending_call}` : html`${ended_call}` }
`}


