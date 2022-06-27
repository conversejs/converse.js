import { html } from 'lit';
import { JINGLE_CALL_STATUS } from '../constants';

export default (el) => {
    return html`
        <div>
            ${ (el.model.get('jingle_status')) === JINGLE_CALL_STATUS.PENDING ? html`<span class="badge bg-secondary">Calling...</span>` : html``}
        </div>
    `;
}
