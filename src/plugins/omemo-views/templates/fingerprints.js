import { __ } from 'i18n';
import { html } from 'lit';
import { formatFingerprint } from '../utils.js';
import { converse } from '@converse/headless';

const { u } = converse.env;

/**
 * @param {import('../fingerprints').Fingerprints} el
 * @param {import('@converse/headless').Device} device
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
            <li class="list-group-item ${device.get('active') === false ? 'text-muted' : ''}">
                <form class="fingerprint-trust">
                    <div class="d-flex justify-content-between">
                        <div
                            class="btn-group btn-group-toggle"
                            role="group"
                            aria-label="${i18n_toggle_trusted_devices}"
                        >
                            <input
                                type="radio"
                                class="btn-check"
                                name="${device.get('id')}"
                                id="${id1}"
                                autocomplete="off"
                                value="1"
                                @click=${el.toggleDeviceTrust}
                                ?checked=${is_trusted}
                            />
                            <label
                                class="btn ${is_trusted ? 'btn-primary active' : 'btn-outline-secondary'}"
                                for="${id1}"
                                >${i18n_trusted}</label
                            >

                            <input
                                type="radio"
                                class="btn-check"
                                name="${device.get('id')}"
                                id="${id2}"
                                autocomplete="off"
                                value="-1"
                                @click=${el.toggleDeviceTrust}
                                ?checked=${!is_trusted}
                            />
                            <label
                                class="btn ${!is_trusted ? 'btn-primary active' : 'btn-outline-secondary'}"
                                for="${id2}"
                                >${i18n_untrusted}</label
                            >
                        </div>
                        <div>
                            <span class="text-muted">${__('Device ID')}:</span>
                            <span class="ms-2">${device?.get('id') || ''}</span>
                        </div>
                    </div>
                    <code class="fingerprint ${device.get('active') === false ? 'text-muted' : ''}"
                        >${formatFingerprint(device.get('bundle').fingerprint)}</code
                    >
                </form>
            </li>
        `;
    } else {
        return '';
    }
};

/**
 * @param {import('../fingerprints').Fingerprints} el
 */
export default (el) => {
    const i18n_fingerprints = __('OMEMO Fingerprints');
    const i18n_no_devices = __('No OMEMO-enabled devices found');
    const devices = el.devicelist.devices;

    const i18n_show_inactive = __('Show inactive devices');
    const active_devices = devices?.filter((device) => device.get('active') !== false);
    const inactive_devices = devices?.filter((device) => device.get('active') === false);

    return html`
        <div class="fingerprints">
            <ul class="list-group mb-3">
                <li class="list-group-item active">${i18n_fingerprints}</li>
                ${active_devices.length
                    ? active_devices.map((device) => device_fingerprint(el, device))
                    : html`<li class="list-group-item">${i18n_no_devices}</li>`}
                <li class="list-group-item">
                    <div class="form-check">
                        <input
                            type="checkbox"
                            class="form-check-input"
                            id="show-inactive-devices"
                            @change=${el.toggleShowInactiveDevices}
                        />
                        <label class="form-check-label mt-1" for="show-inactive-devices">${i18n_show_inactive}</label>
                    </div>
                </li>
                ${inactive_devices.length && el.show_inactive_devices
                    ? html`${inactive_devices.map((device) => device_fingerprint(el, device))}`
                    : ''}
            </ul>
        </div>
    `;
};
