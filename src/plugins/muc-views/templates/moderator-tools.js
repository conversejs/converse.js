import spinner from "templates/spinner.js";
import { __ } from 'i18n';
import { html } from "lit";


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


const tpl_set_role_form = (o) => {
    const i18n_change_role = __('Change role');
    const i18n_new_role = __('New Role');
    const i18n_reason = __('Reason');
    return html`
        <form class="role-form hidden" @submit=${o.assignRole}>
            <div class="form-group">
                <input type="hidden" name="jid" value="${o.item.jid}"/>
                <input type="hidden" name="nick" value="${o.item.nick}"/>
                <div class="row">
                    <div class="col">
                        <label><strong>${i18n_new_role}:</strong></label>
                        <select class="custom-select select-role" name="role">
                            ${ o.assignable_roles.map(role => html`<option value="${role}" ?selected=${role === o.item.role}>${role}</option>`) }
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
    `;
}


const role_form_toggle = (o) => html`
    <a href="#" data-form="role-form" class="toggle-form right" color="var(--subdued-color)" @click=${o.toggleForm}>
        <converse-icon class="fa fa-wrench" size="1em"></converse-icon>
    </a>`;


const role_list_item = (o) => html`
    <li class="list-group-item" data-nick="${o.item.nick}">
        <ul class="list-group">
            <li class="list-group-item active">
                <div><strong>JID:</strong> ${o.item.jid}</div>
            </li>
            <li class="list-group-item">
                <div><strong>Nickname:</strong> ${o.item.nick}</div>
            </li>
            <li class="list-group-item">
                <div><strong>Role:</strong> ${o.item.role} ${o.assignable_roles.length ? role_form_toggle(o) : ''}</div>
                ${o.assignable_roles.length ? tpl_set_role_form(o) : ''}
            </li>
        </ul>
    </li>
`;


const tpl_set_affiliation_form = (o) => {
    const i18n_change_affiliation = __('Change affiliation');
    const i18n_new_affiliation = __('New affiliation');
    const i18n_reason = __('Reason');
    return html`
        <form class="affiliation-form hidden" @submit=${o.assignAffiliation}>
            <div class="form-group">
                <input type="hidden" name="jid" value="${o.item.jid}"/>
                <input type="hidden" name="nick" value="${o.item.nick}"/>
                <div class="row">
                    <div class="col">
                        <label><strong>${i18n_new_affiliation}:</strong></label>
                        <select class="custom-select select-affiliation" name="affiliation">
                            ${ o.assignable_affiliations.map(aff => html`<option value="${aff}" ?selected=${aff === o.item.affiliation}>${aff}</option>`) }
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
    `;
}


const affiliation_form_toggle = (o) => html`
    <a href="#" data-form="affiliation-form" class="toggle-form right" color="var(--subdued-color)" @click=${o.toggleForm}>
        <converse-icon class="fa fa-wrench" size="1em"></converse-icon>
    </a>`;


const affiliation_list_item = (o) => html`
    <li class="list-group-item" data-nick="${o.item.nick}">
        <ul class="list-group">
            <li class="list-group-item active">
                <div><strong>JID:</strong> ${o.item.jid}</div>
            </li>
            <li class="list-group-item">
                <div><strong>Nickname:</strong> ${o.item.nick}</div>
            </li>
            <li class="list-group-item">
                <div><strong>Affiliation:</strong> ${o.item.affiliation} ${o.assignable_affiliations.length ? affiliation_form_toggle(o) : ''}</div>
                ${o.assignable_affiliations.length ? tpl_set_affiliation_form(o) : ''}
            </li>
        </ul>
    </li>
`;


const tpl_navigation = (o) => html`
    <ul class="nav nav-pills justify-content-center">
        <li role="presentation" class="nav-item">
            <a class="nav-link ${o.tab === "affiliations" ? "active" : ""}"
               id="affiliations-tab"
               href="#affiliations-tabpanel"
               aria-controls="affiliations-tabpanel"
               role="tab"
               data-name="affiliations"
               @click=${o.switchTab}>Affiliations</a>
        </li>
        <li role="presentation" class="nav-item">
            <a class="nav-link ${o.tab === "roles" ? "active" : ""}"
               id="roles-tab"
               href="#roles-tabpanel"
               aria-controls="roles-tabpanel"
               role="tab"
               data-name="roles"
               @click=${o.switchTab}>Roles</a>
        </li>
    </ul>
`;


export default (o) => {
    const i18n_affiliation = __('Affiliation');
    const i18n_no_users_with_aff = __('No users with that affiliation found.')
    const i18n_no_users_with_role = __('No users with that role found.');
    const i18n_filter = __('Type here to filter the search results');
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
    const show_both_tabs = o.queryable_roles.length && o.queryable_affiliations.length;
    return html`
        ${o.alert_message ? html`<div class="alert alert-${o.alert_type}" role="alert">${o.alert_message}</div>` : '' }
        ${ show_both_tabs ? tpl_navigation(o) : '' }

        <div class="tab-content">

            ${ o.queryable_affiliations.length ? html`
            <div class="tab-pane tab-pane--columns ${ o.tab === 'affiliations' ? 'active' : ''}" id="affiliations-tabpanel" role="tabpanel" aria-labelledby="affiliations-tab">
                <form class="converse-form query-affiliation" @submit=${o.queryAffiliation}>
                    <p class="helptext pb-3">${i18n_helptext_affiliation}</p>
                    <div class="form-group">
                        <label for="affiliation">
                            <strong>${i18n_affiliation}:</strong>
                        </label>
                        <div class="row">
                            <div class="col">
                                <select class="custom-select select-affiliation" name="affiliation">
                                    ${o.queryable_affiliations.map(item => affiliation_option(Object.assign({item}, o)))}
                                </select>
                            </div>
                            <div class="col">
                                <input type="submit" class="btn btn-primary" name="users_with_affiliation" value="${i18n_show_users}"/>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col mt-3">
                                ${ (Array.isArray(o.users_with_affiliation) && o.users_with_affiliation.length > 5) ?
                                    html`<input class="form-control" .value="${o.affiliations_filter}" @keyup=${o.filterAffiliationResults} type="text" name="filter" placeholder="${i18n_filter}"/>` : '' }
                            </div>
                        </div>

                        ${ getAffiliationHelpText(o.affiliation) ?
                            html`<div class="row"><div class="col pt-2"><p class="helptext pb-3">${getAffiliationHelpText(o.affiliation)}</p></div></div>` : '' }
                    </div>
                </form>
                <div class="scrollable-container">
                    <ul class="list-group list-group--users">
                        ${ (o.loading_users_with_affiliation) ? html`<li class="list-group-item"> ${spinner()} </li>` : '' }
                        ${ (Array.isArray(o.users_with_affiliation) && o.users_with_affiliation.length === 0) ?
                                html`<li class="list-group-item">${i18n_no_users_with_aff}</li>` : '' }

                        ${ (o.users_with_affiliation instanceof Error) ?
                                html`<li class="list-group-item">${o.users_with_affiliation.message}</li>` :
                                (o.users_with_affiliation || []).map(item => ((item.nick || item.jid).match(new RegExp(o.affiliations_filter, 'i')) ? affiliation_list_item(Object.assign({item}, o)) : '')) }
                    </ul>
                </div>
            </div>` : '' }

            ${ o.queryable_roles.length ? html`
            <div class="tab-pane tab-pane--columns ${ o.tab === 'roles' ? 'active' : ''}" id="roles-tabpanel" role="tabpanel" aria-labelledby="roles-tab">
                <form class="converse-form query-role" @submit=${o.queryRole}>
                    <p class="helptext pb-3">${i18n_helptext_role}</p>
                    <div class="form-group">
                        <label for="role"><strong>${i18n_role}:</strong></label>
                        <div class="row">
                            <div class="col">
                                <select class="custom-select select-role" name="role">
                                    ${o.queryable_roles.map(item => role_option(Object.assign({item}, o)))}
                                </select>
                            </div>
                            <div class="col">
                                <input type="submit" class="btn btn-primary" name="users_with_role" value="${i18n_show_users}"/>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col mt-3">
                                ${ (Array.isArray(o.users_with_role) && o.users_with_role.length > 5) ?
                                    html`<input class="form-control" .value="${o.roles_filter}" @keyup=${o.filterRoleResults} type="text" name="filter" placeholder="${i18n_filter}"/>` : '' }
                            </div>
                        </div>

                        ${ getRoleHelpText(o.role) ? html`<div class="row"><div class="col pt-2"><p class="helptext pb-3">${getRoleHelpText(o.role)}</p></div></div>` :  ''}
                    </div>
                </form>
                <div class="scrollable-container">
                    <ul class="list-group list-group--users">
                        ${ o.loading_users_with_role ? html`<li class="list-group-item"> ${spinner()} </li>` : '' }
                        ${ (o.users_with_role && o.users_with_role.length === 0) ? html`<li class="list-group-item">${i18n_no_users_with_role}</li>` : '' }
                        ${ (o.users_with_role || []).map(item => (item.nick.match(o.roles_filter) ? role_list_item(Object.assign({item}, o)) : '')) }
                    </ul>
                </div>
            </div>`: '' }
        </div>`;
}
