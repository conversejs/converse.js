export default Popover;
declare class Popover extends CustomElement {
    static get properties(): {
        title: {
            type: StringConstructor;
        };
        text: {
            type: StringConstructor;
        };
    };
    title: any;
    text: any;
    render(): import("lit-html").TemplateResult<1>;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=popover.d.ts.map