import { __ } from 'i18n';
import { html } from "lit";

export default (el) => {
    const i18n_change_role = __('Change role');
    const i18n_new_role = __('New Role');
    const i18n_reason = __('Reason');
    const occupant = el.muc.getOwnOccupant();
    const assignable_roles = occupant.getAssignableRoles();

    return html`
        <form class="role-form" @submit=${el.assignRole}>
            <div>
                <input type="hidden" name="jid" value="${el.jid}"/>
                <input type="hidden" name="nick" value="${el.nick}"/>
                <div class="row">
                    <div class="col">
                        <label class="form-label"><strong>${i18n_new_role}:</strong></label>
                        <select class="form-select select-role" name="role">
                        ${ assignable_roles.map(role => html`<option value="${role}" ?selected=${role === el.role}>${role}</option>`) }
                        </select>
                    </div>
                    <div class="col">
                        <label class="form-label"><strong>${i18n_reason}:</strong></label>
                        <input class="form-control" type="text" name="reason"/>
                    </div>
                </div>
            </div>
            <div>
                <div class="col">
                    <input type="submit" class="btn btn-primary" value="${i18n_change_role}"/>
                </div>
            </div>
        </form>
    `;
}
