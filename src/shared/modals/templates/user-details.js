import avatar from 'shared/avatar/templates/avatar.js';
import { __ } from 'i18n';
import { api } from "@converse/headless";
import { html } from 'lit';
import { modal_close_button } from "plugins/modal/templates/buttons.js";

const remove_button = (el) => {
    const i18n_remove_contact = __('Remove as contact');
    return html`
        <button type="button" @click="${ev => el.removeContact(ev)}" class="btn btn-danger remove-contact">
            <converse-icon
                class="fas fa-trash-alt"
                color="var(--foreground-color)"
                size="1em"
            ></converse-icon>&nbsp;${i18n_remove_contact}
        </button>
    `;
}

export const tplFooter = (el) => {
    const is_roster_contact = el.model.contact !== undefined;
    const i18n_refresh = __('Refresh');
    const allow_contact_removal = api.settings.get('allow_contact_removal');
    return html`
        <div class="modal-footer">
            ${ modal_close_button }
            <button type="button" class="btn btn-info refresh-contact" @click=${ev => el.refreshContact(ev)}>
                <converse-icon
                    class="fa fa-refresh"
                    color="var(--foreground-color)"
                    size="1em"
                ></converse-icon>&nbsp;${i18n_refresh}</button>
            ${ (allow_contact_removal && is_roster_contact) ? remove_button(el) : '' }
        </div>
    `;
}


export const tplUserDetailsModal = (el) => {
    const vcard = el.model?.vcard;
    const vcard_json = vcard ? vcard.toJSON() : {};
    const o = { ...el.model.toJSON(), ...vcard_json };

    const i18n_address = __('XMPP Address');
    const i18n_email = __('Email');
    const i18n_full_name = __('Full Name');
    const i18n_nickname = __('Nickname');
    const i18n_profile = __('The User\'s Profile Image');
    const i18n_role = __('Role');
    const i18n_url = __('URL');
    const avatar_data = {
        'alt_text': i18n_profile,
        'extra_classes': 'mb-3',
        'height': '120',
        'width': '120'
    }

    return html`
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
    `;
}
