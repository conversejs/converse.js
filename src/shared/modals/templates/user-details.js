import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import { api, converse, _converse } from '@converse/headless';
import { __ } from 'i18n';
import avatar from 'shared/avatar/templates/avatar.js';

const { Strophe } = converse.env;

/**
 * @param {import('../user-details').default} el
 */
function tplUnblockButton(el) {
    const i18n_block = __('Remove from blocklist');
    return html`
        <button type="button" @click="${(ev) => el.unblockContact(ev)}" class="btn btn-danger">
            <converse-icon class="fas fa-times" color="var(--foreground-color)" size="1em"></converse-icon
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
            <converse-icon class="fas fa-times" color="var(--foreground-color)" size="1em"></converse-icon
            >&nbsp;${i18n_block}
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
            <converse-icon class="fas fa-trash-alt" color="var(--foreground-color)" size="1em"></converse-icon
            >&nbsp;${i18n_remove_contact}
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

    const is_roster_contact = el.model.contact !== undefined;
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

    const i18n_refresh = __('Refetch data');
    const i18n_address = __('XMPP Address');
    const i18n_email = __('Email');
    const i18n_full_name = __('Full Name');
    const i18n_nickname = __('Nickname');
    const i18n_profile = __("The User's Profile Image");
    const i18n_role = __('Role');
    const i18n_url = __('URL');

    const avatar_data = {
        alt_text: i18n_profile,
        extra_classes: 'mb-3',
        height: '120',
        width: '120',
    };

    return html`
        <div class="modal-body">
            ${o.image ? html`<div class="mb-4">${avatar(Object.assign(o, avatar_data))}</div>` : ''}
            ${o.fullname ? html`<p><label>${i18n_full_name}:</label> ${o.fullname}</p>` : ''}
            <p><label>${i18n_address}:</label> <a href="xmpp:${o.jid}">${o.jid}</a></p>
            ${o.nickname ? html`<p><label>${i18n_nickname}:</label> ${o.nickname}</p>` : ''}
            ${o.url
                ? html`<p>
                      <label>${i18n_url}:</label> <a target="_blank" rel="noopener" href="${o.url}">${o.url}</a>
                  </p>`
                : ''}
            ${o.email ? html`<p><label>${i18n_email}:</label> <a href="mailto:${o.email}">${o.email}</a></p>` : ''}
            ${o.role ? html`<p><label>${i18n_role}:</label> ${o.role}</p>` : ''}

            <hr />
            <div>
                <button type="button" class="btn btn-info refresh-contact" @click=${(ev) => el.refreshContact(ev)}>
                    <converse-icon class="fa fa-refresh" color="var(--foreground-color)" size="1em"></converse-icon
                    >&nbsp;${i18n_refresh}
                </button>

                ${allow_contact_removal && is_roster_contact ? tplRemoveButton(el) : ''}
                ${until(
                    blocking_supported.then(() => tplBlockButton(el)),
                    ''
                )}
            </div>

            <converse-omemo-fingerprints jid=${o.jid}></converse-omemo-fingerprints>
        </div>
    `;
}
