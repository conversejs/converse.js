export default class Avatar extends CustomElement {
    static get properties(): {
        data: {
            type: ObjectConstructor;
        };
        width: {
            type: StringConstructor;
        };
        height: {
            type: StringConstructor;
        };
        nonce: {
            type: StringConstructor;
        };
    };
    data: any;
    width: number;
    height: number;
    render(): import("lit-html").TemplateResult<1> | "";
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=avatar.d.ts.map