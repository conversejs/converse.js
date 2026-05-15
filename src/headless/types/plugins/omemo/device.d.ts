export default Device;
/**
 * @extends {Model<import('./types').DeviceAttributes>}
 */
declare class Device extends Model<import("./types").DeviceAttributes> {
    constructor(attributes?: Partial<import("./types").DeviceAttributes>, options?: import("@converse/skeletor").ModelOptions);
    defaults(): {
        trusted: 0;
        active: boolean;
    };
    /**
     * @returns {import('./types').CounterpartyPreKey}
     */
    getRandomPreKey(): import("./types").CounterpartyPreKey;
    /**
     * Fetch the device's OMEMO bundle from the server.
     * A bundle is a collection of publicly accessible data that can
     * be used to build a session with a device, namely its public IdentityKey,
     * a signed PreKey with corresponding signature, and a list of (single use) PreKeys.
     * @returns {Promise<import('./types').Bundle>}
     */
    fetchBundleFromServer(): Promise<import("./types").Bundle>;
    /**
     * Fetch and save the bundle information associated with
     * this device, if the information is not cached already.
     * @returns {Promise<import('./types').Bundle>}
     */
    getBundle(): Promise<import("./types").Bundle>;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=device.d.ts.map