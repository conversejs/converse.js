export default DeviceList;
/**
 * @namespace _converse.DeviceList
 * @memberOf _converse
 */
declare class DeviceList extends Model {
    initialize(): Promise<void>;
    initialized: any;
    initDevices(): Promise<any>;
    devices: any;
    onDevicesFound(collection: any): Promise<void>;
    fetchDevices(): Promise<any>;
    _devices_promise: Promise<any> | undefined;
    getOwnDeviceId(): Promise<any>;
    publishCurrentDevice(device_ids: any): Promise<any>;
    fetchDevicesFromServer(): Promise<any[]>;
    /**
     * Send an IQ stanza to the current user's "devices" PEP node to
     * ensure that all devices are published for potential chat partners to see.
     * See: https://xmpp.org/extensions/xep-0384.html#usecases-announcing
     */
    publishDevices(): any;
    removeOwnDevices(device_ids: any): Promise<any>;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=devicelist.d.ts.map