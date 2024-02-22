export default class MUCSidebar extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    initialize(): void;
    filter: any;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    /** @param {MouseEvent} ev */
    toggleFilter(ev: MouseEvent): void;
    /** @param {MouseEvent} ev */
    closeSidebar(ev: MouseEvent): void;
    /** @param {MouseEvent} ev */
    onOccupantClicked(ev: MouseEvent): void;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=sidebar.d.ts.map