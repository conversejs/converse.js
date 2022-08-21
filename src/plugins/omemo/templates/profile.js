import spinner from "templates/spinner.js";
import { formatFingerprint } from 'plugins/omemo/utils.js';
import { html } from "lit";
import { __ } from 'i18n';


const fingerprint = (el) => html`
    <span class="fingerprint">${formatFingerprint(el.current_device.get('bundle').fingerprint)}</span>`;


const device_with_fingerprint = (el) => {
    const i18n_fingerprint_checkbox_label = __('Checkbox for selecting the following fingerprint');
    return html`
        <li class="fingerprint-removal-item list-group-item">
            <label>
            <input type="checkbox" value="${el.device.get('id')}"
                aria-label="${i18n_fingerprint_checkbox_label}"/>
            <span class="fingerprint">${formatFingerprint(el.device.get('bundle').fingerprint)}</span>
            </label>
        </li>
    `;
}


const device_without_fingerprint = (el) => {
    const i18n_device_without_fingerprint = __('Device without a fingerprint');
    const i18n_fingerprint_checkbox_label = __('Checkbox for selecting the following device');
    return html`
        <li class="fingerprint-removal-item list-group-item">
            <label>
            <input type="checkbox" value="${el.device.get('id')}"
                aria-label="${i18n_fingerprint_checkbox_label}"/>
            <span>${i18n_device_without_fingerprint}</span>
            </label>
        </li>
    `;
}


const device_item = (el) => html`
    ${(el.device.get('bundle') && el.device.get('bundle').fingerprint) ? device_with_fingerprint(el) : device_without_fingerprint(el) }
`;


const device_list = (el) => {
    const i18n_other_devices = __('Other OMEMO-enabled devices');
    const i18n_other_devices_label = __('Checkbox to select fingerprints of all other OMEMO devices');
    const i18n_remove_devices = __('Remove checked devices and close');
    const i18n_select_all = __('Select all');
    return html`
        <ul class="list-group fingerprints">
            <li class="list-group-item active">
                <label>
                    <input type="checkbox" class="select-all" @change=${el.selectAll} title="${i18n_select_all}" aria-label="${i18n_other_devices_label}"/>
                    ${i18n_other_devices}
                </label>
            </li>
            ${ el.other_devices?.map(device => device_item(Object.assign({device}, el))) }
        </ul>
        <div class="form-group"><button type="submit" class="save-form btn btn-primary">${i18n_remove_devices}</button></div>
    `;
}


export default (el) => {
    const i18n_fingerprint = __("This device's OMEMO fingerprint");
    const i18n_generate = __('Generate new keys and fingerprint');
    return html`
        <form class="converse-form fingerprint-removal" @submit=${el.removeSelectedFingerprints}>
            <ul class="list-group fingerprints">
                <li class="list-group-item active">${i18n_fingerprint}</li>
                <li class="list-group-item">
                    ${ (el.current_device && el.current_device.get('bundle') && el.current_device.get('bundle').fingerprint) ? fingerprint(el) : spinner() }
                </li>
            </ul>
            <div class="form-group">
                <button type="button" class="generate-bundle btn btn-danger" @click=${el.generateOMEMODeviceBundle}>${i18n_generate}</button>
            </div>
            ${ el.other_devices?.length ? device_list(el) : '' }
        </form>`;
}
