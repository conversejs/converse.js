import { html } from 'lit';
import { _converse, u } from '@converse/headless';
import { __ } from 'i18n';

/**
 * @param {import('../occupant').default} el
 */
export default (el) => {
    const i18n_close = __('Hide');
    const i18n_no_occupant = __('No participant data found');
    const i18n_participants = __('Participants');
    const i18n_show_details = __('Show details');

    const jid = el.model?.get('jid');
    const nick = el.model?.get('nick');
    const role = u.firstCharToUpperCase(el.model?.get('role'));
    const affiliation = u.firstCharToUpperCase(el.model?.get('affiliation'));
    const hats = el.model?.get('hats')?.length ? el.model.get('hats').map(({ title }) => title) : [];

    return html` <span class="sidebar-occupant">
        <div class="sidebar-heading">
            <span
                ><button
                    type="button"
                    class="btn btn--transparent back-button"
                    @click=${() => el.muc.save({ 'sidebar_view': 'occupants' })}
                >
                    <converse-icon size="1em" class="fa fa-arrow-left"></converse-icon>
                </button>
                <a
                    @click="${(ev) => {
                        ev.preventDefault();
                        el.muc.save({ 'sidebar_view': 'occupants' });
                    }}"
                    >${i18n_participants}</a
                >
            </span>
            <converse-dropdown
                .items=${[
                    html`<a
                        class="dropdown-item show-occupant-modal"
                        role="button"
                        title="${i18n_show_details}"
                        @click=${() => el.showOccupantModal()}
                    >
                        <converse-icon class="fa fa-id-card" size="1em"></converse-icon>
                        ${i18n_show_details}
                    </a>`,
                    html`<a href="#" class="dropdown-item" role="button" @click=${() => el.closeSidebar()}>
                        <converse-icon size="1em" class="fa fa-times"></converse-icon>
                        ${i18n_close}
                    </a>`,
                ]}
            ></converse-dropdown>
        </div>

        ${el.model
            ? html`<div class="row">
                  <div class="col">
                      <a
                          title="${i18n_show_details}"
                          @click=${() => el.showOccupantModal()}
                          ><converse-avatar
                              .model=${el.model}
                              class="avatar modal-avatar justify-content-center"
                              name="${el.model.getDisplayName()}"
                              nonce=${el.getVcard()?.get('vcard_updated')}
                              height="120"
                              width="120"
                          ></converse-avatar>
                      </a>
                  </div>
              </div>`
            : ''}
        <ul class="occupant-details">
            ${el.model
                ? html` ${nick ? html`<li class="occupant-details-nickname">${nick}</li>` : ''}
                      <li class="occupant-details-jid">
                          ${jid ? html`<a @click="${() => el.openChat(jid)}">${jid}</a>` : ''}
                      </li>
                      <li>
                          ${affiliation && affiliation !== 'None'
                              ? html`<span class="badge text-bg-primary">${affiliation}</span>`
                              : ''}
                          ${role ? html`<span class="badge text-bg-secondary">${role}</span>` : ''}
                          ${hats.length
                              ? html`${hats.map((h) => html`<span class="badge text-bg-info">${h}</span>`)}`
                              : ''}
                      </li>`
                : html`<li>${i18n_no_occupant}</li>`}
        </ul>

        ${el.model
            ? html`<div class="chat-body">
                  <div class="chat-content chat-content-sendbutton" aria-live="polite">
                      <converse-chat-content .model="${el.model}"></converse-chat-content>
                  </div>
                  <converse-occupant-bottom-panel .model=${el.model} .muc=${el.muc} class="bottom-panel">
                  </converse-occupant-bottom-panel>
              </div>`
            : ''}
    </span>`;
};
