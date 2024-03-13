export default class MessageHistory extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        messages: {
            type: ArrayConstructor;
        };
    };
    model: any;
    messages: any[];
    renderMessage(model: any): import("lit-html/directive").DirectiveResult<typeof import("lit-html/directives/until").UntilDirective>;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=message-history.d.ts.map