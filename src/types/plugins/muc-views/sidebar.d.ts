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
    closeSidebar(ev: any): void;
    onOccupantClicked(ev: any): void;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=sidebar.d.ts.map