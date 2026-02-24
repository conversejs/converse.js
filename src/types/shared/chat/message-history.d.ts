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
    /**
     * @param {(Message)} model
     */
    renderMessage(model: (import("@converse/headless").Message)): import("lit-html/directive.js").DirectiveResult<{
        new (_partInfo: import("lit-html/directive.js").PartInfo): import("lit-html/directives/until.js").UntilDirective<any>;
    }>;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=message-history.d.ts.map