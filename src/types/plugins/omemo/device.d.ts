export default Device;
/**
 * @namespace _converse.Device
 * @memberOf _converse
 */
declare class Device extends Model {
    defaults(): {
        trusted: number;
        active: boolean;
    };
    getRandomPreKey(): any;
    fetchBundleFromServer(): Promise<{
        identity_key: any;
        signed_prekey: {
            id: number;
            public_key: any;
            signature: any;
        };
        prekeys: any;
    } | null>;
    /**
     * Fetch and save the bundle information associated with
     * this device, if the information is not cached already.
     * @method _converse.Device#getBundle
     */
    getBundle(): Promise<any>;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=device.d.ts.map