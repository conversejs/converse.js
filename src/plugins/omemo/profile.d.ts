export class Profile {
    initialize(): Promise<void>;
    devicelist: any;
    setAttributes(): Promise<void>;
    device_id: any;
    current_device: any;
    other_devices: any;
    render(): any;
    selectAll(ev: any): void;
    removeSelectedFingerprints(ev: any): Promise<void>;
    generateOMEMODeviceBundle(ev: any): Promise<void>;
}
