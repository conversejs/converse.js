import { __ } from 'i18n';
import { html } from "lit";
import { modal_close_button, modal_header_close_button } from "plugins/modal/templates/buttons.js";


const subject = (o) => {
    const i18n_topic = __('Topic');
    const i18n_topic_author = __('Topic author');
    return html`
        <p class="room-info"><strong>${i18n_topic}</strong>: ${o.subject.text}</p>
        <p class="room-info"><strong>${i18n_topic_author}</strong>: ${o.subject && o.subject.author}</p>
    `;
}


export default (model) => {
    const o = model.toJSON();
    const config = model.config.toJSON();
    const display_name = __('Groupchat info for %1$s', model.getDisplayName());
    const features = model.features.toJSON();
    const num_occupants = model.occupants.filter(o => o.get('show') !== 'offline').length;

    const i18n_address =  __('Groupchat XMPP address');
    const i18n_archiving = __('Message archiving');
    const i18n_archiving_help = __('Messages are archived on the server');
    const i18n_desc = __('Description');
    const i18n_features = __('Features');
    const i18n_hidden = __('Hidden');
    const i18n_hidden_help = __('This groupchat is not publicly searchable');
    const i18n_members_help = __('This groupchat is restricted to members only');
    const i18n_members_only = __('Members only');
    const i18n_moderated = __('Moderated');
    const i18n_moderated_help = __('Participants entering this groupchat need to request permission to write');
    const i18n_name = __('Name');
    const i18n_no_pass_help = __('This groupchat does not require a password upon entry');
    const i18n_no_password_required = __('No password required');
    const i18n_not_anonymous = __('Not anonymous');
    const i18n_not_anonymous_help = __('All other groupchat participants can see your XMPP address');
    const i18n_not_moderated = __('Not moderated');
    const i18n_not_moderated_help = __('Participants entering this groupchat can write right away');
    const i18n_online_users = __('Online users');
    const i18n_open = __('Open');
    const i18n_open_help = __('Anyone can join this groupchat');
    const i18n_password_help = __('This groupchat requires a password before entry');
    const i18n_password_protected = __('Password protected');
    const i18n_persistent = __('Persistent');
    const i18n_persistent_help = __('This groupchat persists even if it\'s unoccupied');
    const i18n_public = __('Public');
    const i18n_semi_anon = __('Semi-anonymous');
    const i18n_semi_anon_help = __('Only moderators can see your XMPP address');
    const i18n_temporary = __('Temporary');
    const i18n_temporary_help = __('This groupchat will disappear once the last person leaves');
    return html`
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="muc-details-modal-label">${display_name}</h5>
                    ${modal_header_close_button}
                </div>
                <div class="modal-body">
                    <span class="modal-alert"></span>
                    <div class="room-info">
                        <p class="room-info"><strong>${i18n_name}</strong>: ${o.name}</p>
                        <p class="room-info"><strong>${i18n_address}</strong>: ${o.jid}</p>
                        <p class="room-info"><strong>${i18n_desc}</strong>: ${config.description}</p>
                        ${ (o.subject) ? subject(o) : '' }
                        <p class="room-info"><strong>${i18n_online_users}</strong>: ${num_occupants}</p>
                        <p class="room-info"><strong>${i18n_features}</strong>:
                            <div class="chatroom-features">
                            <ul class="features-list">
                                ${ features.passwordprotected ? html`<li class="feature" ><converse-icon size="1em" class="fa fa-lock"></converse-icon size="1em">${i18n_password_protected} - <em>${i18n_password_help}</em></li>` : '' }
                                ${ features.unsecured ? html`<li class="feature" ><converse-icon size="1em" class="fa fa-unlock"></converse-icon size="1em">${i18n_no_password_required} - <em>${i18n_no_pass_help}</em></li>` : '' }
                                ${ features.hidden ? html`<li class="feature" ><converse-icon size="1em" class="fa fa-eye-slash"></converse-icon size="1em">${i18n_hidden} - <em>${i18n_hidden_help}</em></li>` : '' }
                                ${ features.public_room ? html`<li class="feature" ><converse-icon size="1em" class="fa fa-eye"></converse-icon size="1em">${i18n_public} - <em>${o.__('This groupchat is publicly searchable') }</em></li>` : '' }
                                ${ features.membersonly ? html`<li class="feature" ><converse-icon size="1em" class="fa fa-address-book"></converse-icon size="1em">${i18n_members_only} - <em>${i18n_members_help}</em></li>` : '' }
                                ${ features.open ? html`<li class="feature" ><converse-icon size="1em" class="fa fa-globe"></converse-icon size="1em">${i18n_open} - <em>${i18n_open_help}</em></li>` : '' }
                                ${ features.persistent ? html`<li class="feature" ><converse-icon size="1em" class="fa fa-save"></converse-icon size="1em">${i18n_persistent} - <em>${i18n_persistent_help}</em></li>` : '' }
                                ${ features.temporary ? html`<li class="feature" ><converse-icon size="1em" class="fa fa-snowflake-o"></converse-icon size="1em">${i18n_temporary} - <em>${i18n_temporary_help}</em></li>` : '' }
                                ${ features.nonanonymous ? html`<li class="feature" ><converse-icon size="1em" class="fa fa-id-card"></converse-icon size="1em">${i18n_not_anonymous} - <em>${i18n_not_anonymous_help}</em></li>` : '' }
                                ${ features.semianonymous ? html`<li class="feature" ><converse-icon size="1em" class="fa fa-user-secret"></converse-icon size="1em">${i18n_semi_anon} - <em>${i18n_semi_anon_help}</em></li>` : '' }
                                ${ features.moderated ? html`<li class="feature" ><converse-icon size="1em" class="fa fa-gavel"></converse-icon size="1em">${i18n_moderated} - <em>${i18n_moderated_help}</em></li>` : '' }
                                ${ features.unmoderated ? html`<li class="feature" ><converse-icon size="1em" class="fa fa-info-circle"></converse-icon size="1em">${i18n_not_moderated} - <em>${i18n_not_moderated_help}</em></li>` : '' }
                                ${ features.mam_enabled ? html`<li class="feature" ><converse-icon size="1em" class="fa fa-database"></converse-icon size="1em">${i18n_archiving} - <em>${i18n_archiving_help}</em></li>` : '' }
                            </ul>
                            </div>
                        </p>
                    </div>
                </div>
                <div class="modal-footer">${modal_close_button}</div>
            </div>
        </div>
    `;
}
