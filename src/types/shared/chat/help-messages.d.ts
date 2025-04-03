export default class ChatHelp extends CustomElement {
    static get properties(): {
        chat_type: {
            type: StringConstructor;
        };
        messages: {
            type: ArrayConstructor;
        };
        model: {
            type: ObjectConstructor;
        };
        type: {
            type: StringConstructor;
        };
    };
    messages: any[];
    model: any;
    type: any;
    render(): import("lit-html").TemplateResult<1>[];
    close(): void;
    renderHelpMessage(o: any): import("lit-html").TemplateResult<1>;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=help-messages.d.ts.map