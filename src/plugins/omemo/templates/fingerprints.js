import { __ } from 'i18n';
import { html } from 'lit';
import { formatFingerprint } from '../utils.js';

const device_fingerprint = (el, device) => {
    const i18n_trusted = __('Trusted');
    const i18n_untrusted = __('Untrusted');
    if (device.get('bundle') && device.get('bundle').fingerprint) {
        return html`
            <li class="list-group-item">
                <form class="fingerprint-trust">
                    <div class="btn-group btn-group-toggle">
                        <label class="btn btn--small ${(device.get('trusted') === 1) ? 'btn-primary active' : 'btn-secondary'}"
                                @click=${el.toggleDeviceTrust}>
                            <input type="radio" name="${device.get('id')}" value="1"
                                ?checked=${device.get('trusted') !== -1}>${i18n_trusted}
                        </label>
                        <label class="btn btn--small ${(device.get('trusted') === -1) ? 'btn-primary active' : 'btn-secondary'}"
                                @click=${el.toggleDeviceTrust}>
                            <input type="radio" name="${device.get('id')}" value="-1"
                                ?checked=${device.get('trusted') === -1}>${i18n_untrusted}
                        </label>
                    </div>
                    <code class="fingerprint">${formatFingerprint(device.get('bundle').fingerprint)}</code>
                </form>
            </li>
        `;
    } else {
        return ''
    }
}

export default (el) => {
    const i18n_fingerprints = __('OMEMO Fingerprints');
    const i18n_no_devices = __("No OMEMO-enabled devices found");
    const devices = el.devicelist.devices;
    return html`
        <hr/>
        <ul class="list-group fingerprints">
            <li class="list-group-item active">${i18n_fingerprints}</li>
            ${ devices.length ?
                devices.map(device => device_fingerprint(el, device)) :
                html`<li class="list-group-item"> ${i18n_no_devices} </li>` }
        </ul>
    `;
}
