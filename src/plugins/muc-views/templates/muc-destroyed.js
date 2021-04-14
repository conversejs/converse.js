import { __ } from 'i18n';
import { html } from "lit";

const tpl_moved = (o) => {
    const i18n_moved = __('The conversation has moved to a new address. Click the link below to enter.');
    return html`
        <p class="moved-label">${i18n_moved}</p>
        <p class="moved-link">
            <a class="switch-chat" @click=${ev => o.onSwitch(ev)}>${o.moved_jid}</a>
        </p>`;
}

export default (o) => {
    const i18n_non_existent = __('This groupchat no longer exists');
    const i18n_reason = __('The following reason was given: "%1$s"', o.reason || '');
    return html`
        <div class="alert alert-danger">
            <h3 class="alert-heading disconnect-msg">${i18n_non_existent}</h3>
        </div>
        ${ o.reason ? html`<p class="destroyed-reason">${i18n_reason}</p>` : '' }
        ${ o.moved_jid ? tpl_moved(o) : '' }
    `;
}
