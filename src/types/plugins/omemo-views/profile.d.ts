export class Profile extends CustomElement {
    initialize(): Promise<void>;
    setAttributes(): Promise<void>;
    devicelist: any;
    devicelist_v2: any;
    device_id: any;
    current_device: any;
    current_device_v2: any;
    other_devices: any;
    render(): import("lit-html").TemplateResult<1>;
    /** @param {MouseEvent} ev */
    copyFingerprint(ev: MouseEvent): Promise<void>;
    selectAll(ev: any): void;
    removeSelectedFingerprints(ev: any): Promise<void>;
    generateOMEMODeviceBundle(ev: any): Promise<void>;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=profile.d.ts.map