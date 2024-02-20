/**
 * @class
 * @namespace _converse.RosterView
 * @memberOf _converse
 */
export default class RosterView extends CustomElement {
    initialize(): Promise<void>;
    model: Model;
    render(): import("lit-html").TemplateResult<1>;
    showAddContactModal(ev: any): void;
    syncContacts(ev: any): Promise<void>;
    syncing_contacts: boolean;
    toggleRoster(ev: any): void;
}
import { CustomElement } from "shared/components/element.js";
import { Model } from "@converse/skeletor";
//# sourceMappingURL=rosterview.d.ts.map