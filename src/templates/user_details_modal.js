import { __ } from '@converse/headless/i18n';
import { html } from "lit-html";
import avatar from "./avatar.js";
import { modal_close_button, modal_header_close_button } from "./buttons"


const i18n_address = __('XMPP Address');
const i18n_email = __('Email');
const i18n_fingerprints = __('OMEMO Fingerprints');
const i18n_full_name = __('Full Name');
const i18n_nickname = __('Nickname');
const i18n_profile = __('The User\'s Profile Image');
const i18n_refresh = __('Refresh');
const i18n_role = __('Role');
const i18n_url = __('URL');
const i18n_remove_contact = __('Remove as contact');
const i18n_trusted = __('Trusted');
const i18n_untrusted = __('Untrusted');
const i18n_no_devices = __("No OMEMO-enabled devices found");

const avatar_data = {
    'alt_text': i18n_profile,
    'extra_classes': 'mb-3'
}


const device_fingerprint = (o) => {
    if (o.device.get('bundle') && o.device.get('bundle').fingerprint) {
        return html`
            <li class="list-group-item">
                <form class="fingerprint-trust">
                <div class="btn-group btn-group-toggle">
                    <label class="btn btn--small ${(o.device.get('trusted') !== -1) ? 'btn-primary active' : 'btn-secondary'}">
                        <input type="radio" name="${o.device.get('id')}" value="1" ?checked=${o.device.get('trusted') !== -1}>${i18n_trusted}
                    </label>
                    <label class="btn btn--small ${(o.device.get('trusted') !== -1) ? 'btn-primary active' : 'btn-secondary'}">
                        <input type="radio" name="${o.device.get('id')}" value="-1" ?checked=${o.device.get('trusted') === -1}>${i18n_untrusted}
                    </label>
                </div>
                <span class="fingerprint">${o.utils.formatFingerprint(o.device.get('bundle').fingerprint)}</span>
                </form>
            </li>
        `;
    } else {
        return ''
    }
}


const fingerprints = (o) => {
    const devices = o.view.devicelist.devices;
    return html`
        <hr/>
        <ul class="list-group fingerprints">
            <li class="list-group-item active">${i18n_fingerprints}</li>
            ${ devices.length ?
                    devices.map(device => device_fingerprint(Object.assign({device}, o))) :
                    html`<li class="list-group-item"> ${i18n_no_devices} </li>` }
        </ul>
    `;
}

const remove_button = (o) => {
    return html`
        <button type="button" @click="${o.removeContact}" class="btn btn-danger remove-contact">
            <i class="far fa-trash-alt"></i>${i18n_remove_contact}
        </button>
    `;
}


export default (o) => html`
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="user-details-modal-label">${o.display_name}</h5>
                ${modal_header_close_button}
            </div>
            <div class="modal-body">
                ${ o.image ? avatar(Object.assign(avatar_data, o)) : '' }
                ${ o.fullname ? html`<p><label>${i18n_full_name}:</label> ${o.fullname}</p>` : '' }
                <p><label>${i18n_address}:</label> <a href="xmpp:${o.jid}">${o.jid}</a></p>
                ${ o.nickname ? html`<p><label>${i18n_nickname}:</label> ${o.nickname}</p>` : '' }
                ${ o.url ? html`<p><label>${i18n_url}:</label> <a target="_blank" rel="noopener" href="${o.url}">${o.url}</a></p>` : '' }
                ${ o.email ? html`<p><label>${i18n_email}:</label> <a href="mailto:${o.email}">${o.email}</a></p>` : '' }
                ${ o.role ? html`<p><label>${i18n_role}:</label> ${o.role}</p>` : '' }

                ${ (o._converse.pluggable.plugins['converse-omemo'].enabled(o._converse)) ? fingerprints(o) : '' }
            </div>
            <div class="modal-footer">
                ${modal_close_button}
                <button type="button" class="btn btn-info refresh-contact"><i class="fa fa-refresh"> </i>${i18n_refresh}</button>
                ${ (o.allow_contact_removal && o.is_roster_contact) ? remove_button(o) : '' }

            </div>
        </div>
    </div>
`;
