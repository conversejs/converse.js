export default class XMPPStatus extends Model {
    defaults(): {
        status: any;
    };
    getDisplayName(): any;
    getNickname(): any;
    getFullname(): string;
    /** Constructs a presence stanza
     * @param { string } [type]
     * @param { string } [to] - The JID to which this presence should be sent
     * @param { string } [status_message]
     */
    constructPresence(type?: string, to?: string, status_message?: string): Promise<any>;
}
import { Model } from "@converse/skeletor";
//# sourceMappingURL=status.d.ts.map