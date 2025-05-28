import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import { api, converse, _converse } from '@converse/headless';
import { getGroupsAutoCompleteList } from 'plugins/rosterview/utils.js';
import { __ } from 'i18n';

const { Strophe } = converse.env;

/**
 * @param {import('../user-details').default} el
 */
function tplUnblockButton(el) {
    const i18n_block = __('Remove from blocklist');
    return html`
        <button type="button" @click="${(ev) => el.unblockContact(ev)}" class="btn btn-danger">
            <converse-icon class="fas fa-times" color="var(--background-color)" size="1em"></converse-icon
            >&nbsp;${i18n_block}
        </button>
    `;
}

/**
 * @param {import('../user-details').default} el
 */
function tplBlockButton(el) {
    const i18n_block = __('Add to blocklist');
    return html`
        <button type="button" @click="${(ev) => el.blockContact(ev)}" class="btn btn-danger">
            <converse-icon class="fas fa-times" color="var(--background-color)" size="1em"></converse-icon
            >&nbsp;${i18n_block}
        </button>
    `;
}

/**
 * @param {import('../user-details').default} el
 */
function tplAddButton(el) {
    const i18n_add_contact = __('Add as contact');
    return html`
        <button type="button" @click="${(ev) => el.addContact(ev)}" class="btn btn-success add-contact">
            <converse-icon class="fas fa-user-plus" color="var(--background-color)" size="1em"></converse-icon
            >&nbsp;${i18n_add_contact}
        </button>
    `;
}

/**
 * @param {import('../user-details').default} el
 */
function tplRemoveButton(el) {
    const i18n_remove_contact = __('Remove as contact');
    return html`
        <button type="button" @click="${(ev) => el.removeContact(ev)}" class="btn btn-danger remove-contact">
            <converse-icon class="fas fa-trash-alt" color="var(--background-color)" size="1em"></converse-icon
            >&nbsp;${i18n_remove_contact}
        </button>
    `;
}

/**
 * @param {import('../user-details').default} el
 */
function tplAcceptButton(el) {
    const i18n_accept = __('Accept');
    return html`
        <button type="button" @click="${(ev) => el.acceptContactRequest(ev)}" class="btn btn-success accept-contact-request">
            <converse-icon class="fas fa-user-plus" color="var(--background-color)" size="1em"></converse-icon
            >&nbsp;${i18n_accept}
        </button>
    `;
}

/**
 * @param {import('../user-details').default} el
 */
function tplDeclineButton(el) {
    const i18n_decline = __('Decline');
    return html`
        <button type="button" @click="${(ev) => el.declineContactRequest(ev)}" class="btn btn-danger decline-contact-request">
            <converse-icon class="fas fa-user-plus" color="var(--background-color)" size="1em"></converse-icon
            >&nbsp;${i18n_decline}
        </button>
    `;
}

/**
 * @param {import('../user-details').default} el
 */
export function tplUserDetailsModal(el) {
    const vcard = el.model?.vcard;
    const vcard_json = vcard ? vcard.toJSON() : {};
    const o = { ...el.model.toJSON(), ...vcard_json };

    const contact = el.getContact();
    const is_roster_contact = contact && !contact.isUnsaved();
    const allow_contact_removal = api.settings.get('allow_contact_removal');

    const domain = _converse.session.get('domain');
    const blocking_supported = api.disco.supports(Strophe.NS.BLOCKING, domain).then(
        /** @param {boolean} supported */
        async (supported) => {
            const blocklist = await api.blocklist.get();
            if (supported) {
                if (blocklist.get(el.model.get('jid'))) {
                    tplUnblockButton(el);
                } else {
                    tplBlockButton(el);
                }
            }
        }
    );

    const i18n_address = __('XMPP Address');
    const i18n_email = __('Email');
    const i18n_full_name = __('Full Name');
    const i18n_nickname = __('Nickname');
    const i18n_role = __('Role');
    const i18n_url = __('URL');
    const i18n_groups = __('Groups');
    const i18n_groups_help = __('Use commas to separate multiple values');
    const i18n_omemo = __('OMEMO');
    const i18n_profile = __('Profile');
    const ii18n_edit = __('Edit');

    const navigation_tabs = [
        html`<li role="presentation" class="nav-item">
            <a
                class="nav-link ${el.tab === 'profile' ? 'active' : ''}"
                id="profile-tab"
                href="#profile-tabpanel"
                aria-controls="profile-tabpanel"
                role="tab"
                @click="${(ev) => el.switchTab(ev)}"
                data-name="profile"
                data-toggle="tab"
                >${i18n_profile}</a
            >
        </li>`,
    ];

    if (is_roster_contact) {
        navigation_tabs.push(
            html`<li role="presentation" class="nav-item">
                <a
                    class="nav-link ${el.tab === 'edit' ? 'active' : ''}"
                    id="edit-tab"
                    href="#edit-tabpanel"
                    aria-controls="edit-tabpanel"
                    role="tab"
                    @click="${(ev) => el.switchTab(ev)}"
                    data-name="edit"
                    data-toggle="tab"
                    >${ii18n_edit}</a
                >
            </li>`
        );
    }

    if (_converse.pluggable.plugins['converse-omemo']?.enabled(_converse)) {
        navigation_tabs.push(
            html`<li role="presentation" class="nav-item">
                <a
                    class="nav-link ${el.tab === 'omemo' ? 'active' : ''}"
                    id="omemo-tab"
                    href="#omemo-tabpanel"
                    aria-controls="omemo-tabpanel"
                    role="tab"
                    @click="${(ev) => el.switchTab(ev)}"
                    data-name="omemo"
                    data-toggle="tab"
                    >${i18n_omemo}</a
                >
            </li>`
        );
    }

    const name = contact?.get('nickname') || contact.vcard?.get('fullname');
    const groups = contact?.get('groups') || [];

    return html`
        <ul class="nav nav-pills justify-content-center">
            ${navigation_tabs}
        </ul>
        <div class="tab-content">
            <div
                class="tab-pane ${el.tab === 'profile' ? 'active' : ''}"
                id="profile-tabpanel"
                role="tabpanel"
                aria-labelledby="profile-tab"
            >
                <div class="mb-4 centered">
                    <converse-avatar
                        .model="${el.model}"
                        name="${el.model.getDisplayName()}"
                        height="140"
                        width="140"
                    ></converse-avatar>
                </div>
                ${o.fullname
                    ? html`
                          <div class="row mb-2">
                              <div class="col-sm-4"><label>${i18n_full_name}:</label></div>
                              <div class="col-sm-8">${o.fullname}</div>
                          </div>
                      `
                    : ''}
                <div class="row mb-2">
                    <div class="col-sm-4"><label>${i18n_address}:</label></div>
                    <div class="col-sm-8"><a href="xmpp:${o.jid}">${o.jid}</a></div>
                </div>
                ${o.nickname
                    ? html`
                          <div class="row mb-2">
                              <div class="col-sm-4"><label>${i18n_nickname}:</label></div>
                              <div class="col-sm-8">${o.nickname}</div>
                          </div>
                      `
                    : ''}
                ${o.url
                    ? html`
                          <div class="row mb-2">
                              <div class="col-sm-4"><label>${i18n_url}:</label></div>
                              <div class="col-sm-8">
                                  <a target="_blank" rel="noopener" href="${o.url}">${o.url}</a>
                              </div>
                          </div>
                      `
                    : ''}
                ${o.email
                    ? html`
                          <div class="row mb-2">
                              <div class="col-sm-4"><label>${i18n_email}:</label></div>
                              <div class="col-sm-8"><a href="mailto:${o.email}">${o.email}</a></div>
                          </div>
                      `
                    : ''}
                ${o.role
                    ? html`
                          <div class="row mb-2">
                              <div class="col-sm-4"><label>${i18n_role}:</label></div>
                              <div class="col-sm-8">${o.role}</div>
                          </div>
                      `
                    : ''}
                ${groups.length
                    ? html`
                          <div class="row mb-2">
                              <div class="col-sm-4"><label>${i18n_groups}:</label></div>
                              <div class="col-sm-8">
                                  ${groups.map(
                                      /** @param {string} group */ (group) =>
                                          html`<span class="badge badge-roster-group me-1">${group}</span>`
                                  )}
                              </div>
                          </div>
                      `
                    : ''}

                <hr />
                ${contact.get('requesting')
                    ? html`<div class="row mb-2">
                              <div class="col-sm-4"><label>${__('Contact Request')}:</label></div>
                              <div class="col-sm-8">${tplAcceptButton(el)} ${tplDeclineButton(el)}</div>
                          </div>`
                    : ''}
                ${!is_roster_contact ? tplAddButton(el) : ''}
                ${!contact
                    ? until(
                          blocking_supported.then(() => tplBlockButton(el)),
                          ''
                      )
                    : ''}
            </div>

            ${is_roster_contact
                ? html` <div
                      class="tab-pane ${el.tab === 'edit' ? 'active' : ''}"
                      id="edit-tabpanel"
                      role="tabpanel"
                      aria-labelledby="edit-tab"
                  >
                      ${el.tab === 'edit'
                          ? html`<form class="converse-form" @submit=${(ev) => el.updateContact(ev)}>
                                    <div class="mb-3">
                                        <label class="form-label clearfix" for="name">${__('Name')}:</label>
                                        <input type="text" name="name" value="${name}" class="form-control" />
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label clearfix" for="name">${i18n_groups}:</label>
                                        <div class="mb-1">
                                            <small class="form-text text-muted">${i18n_groups_help}</small>
                                        </div>
                                        <converse-autocomplete
                                            .list=${getGroupsAutoCompleteList()}
                                            name="groups"
                                            value="${groups}"
                                        ></converse-autocomplete>
                                    </div>
                                    <button type="submit" class="btn btn-primary">${__('Update')}</button>
                                </form>
                                <hr />

                                ${allow_contact_removal && is_roster_contact ? tplRemoveButton(el) : ''}
                                ${until(
                                    blocking_supported.then(() => tplBlockButton(el)),
                                    ''
                                )}`
                          : ''}
                  </div>`
                : ''}
            ${_converse.pluggable.plugins['converse-omemo']?.enabled(_converse)
                ? html`<div
                      class="tab-pane ${el.tab === 'omemo' ? 'active' : ''}"
                      id="omemo-tabpanel"
                      role="tabpanel"
                      aria-labelledby="omemo-tab"
                  >
                      ${el.tab === 'omemo'
                          ? html`<converse-omemo-fingerprints jid=${o.jid}></converse-omemo-fingerprints>`
                          : ''}
                  </div>`
                : ''}
        </div>
    `;
}
