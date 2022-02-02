import avatar from 'shared/avatar/templates/avatar.js';
import { __ } from 'i18n';
import { html } from 'lit';
import { modal_close_button, modal_header_close_button } from 'plugins/modal/templates/buttons.js'


const remove_button = (o) => {
    const i18n_remove_contact = __('Remove as contact');
    return html`
        <button type="button" @click="${o.removeContact}" class="btn btn-danger remove-contact">
            <converse-icon
                class="fas fa-trash-alt"
                color="var(--text-color-lighten-15-percent)"
                size="1em"
            ></converse-icon>
            ${i18n_remove_contact}
        </button>
    `;
}


export default (o) => {
    const i18n_address = __('XMPP Address');
    const i18n_email = __('Email');
    const i18n_full_name = __('Full Name');
    const i18n_nickname = __('Nickname');
    const i18n_profile = __('The User\'s Profile Image');
    const i18n_refresh = __('Refresh');
    const i18n_role = __('Role');
    const i18n_url = __('URL');
    const avatar_data = {
        'alt_text': i18n_profile,
        'extra_classes': 'mb-3',
        'height': '120',
        'width': '120'
    }

    return html`
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="user-details-modal-label">${o.display_name}</h5>
                    ${modal_header_close_button}
                </div>
                <div class="modal-body">
                    ${ o.image ? html`<div class="mb-4">${avatar(Object.assign(o, avatar_data))}</div>` : '' }
                    ${ o.fullname ? html`<p><label>${i18n_full_name}:</label> ${o.fullname}</p>` : '' }
                    <p><label>${i18n_address}:</label> <a href="xmpp:${o.jid}">${o.jid}</a></p>
                    ${ o.nickname ? html`<p><label>${i18n_nickname}:</label> ${o.nickname}</p>` : '' }
                    ${ o.url ? html`<p><label>${i18n_url}:</label> <a target="_blank" rel="noopener" href="${o.url}">${o.url}</a></p>` : '' }
                    ${ o.email ? html`<p><label>${i18n_email}:</label> <a href="mailto:${o.email}">${o.email}</a></p>` : '' }
                    ${ o.role ? html`<p><label>${i18n_role}:</label> ${o.role}</p>` : '' }

                    <converse-omemo-fingerprints jid=${o.jid}></converse-omemo-fingerprints>
                </div>
                <div class="modal-footer">
                    ${modal_close_button}
                    <button type="button" class="btn btn-info refresh-contact"><i class="fa fa-refresh"> </i>${i18n_refresh}</button>
                    ${ (o.allow_contact_removal && o.is_roster_contact) ? remove_button(o) : '' }

                </div>
            </div>
        </div>
    `;
}
