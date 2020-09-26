import { __ } from '../i18n';
import { html } from "lit-html";


const tpl_moved = (jid) => {
    const i18n_moved = __('The conversation has moved. Click below to enter.');
    return html`
        <p class="moved-label">${i18n_moved}</p>
        <p class="moved-link"><a class="switch-chat" href="#">${jid}</a></p>`;
}

export default (jid, reason) => {
    const i18n_non_existent = __('This groupchat no longer exists');
    return html`
        <div class="alert alert-danger">
            <h3 class="alert-heading disconnect-msg">${i18n_non_existent}</h3>
            ${ reason ? html`<p class="destroyed-reason">"${reason}"</p>` : '' }
            ${ jid ? tpl_moved(jid) : '' }
        </div>`;
}
