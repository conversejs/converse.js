import { html } from "lit";
import { __ } from 'i18n';

export default  (o) => {
    const i18n_desc = __('Description:');
    const i18n_jid = __('Groupchat XMPP Address:');
    const i18n_occ = __('Participants:');
    const i18n_features = __('Features:');
    const i18n_requires_auth = __('Requires authentication');
    const i18n_hidden = __('Hidden');
    const i18n_requires_invite = __('Requires an invitation');
    const i18n_moderated = __('Moderated');
    const i18n_non_anon = __('Non-anonymous');
    const i18n_open_room = __('Open');
    const i18n_permanent_room = __('Permanent');
    const i18n_public = __('Public');
    const i18n_semi_anon =  __('Semi-anonymous');
    const i18n_temp_room =  __('Temporary');
    const i18n_unmoderated = __('Unmoderated');
    return html`
    <div class="room-info">
        <p class="room-info"><strong>${i18n_jid}</strong> ${o.jid}</p>
        <p class="room-info"><strong>${i18n_desc}</strong> ${o.desc}</p>
        <p class="room-info"><strong>${i18n_occ}</strong> ${o.occ}</p>
        <p class="room-info"><strong>${i18n_features}</strong>
            <ul>
                ${ o.passwordprotected ? html`<li class="room-info locked">${i18n_requires_auth}</li>` : '' }
                ${ o.hidden ? html`<li class="room-info">${i18n_hidden}</li>` : '' }
                ${ o.membersonly ? html`<li class="room-info">${i18n_requires_invite}</li>` : '' }
                ${ o.moderated ? html`<li class="room-info">${i18n_moderated}</li>` : '' }
                ${ o.nonanonymous ? html`<li class="room-info">${i18n_non_anon}</li>` : '' }
                ${ o.open ? html`<li class="room-info">${i18n_open_room}</li>` : '' }
                ${ o.persistent ? html`<li class="room-info">${i18n_permanent_room}</li>` : '' }
                ${ o.publicroom ? html`<li class="room-info">${i18n_public}</li>` : '' }
                ${ o.semianonymous ? html`<li class="room-info">${i18n_semi_anon}</li>` : '' }
                ${ o.temporary ? html`<li class="room-info">${i18n_temp_room}</li>` : '' }
                ${ o.unmoderated ? html`<li class="room-info">${i18n_unmoderated}</li>` : '' }
            </ul>
        </p>
    </div>
`};
