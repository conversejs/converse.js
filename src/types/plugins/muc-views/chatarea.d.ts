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
    viewportMediaQuery: MediaQueryList;
    initialize(): Promise<void>;
    model: any;
    render(): import("lit-html").TemplateResult<1> | "";
    connectedCallback(): void;
    hideSidebarIfSmallViewport: any;
    shouldShowSidebar(): boolean;
    getHelpMessages(): string[];
    #private;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=chatarea.d.ts.map