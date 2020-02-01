import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';
import spinner from "./spinner.js";
import { modal_header_close_button } from "./buttons"


const i18n_affiliation = __('Affiliation');
const i18n_change_affiliation = __('Change affiliation');
const i18n_change_role = __('Change role');
const i18n_moderator_tools = __('Moderator Tools');
const i18n_new_affiliation = __('New affiliation');
const i18n_new_role = __('New Role');
const i18n_no_users_with_aff = __('No users with that affiliation found.')
const i18n_no_users_with_role = __('No users with that role found.');
const i18n_reason = __('Reason');
const i18n_role = __('Role');
const i18n_show_users = __('Show users');

const i18n_helptext_role = __(
    "Roles are assigned to users to grant or deny them certain abilities in a multi-user chat. "+
    "They're assigned either explicitly or implicitly as part of an affiliation. "+
    "A role that's not due to an affiliation, is only valid for the duration of the user's session."
);

const i18n_helptext_affiliation = __(
    "An affiliation is a long-lived entitlement which typically implies a certain role and which "+
    "grants privileges and responsibilities. For example admins and owners automatically have the "+
    "moderator role."
);


function getRoleHelpText (role) {
    if (role === 'moderator') {
        return __("Moderators are privileged users who can change the roles of other users (except those with admin or owner affiliations.");
    } else if (role === 'participant') {
        return __("The default role, implies that you can read and write messages.");
    } else if  (role == 'visitor') {
        return __("Visitors aren't allowed to write messages in a moderated multi-user chat.");
    }
}

function getAffiliationHelpText (aff) {
    if (aff === 'owner') {
        return __("Owner is the highest affiliation. Owners can modify roles and affiliations of all other users.");
    } else if (aff === 'admin')  {
        return __("Admin is the 2nd highest affiliation. Admins can modify roles and affiliations of all other users except owners.");
    } else if (aff === 'outcast')  {
        return __("To ban a user, you give them the affiliation of \"outcast\".");
    }
}


const role_option = (o) => html`
    <option value="${o.item || ''}"
            ?selected=${o.item === o.role}
            title="${getRoleHelpText(o.item)}">${o.item}</option>
`;


const affiliation_option = (o) => html`
    <option value="${o.item || ''}"
            ?selected=${o.item === o.affiliation}
            title="${getAffiliationHelpText(o.item)}">${o.item}</option>
`;


const role_list_item = (o) => html`
    <li class="list-group-item">
        <ul class="list-group">
            <li class="list-group-item active">
                <div><strong>JID:</strong> ${o.item.jid}</div>
            </li>
            <li class="list-group-item">
                <div><strong>Nickname:</strong> ${o.item.nick}</div>
            </li>
            <li class="list-group-item">
                <div><strong>Role:</strong> ${o.item.role}<a href="#" data-form="role-form" class="toggle-form right fa fa-wrench"></a></div>
                <form class="role-form hidden">
                    <div class="form-group">
                        <input type="hidden" name="jid" value="${o.item.jid}"/>
                        <input type="hidden" name="nick" value="${o.item.nick}"/>
                        <div class="row">
                            <div class="col">
                                <label><strong>${i18n_new_role}:</strong></label>
                                <select class="custom-select select-role" name="role">
                                    ${ o.allowed_roles.map(role => html`<option value="${role}" ?selected=${role === o.item.role}>${role}</option>`) }
                                </select>
                            </div>
                            <div class="col">
                                <label><strong>${i18n_reason}:</strong></label>
                                <input class="form-control" type="text" name="reason"/>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <input type="submit" class="btn btn-primary" value="${i18n_change_role}"/>
                    </div>
                </form>
            </li>
        </ul>
    </li>
`;


const affiliation_list_item = (o) => html`
    <li class="list-group-item">
        <ul class="list-group">
            <li class="list-group-item active">
                <div><strong>JID:</strong> ${o.item.jid}</div>
            </li>
            <li class="list-group-item">
                <div><strong>Nickname:</strong> ${o.item.nick}</div>
            </li>
            <li class="list-group-item">
                <div><strong>Affiliation:</strong> ${o.item.affiliation} <a href="#" data-form="affiliation-form" class="toggle-form right fa fa-wrench"></a></div>
                <form class="affiliation-form hidden">
                    <div class="form-group">
                        <input type="hidden" name="jid" value="${o.item.jid}"/>
                        <input type="hidden" name="nick" value="${o.item.nick}"/>
                        <div class="row">
                            <div class="col">
                                <label><strong>${i18n_new_affiliation}:</strong></label>
                                <select class="custom-select select-affiliation" name="affiliation">
                                    ${ o.allowed_affiliations.map(aff => html`<option value="${aff}" ?selected=${aff === o.item.affiliation}>${aff}</option>`) }
                                </select>
                            </div>
                            <div class="col">
                                <label><strong>${i18n_reason}:</strong></label>
                                <input class="form-control" type="text" name="reason"/>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <input type="submit" class="btn btn-primary" name="change" value="${i18n_change_affiliation}"/>
                    </div>
                </form>
            </li>
        </ul>
    </li>
`;


export default (o) => html`
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="converse-modtools-modal-label">${i18n_moderator_tools}</h5>
                ${modal_header_close_button}
            </div>
            <div class="modal-body d-flex flex-column">
                <span class="modal-alert"></span>

                <ul class="nav nav-pills justify-content-center">
                    <li role="presentation" class="nav-item">
                        <a class="nav-link active" id="roles-tab" href="#roles-tabpanel" aria-controls="roles-tabpanel" role="tab" data-toggle="tab">Roles</a>
                    </li>
                    <li role="presentation" class="nav-item">
                        <a class="nav-link" id="affiliations-tab" href="#affiliations-tabpanel" aria-controls="affiliations-tabpanel" role="tab" data-toggle="tab">Affiliations</a>
                    </li>
                </ul>

                <div class="tab-content">
                    <div class="tab-pane tab-pane--columns active" id="roles-tabpanel" role="tabpanel" aria-labelledby="roles-tab">
                        <form class="converse-form query-role">
                            <p class="helptext pb-3">${i18n_helptext_role}</p>
                            <div class="form-group">
                                <label for="role"><strong>${i18n_role}:</strong></label>
                                <div class="row">
                                    <div class="col">
                                        <select class="custom-select select-role" name="role">
                                            ${o.roles.map(item => role_option(Object.assign({item}, o)))}
                                        </select>
                                    </div>
                                    <div class="col">
                                        <input type="submit" class="btn btn-primary" name="users_with_role" value="${i18n_show_users}"/>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col pt-2"><p class="helptext pb-3">${getRoleHelpText(o.role)}</p></div>
                                </div>
                            </div>
                        </form>
                        <div class="scrollable-container">
                            <ul class="list-group list-group--users">
                                ${ o.loading_users_with_role ? html`<li class="list-group-item"> ${spinner()} </li>` : '' }
                                ${ (o.users_with_role && o.users_with_role.length === 0) ? html`<li class="list-group-item">${i18n_no_users_with_role}</li>` : '' }
                                ${ (o.users_with_role || []).map(item => role_list_item(Object.assign({item}, o))) }
                            </ul>
                        </div>
                    </div>


                    <div class="tab-pane tab-pane--columns" id="affiliations-tabpanel" role="tabpanel" aria-labelledby="affiliations-tab">
                        <form class="converse-form query-affiliation">
                            <p class="helptext pb-3">${i18n_helptext_affiliation}</p>
                            <div class="form-group">
                                <label for="affiliation">
                                    <strong>${i18n_affiliation}:</strong>
                                </label>
                                <div class="row">
                                    <div class="col">
                                        <select class="custom-select select-affiliation" name="affiliation">
                                            ${o.affiliations.map(item => affiliation_option(Object.assign({item}, o)))}
                                        </select>
                                    </div>
                                    <div class="col">
                                        <input type="submit" class="btn btn-primary" name="users_with_affiliation" value="${i18n_show_users}"/>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col pt-2"><p class="helptext pb-3">${getAffiliationHelpText(o.affiliation)}</p></div>
                                </div>
                            </div>
                        </form>
                        <div class="scrollable-container">
                            <ul class="list-group list-group--users">
                                ${ (o.loading_users_with_affiliation) ? html`<li class="list-group-item"> ${spinner()} </li>` : '' }
                                ${ (Array.isArray(o.users_with_affiliation) && o.users_with_affiliation.length === 0) ? html`<li class="list-group-item">${i18n_no_users_with_aff}</li>` : '' }
                                ${ (o.users_with_affiliation instanceof Error) ?
                                        html`<li class="list-group-item">${o.users_with_affiliation.message}</li>` :
                                        (o.users_with_affiliation || []).map(item => affiliation_list_item(Object.assign({item}, o))) }
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;
