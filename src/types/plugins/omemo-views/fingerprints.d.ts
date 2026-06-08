export class Fingerprints extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
        loading: {
            type: BooleanConstructor;
            state: boolean;
        };
        show_inactive_devices: {
            type: BooleanConstructor;
            state: boolean;
        };
    };
    jid: any;
    loading: boolean;
    show_inactive_devices: boolean;
    /**
     * Fetch both the legacy and the omemo:2 device lists in the background so
     * neither blocks rendering; each renders its devices as soon as it resolves.
     * A failure (e.g. on a server without omemo:2 support) must not block the
     * other list. The loading flag is cleared once both have settled so the
     * empty state only shows when there genuinely are no devices.
     */
    fetchDeviceLists(): void;
    devicelist: import("@converse/headless").DeviceList;
    devicelist_v2: import("@converse/headless").DeviceList;
    /** Returns all devices (legacy + v2) as a flat array for rendering. */
    getAllDevices(): any[];
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {Event} ev
     */
    toggleDeviceTrust(ev: Event): void;
    /**
     * @param {Event} ev
     */
    toggleShowInactiveDevices(ev: Event): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=fingerprints.d.ts.map