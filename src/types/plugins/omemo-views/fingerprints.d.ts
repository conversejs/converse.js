export class Fingerprints extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
        show_inactive_devices: {
            type: BooleanConstructor;
            state: boolean;
        };
    };
    jid: any;
    show_inactive_devices: boolean;
    initialize(): Promise<void>;
    devicelist: any;
    render(): import("lit-html").TemplateResult<1> | "";
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