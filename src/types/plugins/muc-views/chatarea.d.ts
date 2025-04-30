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
    hideSidebarIfSmallViewport: (...args: any[]) => void;
    render(): import("lit-html").TemplateResult<1> | "";
    connectedCallback(): void;
    shouldShowSidebar(): boolean;
    getHelpMessages(): string[];
    #private;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=chatarea.d.ts.map