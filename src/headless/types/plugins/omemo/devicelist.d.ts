export default DeviceList;
/**
 * @extends {OMEMOVersionAwareModel<import('../../shared/types').JIDModelAttributes>}
 */
declare class DeviceList extends OMEMOVersionAwareModel<import("../../shared/types").JIDModelAttributes> {
    constructor(attributes?: Partial<import("../../shared/types").JIDModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
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
    /**
     * Whether the most recent server fetch for this device list failed
     * (timeout or error stanza), as opposed to authoritatively returning no
     * devices (an empty list or item-not-found). Callers use this to decide
     * whether an empty device list is worth re-fetching: a genuine "no devices"
     * answer is not (a PEP push will inform us if that changes, since we
     * advertise `+notify`), but a transient failure is.
     * @returns {boolean}
     */
    get lastFetchFailed(): boolean;
    onDevicesFound(collection: any): Promise<void>;
    /**
     * @param {boolean} [refresh=false] - Discard any previously memoized
     *      result and fetch the devices anew. Used to recover from a state
     *      where an earlier fetch failed or the contact had not yet published
     *      their device list.
     */
    fetchDevices(refresh?: boolean): Promise<any>;
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
    #private;
}
import { OMEMOVersionAwareModel } from './profiles.js';
//# sourceMappingURL=devicelist.d.ts.map