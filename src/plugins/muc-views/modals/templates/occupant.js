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

    const allowed_commands = muc.getAllowedCommands();
    const may_moderate = allowed_commands.includes('modtools');

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
                        <div class="row"><strong>${__('Affiliation')}:</strong></div>
                        <div class="row">${affiliation}&nbsp;
                            ${ may_moderate ? html`
                                <a href="#"
                                data-form="affiliation-form"
                                class="toggle-form right"
                                color="var(--subdued-color)"
                                @click=${(ev) => el.toggleForm(ev)}><converse-icon class="fa fa-wrench" size="1em"></converse-icon>
                                </a>
                                ${ el.show_affiliation_form ? html`<converse-muc-affiliation-form jid=${jid} .muc=${muc} affiliation=${affiliation}></converse-muc-affiliation-form>` : '' }` : ''
                            }
                        </div>
                    </li>
                    <li>
                        <div class="row"><strong>${__('Role')}:</strong></div>
                        <div class="row">${role}&nbsp;
                            ${ may_moderate && role ? html`
                                <a href="#"
                                   data-form="row-form"
                                   class="toggle-form right"
                                   color="var(--subdued-color)"
                                   @click=${(ev) => el.toggleForm(ev)}><converse-icon class="fa fa-wrench" size="1em"></converse-icon>
                                </a>
                                ${ el.show_role_form ? html`<converse-muc-role-form jid=${jid} .muc=${muc} role=${role}></converse-muc-role-form>` : '' }` : ''
                            }
                        </div>
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
