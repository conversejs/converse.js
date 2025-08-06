export default DeviceList;
declare class DeviceList extends Model {
    initialize(): Promise<void>;
    initialized: Promise<any> & {
        isResolved: boolean;
        isPending: boolean;
        isRejected: boolean;
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
    };
    initDevices(): Promise<any>;
    devices: any;
    /**
     * @param {import('./devices').default} collection
     */
    onDevicesFound(collection: import("./devices").default): Promise<void>;
    fetchDevices(): Promise<any>;
    _devices_promise: Promise<any>;
    /**
     * @returns {Promise<string>}
     */
    getOwnDeviceId(): Promise<string>;
    /**
     * @param {string[]} device_ids
     */
    publishCurrentDevice(device_ids: string[]): Promise<any>;
    /**
     * @returns {Promise<import('./device').default[]>}
     */
    fetchDevicesFromServer(): Promise<import("./device").default[]>;
    /**
     * Sends an IQ stanza to the current user's "devices" PEP node to
     * ensure that all devices are published for potential chat partners to see.
     * See: https://xmpp.org/extensions/attic/xep-0384-0.3.0.html#usecases-announcing
     */
    publishDevices(): any;
    /**
     * @param {string[]} device_ids
     */
    removeOwnDevices(device_ids: string[]): Promise<any>;
}
import { Model } from "@converse/headless";
//# sourceMappingURL=devicelist.d.ts.map