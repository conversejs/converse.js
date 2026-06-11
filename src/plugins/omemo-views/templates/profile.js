import { html } from "lit";
import { __ } from "i18n";
import spinner from "templates/spinner.js";
import { formatFingerprint, formatFingerprintForQRCode } from "../utils.js";
import "shared/qrcode/component.js";

/**
 * Renders the fingerprint (and matching QR code) of one of our own device's
 * OMEMO versions. A physical device has a separate identity key per version,
 * so the legacy and omemo:2 fingerprints differ and must both be shown.
 * @param {import('@converse/headless').Device} device
 * @param {string} label
 */
function tplCurrentDeviceFingerprint(device, label) {
    if (!device) return ""; // No device list for this OMEMO version (e.g. server without omemo:2)
    const fingerprint = device.get("bundle")?.fingerprint;
    return html`
        <li class="list-group-item">
            <div class="fw-bold pb-1">${label}:</div>
            ${fingerprint ? html`<span class="fingerprint">${formatFingerprint(fingerprint)}</span>` : spinner()}
        </li>
        ${fingerprint
            ? html`<li class="list-group-item p-4">
                  <converse-qr-code
                      class="centered"
                      text="${formatFingerprintForQRCode(fingerprint)}"
                  ></converse-qr-code>
              </li>`
            : ""}
    `;
}

function tplDeviceWithFingerprint(device) {
    const i18n_fingerprint_checkbox_label = __("Checkbox for selecting the following fingerprint");
    return html`
        <li class="fingerprint-removal-item list-group-item">
            <label class="form-label">
                <input type="checkbox" value="${device.get("id")}" aria-label="${i18n_fingerprint_checkbox_label}" />
                <span class="fingerprint">${formatFingerprint(device.get("bundle").fingerprint)}</span>
            </label>
        </li>
    `;
}

function tplDeviceWithoutFingerprint(device) {
    const i18n_device_without_fingerprint = __("Device without a fingerprint");
    const i18n_fingerprint_checkbox_label = __("Checkbox for selecting the following device");
    return html`
        <li class="fingerprint-removal-item list-group-item">
            <label class="form-label">
                <input type="checkbox" value="${device.get("id")}" aria-label="${i18n_fingerprint_checkbox_label}" />
                <span>${i18n_device_without_fingerprint}</span>
            </label>
        </li>
    `;
}

function tplDeviceItem(device) {
    return html`${device.get("bundle") && device.get("bundle").fingerprint
        ? tplDeviceWithFingerprint(device)
        : tplDeviceWithoutFingerprint(device)}`;
}

/**
 * @param {import('../profile').Profile} el
 */
function tplDeviceList(el) {
    const i18n_other_devices = __("Other OMEMO-enabled devices");
    const i18n_other_devices_label = __("Checkbox to select fingerprints of all other OMEMO devices");
    const i18n_remove_devices = __("Remove checked devices and close");
    const i18n_select_all = __("Select all");
    return html`
        <ul class="list-group fingerprints">
            <li class="list-group-item active">
                <label class="form-label">
                    <input
                        type="checkbox"
                        class="select-all"
                        @change=${el.selectAll}
                        title="${i18n_select_all}"
                        aria-label="${i18n_other_devices_label}"
                    />
                    ${i18n_other_devices}
                </label>
            </li>
            ${el.other_devices?.map((device) => tplDeviceItem(device))}
        </ul>
        <div><button type="submit" class="save-form btn btn-primary">${i18n_remove_devices}</button></div>
    `;
}

/**
 * @param {import('../profile').Profile} el
 */
export default (el) => {
    const i18n_device = __("This device");
    const i18n_fingerprint_legacy = __("OMEMO fingerprint (legacy)");
    const i18n_fingerprint_v2 = __("OMEMO 2 fingerprint");
    const i18n_generate = __("Generate new keys and fingerprint");
    return html`<form class="converse-form fingerprint-removal" @submit=${el.removeSelectedFingerprints}>
        <ul class="list-group fingerprints">
            <li class="list-group-item active">${i18n_device}</li>
            ${tplCurrentDeviceFingerprint(el.current_device, i18n_fingerprint_legacy)}
            ${tplCurrentDeviceFingerprint(el.current_device_v2, i18n_fingerprint_v2)}
            <li class="list-group-item">
                <span class="fw-bold">${__("Device ID")}:</span>
                <span class="ms-2">${el?.current_device?.get("id") || ""}</span>
            </li>
        </ul>
        <div class="pb-3">
            <button type="button" class="generate-bundle btn btn-danger" @click=${el.generateOMEMODeviceBundle}>
                ${i18n_generate}
            </button>
        </div>
        ${el.other_devices?.length ? tplDeviceList(el) : ""}
    </form>`;
};
