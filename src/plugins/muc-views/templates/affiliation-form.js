import { html } from "lit";
import { __ } from 'i18n';

/**
 * @param {import('../affiliation-form').default} el
 */
export default (el) => {
    const i18n_change_affiliation = __('Change affiliation');
    const i18n_new_affiliation = __('New affiliation');
    const i18n_reason = __('Reason');
    const occupant = el.muc.getOwnOccupant();
    const assignable_affiliations = occupant.getAssignableAffiliations();

    return html`
        <form class="affiliation-form" @submit=${(ev) => el.assignAffiliation(ev)}>
            ${el.alert_message ? html`<div class="alert alert-${el.alert_type}" role="alert">${el.alert_message}</div>` : '' }
            <div class="mb-3">
                <div class="row">
                    <div class="col-md-6">
                        <label class="form-label"><strong>${i18n_new_affiliation}:</strong></label>
                        <select class="form-select select-affiliation" name="affiliation">
                            ${assignable_affiliations.map((aff) => html`<option value="${aff}" ?selected=${aff === el.affiliation}>${aff}</option>`)}
                        </select>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label"><strong>${i18n_reason}:</strong></label>
                        <input class="form-control" type="text" name="reason" placeholder="${i18n_reason}"/>
                    </div>
                </div>
            </div>
            <div class="text-end">
                <button type="submit" class="btn btn-primary" name="change">${i18n_change_affiliation}</button>
            </div>
        </form>
    `;
}
