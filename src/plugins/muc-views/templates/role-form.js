import { html } from "lit";
import { __ } from 'i18n';

/**
 * @param {import('../role-form').default} el
 */
export default (el) => {
    const i18n_change_role = __('Change role');
    const i18n_new_role = __('New Role');
    const i18n_reason = __('Reason');
    const occupant = el.muc.getOwnOccupant();
    const assignable_roles = occupant.getAssignableRoles();

    return html`
        <form class="role-form" @submit=${el.assignRole}>
            <input type="hidden" name="jid" value="${el.jid}"/>
            <input type="hidden" name="nick" value="${el.nick}"/>
            <div class="mb-3">
                <div class="row">
                    <div class="col-md-6">
                        <label class="form-label"><strong>${i18n_new_role}:</strong></label>
                        <select class="form-select select-role" name="role">
                            ${assignable_roles.map(role => html`<option value="${role}" ?selected=${role === el.role}>${role}</option>`)}
                        </select>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label"><strong>${i18n_reason}:</strong></label>
                        <input class="form-control" type="text" name="reason" placeholder="${i18n_reason}"/>
                    </div>
                </div>
            </div>
            <div class="text-end">
                <button type="submit" class="btn btn-primary">${i18n_change_role}</button>
            </div>
        </form>
    `;
}
