import { __ } from 'i18n';
import { html } from 'lit';
import { formatFingerprint } from '../utils.js';
import { converse } from '@converse/headless';

const { u } = converse.env;

/**
 * @param {import('../fingerprints').Fingerprints} el
 * @param {import('../device').default} device
 */
const device_fingerprint = (el, device) => {
    const i18n_trusted = __('Trusted');
    const i18n_untrusted = __('Untrusted');
    const i18n_toggle_trusted_devices = __('Choose which devices you trust for OMEMO encrypted communication');

    const id1 = u.getUniqueId();
    const id2 = u.getUniqueId();
    const is_trusted = device.get('trusted') !== -1;

    if (device.get('bundle') && device.get('bundle').fingerprint) {
        return html`
            <li class="list-group-item">
                <form class="fingerprint-trust">
                    <div class="btn-group btn-group-toggle" role="group" aria-label="${i18n_toggle_trusted_devices}">
                        <input type="radio" class="btn-check" name="${device.get('id')}" id="${id1}" autocomplete="off" value="1"
                                @click=${el.toggleDeviceTrust}
                                ?checked=${is_trusted}>
                        <label class="btn ${is_trusted ? 'btn-primary active' : 'btn-outline-secondary'}" for="${id1}">${i18n_trusted}</label>

                        <input type="radio" class="btn-check" name="${device.get('id')}" id="${id2}" autocomplete="off" value="-1"
                                @click=${el.toggleDeviceTrust}
                                ?checked=${!is_trusted}>
                        <label class="btn ${!is_trusted ? 'btn-primary active' : 'btn-outline-secondary'}" for="${id2}">${i18n_untrusted}</label>
                    </div>
                    <code class="fingerprint">${formatFingerprint(device.get('bundle').fingerprint)}</code>
                </form>
            </li>
        `;
    } else {
        return ''
    }
}

/**
 * @param {import('../fingerprints').Fingerprints} el
 */
export default (el) => {
    const i18n_fingerprints = __('OMEMO Fingerprints');
    const i18n_no_devices = __("No OMEMO-enabled devices found");
    const devices = el.devicelist.devices;
    return html`
        <ul class="list-group fingerprints">
            <li class="list-group-item active">${i18n_fingerprints}</li>
            ${ devices.length ?
                devices.map(device => device_fingerprint(el, device)) :
                html`<li class="list-group-item"> ${i18n_no_devices} </li>` }
        </ul>
    `;
}
