import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import { _converse, api } from "@converse/headless";
import { __ } from 'i18n';

/**
 * @param {import('../occupant').default} el
 */
export default (el) => {
    const i18n_nickname = __('Nickname');
    const i18n_affiliation = __('Affiliation');
    const i18n_participants = __('Participants');
    const i18n_add_to_contacts = __('Add to Contacts');
    const i18n_no_occupant = __('No participant data found');

    const jid = el.model?.get('jid');
    const nick = el.model?.get('nick');
    const occupant_id = el.model?.get('occupant_id');
    const role = el.model?.get('role');
    const affiliation = el.model?.get('affiliation');
    const hats = el.model?.get('hats')?.length ? el.model.get('hats') : null;

    const allowed_commands = el.muc.getAllowedCommands();
    const may_moderate = allowed_commands.includes('modtools');
    const can_see_real_jids = el.muc.features.get('nonanonymous') || el.muc.getOwnRole() === 'moderator';
    const bare_jid = _converse.session.get('bare_jid');
    const not_me =  jid != bare_jid;

    const add_to_contacts = api.settings.get('singleton')
        ? '' // in singleton mode, there is no roster, so adding to contact makes no sense.
        : api.contacts.get(jid)
            .then(contact => !contact && not_me && can_see_real_jids)
            .then(add => add ? html`<li><button class="btn btn-primary" type="button" @click=${() => el.addToContacts()}>${i18n_add_to_contacts}</button></li>` : '');

    return html`<span class="sidebar-heading">
            <button
                type="button"
                class="btn btn--transparent back-button"
                @click=${() => el.muc.save({ 'sidebar_view': 'occupants' })}
            >
                <converse-icon size="1em" class="fa fa-arrow-left"></converse-icon>
            </button>
            ${i18n_participants}</span
        >

        ${el.model ? html`
            <div class="row">
                <div class="col-auto">
                    <converse-avatar
                        .model=${el.model}
                        class="avatar modal-avatar"
                        name="${el.model.getDisplayName()}"
                        nonce=${el.getVcard()?.get('vcard_updated')}
                        height="120" width="120"></converse-avatar>
                </div>
                <div class="col">
                    <ul class="occupant-details">
                        <li>
                            ${ nick ? html`<div class="row"><strong class="g-0">${i18n_nickname}:</strong></div><div class="row">${nick}</div>` : '' }
                        </li>
                        <li>
                            ${ jid ? html`<div class="row"><strong class="g-0">${__('XMPP Address')}:</strong></div><div class="row">${jid}</div>` : '' }
                        </li>
                        <li>
                            <div class="row"><strong class="g-0">${i18n_affiliation}:</strong></div>
                            <div class="row">${affiliation}&nbsp;
                                ${ may_moderate ? html`
                                    <a href="#"
                                    data-form="affiliation-form"
                                    class="toggle-form right"
                                    color="var(--secondary-color)"
                                    @click=${(ev) => el.toggleForm(ev)}><converse-icon class="fa fa-wrench" size="1em"></converse-icon>
                                    </a>
                                    ${ el.show_affiliation_form ? html`<converse-muc-affiliation-form jid=${jid} .muc=${el.muc} affiliation=${affiliation}></converse-muc-affiliation-form>` : '' }` : ''
                                }
                            </div>
                        </li>
                        <li>
                            <div class="row"><strong class="g-0">${__('Role')}:</strong></div>
                            <div class="row">${role}&nbsp;
                                ${ may_moderate && role ? html`
                                    <a href="#"
                                    data-form="row-form"
                                    class="toggle-form right"
                                    color="var(--secondary-color)"
                                    @click=${(ev) => el.toggleForm(ev)}><converse-icon class="fa fa-wrench" size="1em"></converse-icon>
                                    </a>
                                    ${ el.show_role_form ? html`<converse-muc-role-form jid=${jid} .muc=${el.muc} role=${role}></converse-muc-role-form>` : '' }` : ''
                                }
                            </div>
                        </li>
                        <li>
                            ${ hats ? html`<div class="row"><strong class="g-0">${__('Hats')}:</strong></div><div class="row">${hats}</div>` : '' }
                        </li>
                        <li>
                            ${ occupant_id ? html`<div class="row"><strong class="g-0">${__('Occupant Id')}:</strong></div><div class="row">${occupant_id}</div>` : '' }
                        </li>
                        ${ until(add_to_contacts, '') }
                    </ul>
                </div>
            </div>` : html`<p>${i18n_no_occupant}</p>`
        }`;
};
