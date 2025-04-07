import 'shared/avatar/avatar.js';
import { __ } from 'i18n';
import { html } from "lit";
import { until } from 'lit/directives/until.js';
import { _converse, api } from "@converse/headless";

import '../styles/occupant.scss';

/**
 * @param {import('../occupant').default} el
 */
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

    const allowed_commands = muc.getAllowedCommands();
    const may_moderate = allowed_commands.includes('modtools');
    const can_see_real_jids = muc.features.get('nonanonymous') || muc.getOwnRole() === 'moderator';

    const bare_jid = _converse.session.get('bare_jid');
    const not_me = jid != bare_jid;

    const add_to_contacts = api.settings.get('singleton')
        ? '' // in singleton mode, there is no roster, so adding to contact makes no sense.
        : api.contacts.get(jid)
            .then((contact) => !contact && not_me && can_see_real_jids)
            .then((add) => add ? html`<li><button class="btn btn-primary" type="button" @click=${() => el.addToContacts()}>${i18n_add_to_contacts}</button></li>` : '');

    return html`
        <div class="row">
            <div class="col-auto">
                <converse-avatar
                    .model=${el.model}
                    class="avatar modal-avatar"
                    name="${el.model.getDisplayName()}"
                    nonce=${vcard?.get('vcard_updated')}
                    height="120" width="120"></converse-avatar>
            </div>
            <div class="col">
                <ul class="occupant-details list-unstyled">
                    <li class="row mb-2">
                        <div class="col text-start"><strong>${__('Nickname')}:</strong></div>
                        <div class="col text-end">${nick}</div>
                    </li>
                    <li class="row mb-2">
                        <div class="col text-start"><strong>${__('XMPP Address')}:</strong></div>
                        <div class="col text-end">
                          ${jid ? html`<a href="#" @click="${el.openChat}">${jid}</a>` : ''}
                        </div>
                    </li>
                    <li class="row mb-2">
                        <div class="col text-start"><strong>${__('Affiliation')}:</strong></div>
                        <div class="col text-end">${affiliation}&nbsp;
                            ${may_moderate ? html`
                                <a href="#"
                                   data-form="affiliation-form"
                                   class="toggle-form"
                                   @click=${(ev) => el.toggleForm(ev)}><converse-icon class="fa fa-wrench" size="1em"></converse-icon>
                                </a>` : ''
                            }
                        </div>
                        ${el.show_affiliation_form ?
                            html`<div class="row"><converse-muc-affiliation-form jid=${jid} .muc=${muc} affiliation=${affiliation}></converse-muc-affiliation-form></div>` : ''}
                    </li>
                    <li class="row mb-2">
                        <div class="col text-start"><strong>${__('Role')}:</strong></div>
                        <div class="col text-end">${role}&nbsp;
                            ${may_moderate && role ? html`
                                <a href="#"
                                   data-form="row-form"
                                   class="toggle-form"
                                   @click=${(ev) => el.toggleForm(ev)}><converse-icon class="fa fa-wrench" size="1em"></converse-icon>
                                </a>` : ''
                            }
                        </div>
                        ${el.show_role_form ? html`<div class="row"><converse-muc-role-form jid=${jid} .muc=${muc} role=${role}></converse-muc-role-form></div>` : ''}
                    </li>
                    <li class="row mb-2">
                        <div class="col text-start"><strong>${__('Hats')}:</strong></div>
                        <div class="col text-end">${hats}</div>
                    </li>
                    <li class="row mb-2">
                        <div class="col text-start"><strong>${__('Occupant Id')}:</strong></div>
                        <div class="col text-end text-occupant-id">${occupant_id}</div>
                    </li>
                    ${until(add_to_contacts, '')}
                </ul>
            </div>
        </div>
    `;
}
