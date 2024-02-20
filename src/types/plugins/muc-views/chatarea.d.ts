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
    initialize(): Promise<void>;
    model: any;
    onMouseMove: any;
    onMouseUp: any;
    render(): import("lit-html").TemplateResult<1>;
    shouldShowSidebar(): boolean;
    getHelpMessages(): string[];
    onMousedown(ev: any): void;
    onStartResizeOccupants(ev: any): void;
    resizing: boolean;
    width: number;
    prev_pageX: any;
    _onMouseMove(ev: any): void;
    _onMouseUp(ev: any): void;
    calculateSidebarWidth(element_position: any, delta: any): any;
    is_minimum: boolean;
    is_maximum: boolean;
    resizeSidebarView(delta: any, current_mouse_position: any): void;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=chatarea.d.ts.map