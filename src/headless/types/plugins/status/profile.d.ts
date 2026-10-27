declare const Profile_base: (new (attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions) => Model<import("@converse/skeletor").ModelAttributes>) & import("../../shared/types.js").Constructor<import("../../shared/types.js").ColorAware> & import("../../shared/types.js").Constructor<import("../../shared/types.js").VCardAware>;
export default class Profile extends Profile_base {
    defaults(): {
        presence: string;
        status: any;
        show: any;
        groups: any[];
    };
    /**
     * @return {import('./types').ConnectionStatus}
     */
    getStatus(): import("./types").ConnectionStatus;
    get(attr: any): any;
    /**
     * @param {string|Object} key
     * @param {string|Object} [val]
     * @param {Object} [options]
     */
    set(key: string | any, val?: string | any, options?: any): this;
    initialize(): void;
    /**
     * @param {import('../roster/types.js').ContactDisplayNameOptions} [options]
     */
    getDisplayName(options?: import("../roster/types.js").ContactDisplayNameOptions): any;
    /**
     * @returns {string|undefined}
     */
    getNickname(): string | undefined;
    /**
     * Constructs a presence stanza
     * @param {import('./types').PresenceAttrs} [attrs={}]
     * @returns {Promise<Stanza>}
     */
    constructPresence(attrs?: import("./types").PresenceAttrs): Promise<any>;
}
import { Model } from '@converse/skeletor';
export {};
//# sourceMappingURL=profile.d.ts.map