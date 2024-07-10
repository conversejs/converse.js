export default class MUCSidebar extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    initialize(): void;
    filter: RosterFilter;
    model: any;
    render(): import("lit").TemplateResult<1>;
    /** @param {MouseEvent} ev */
    toggleFilter(ev: MouseEvent): void;
    /** @param {MouseEvent} ev */
    closeSidebar(ev: MouseEvent): void;
    /** @param {MouseEvent} ev */
    onOccupantClicked(ev: MouseEvent): void;
}
import { CustomElement } from "shared/components/element.js";
import { RosterFilter } from "@converse/headless";
//# sourceMappingURL=sidebar.d.ts.map