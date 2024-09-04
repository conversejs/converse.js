export default class XMPPStatus extends ColorAwareModel {
    constructor(attributes: any, options: any);
    vcard: any;
    defaults(): {
        status: any;
    };
    /**
     * @param {string|Object} key
     * @param {string|Object} [val]
     * @param {Object} [options]
     */
    set(key: string | any, val?: string | any, options?: any): any;
    getDisplayName(): any;
    getNickname(): any;
    getFullname(): string;
    /** Constructs a presence stanza
     * @param {string} [type]
     * @param {string} [to] - The JID to which this presence should be sent
     * @param {string} [status_message]
     */
    constructPresence(type?: string, to?: string, status_message?: string): Promise<any>;
}
import { ColorAwareModel } from '../../shared/color.js';
//# sourceMappingURL=status.d.ts.map