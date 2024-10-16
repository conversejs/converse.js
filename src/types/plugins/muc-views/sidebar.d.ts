export default class MUCSidebar extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    initialize(): void;
    model: any;
    render(): import("lit").TemplateResult<1>;
    /** @param {MouseEvent} ev */
    closeSidebar(ev: MouseEvent): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=sidebar.d.ts.map