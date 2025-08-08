export class Profile extends CustomElement {
    initialize(): Promise<void>;
    devicelist: any;
    setAttributes(): Promise<void>;
    device_id: any;
    current_device: any;
    other_devices: any;
    render(): import("lit-html").TemplateResult<1>;
    selectAll(ev: any): void;
    removeSelectedFingerprints(ev: any): Promise<void>;
    generateOMEMODeviceBundle(ev: any): Promise<void>;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=profile.d.ts.map