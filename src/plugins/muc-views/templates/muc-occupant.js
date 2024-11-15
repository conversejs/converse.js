import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import { _converse, api, u } from "@converse/headless";
import { __ } from 'i18n';

/**
 * @param {import('../occupant').default} el
 */
export default (el) => {
    const i18n_participants = __('Participants');
    const i18n_add_to_contacts = __('Add to Contacts');
    const i18n_no_occupant = __('No participant data found');

    const jid = el.model?.get('jid');
    const nick = el.model?.get('nick');
    const role = u.firstCharToUpperCase(el.model?.get('role'));
    const affiliation = u.firstCharToUpperCase(el.model?.get('affiliation'));
    const hats = el.model?.get('hats')?.length ? el.model.get('hats').map(({ title }) => title) : [];

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
                <div class="col">
                    <converse-avatar
                        .model=${el.model}
                        class="avatar modal-avatar justify-content-center"
                        name="${el.model.getDisplayName()}"
                        nonce=${el.getVcard()?.get('vcard_updated')}
                        height="120" width="120"></converse-avatar>
                </div>
            </div>
            <div class="row">
                <div class="col-auto">
                    <ul class="occupant-details">
                        ${ nick ? html`<li class="occupant-details-nickname">${nick}</li>` : '' }
                        <li>
                            ${ jid ? html`<div class="row"><strong class="g-0">${__('XMPP Address')}:</strong></div><div class="row">${jid}</div>` : '' }
                        <li>
                        <li>
                            <span class="badge text-bg-primary">${affiliation}</span>
                            <span class="badge text-bg-secondary">${role}</span>
                            ${ hats.length ? html`${hats.map((h) => html`<span class="badge text-bg-info">${h}</span>`)}` : '' }
                        </li>
                        ${ until(add_to_contacts, '') }
                    </ul>
                </div>
            </div>` : html`<p>${i18n_no_occupant}</p>`
        }`;
};
