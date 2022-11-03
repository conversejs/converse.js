import 'shared/avatar/avatar.js';
import { __ } from 'i18n';
import { html } from "lit";
import { until } from 'lit/directives/until.js';
import { _converse, api } from "@converse/headless/core";


export default (el) => {
    const model = el.model ?? el.message;
    const jid = model?.get('jid');
    const vcard = el.getVcard();
    const nick = model.get('nick');
    const occupant_id = model.get('occupant_id');
    const role = el.model?.get('role');
    const affiliation = el.model?.get('affiliation');
    const hats = el.model?.get('hats')?.length ? el.model.get('hats') : null;
    const muc = el.model.collection.chatroom;

    const i18n_add_to_contacts = __('Add to Contacts');

    const can_see_real_jids = muc.features.get('nonanonymous') || muc.getOwnRole() === 'moderator';
    const not_me =  jid != _converse.bare_jid;

    const add_to_contacts = api.contacts.get(jid)
        .then(contact => !contact && not_me && can_see_real_jids)
        .then(add => add ? html`<li><button class="btn btn-primary" type="button" @click=${() => el.addToContacts()}>${i18n_add_to_contacts}</button></li>` : '');

    return html`
        <div class="row">
            <div class="col-auto">
                <converse-avatar
                    class="avatar modal-avatar"
                    .data=${vcard?.attributes}
                    nonce=${vcard?.get('vcard_updated')}
                    height="120" width="120"></converse-avatar>
            </div>
            <div class="col">
                <ul class="occupant-details">
                    <li>
                        ${ nick ? html`<div class="row"><strong>${__('Nickname')}:</strong></div><div class="row">${nick}</div>` : '' }
                    </li>
                    <li>
                        ${ jid ? html`<div class="row"><strong>${__('XMPP Address')}:</strong></div><div class="row">${jid}</div>` : '' }
                    </li>
                    <li>
                        ${ affiliation ? html`<div class="row"><strong>${__('Affiliation')}:</strong></div><div class="row">${affiliation}</div>` : '' }
                    </li>
                    <li>
                        ${ role ? html`<div class="row"><strong>${__('Roles')}:</strong></div><div class="row">${role}</div>` : '' }
                    </li>
                    <li>
                        ${ hats ? html`<div class="row"><strong>${__('Hats')}:</strong></div><div class="row">${hats}</div>` : '' }
                    </li>
                    <li>
                        ${ occupant_id ? html`<div class="row"><strong>${__('Occupant Id')}:</strong></div><div class="row">${occupant_id}</div>` : '' }
                    </li>
                    ${ until(add_to_contacts, '') }
                </ul>
            </div>
        </div>
    `;
}
