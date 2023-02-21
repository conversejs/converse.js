import { __ } from 'i18n';
import { html } from "lit";
import { getAssignableAffiliations } from '@converse/headless/plugins/muc/affiliations/utils.js';

export default (el) => {
    const i18n_change_affiliation = __('Change affiliation');
    const i18n_new_affiliation = __('New affiliation');
    const i18n_reason = __('Reason');
    const occupant = el.muc.getOwnOccupant();
    const assignable_affiliations = getAssignableAffiliations(occupant);

    return html`
        <form class="affiliation-form" @submit=${ev => el.assignAffiliation(ev)}>
            ${el.alert_message ? html`<div class="alert alert-${el.alert_type}" role="alert">${el.alert_message}</div>` : '' }
            <div class="form-group">
                <div class="row">
                    <div class="col">
                        <label><strong>${i18n_new_affiliation}:</strong></label>
                        <select class="custom-select select-affiliation" name="affiliation">
                            ${ assignable_affiliations.map(aff => html`<option value="${aff}" ?selected=${aff === el.affiliation}>${aff}</option>`) }
                        </select>
                    </div>
                    <div class="col">
                        <label><strong>${i18n_reason}:</strong></label>
                        <input class="form-control" type="text" name="reason"/>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <div class="col">
                    <input type="submit" class="btn btn-primary" name="change" value="${i18n_change_affiliation}"/>
                </div>
            </div>
        </form>
    `;
}
