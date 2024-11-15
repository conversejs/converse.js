export default class MUCChatArea extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
        show_help_messages: {
            type: BooleanConstructor;
        };
        type: {
            type: StringConstructor;
        };
    };
    jid: any;
    type: any;
    split: any;
    initialize(): Promise<void>;
    model: any;
    render(): import("lit").TemplateResult<1> | "";
    shouldShowSidebar(): boolean;
    getHelpMessages(): string[];
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=chatarea.d.ts.map