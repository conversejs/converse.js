export default class MessageLimitIndicator extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
    };
    model: any;
    connectedCallback(): void;
    render(): import("lit-html").TemplateResult<1> | "";
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=message-limit.d.ts.map