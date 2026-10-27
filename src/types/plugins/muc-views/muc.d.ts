declare const MUCView_base: typeof BaseChatView & import("../dragresize/types.js").DragResizableConstructor;
export default class MUCView extends MUCView_base {
    length: number;
    is_chatroom: boolean;
    initialize(): Promise<void>;
    render(): import("lit-html").TemplateResult<1>;
    onConnectionStatusChanged(): void;
}
import BaseChatView from 'shared/chat/baseview.js';
export {};
//# sourceMappingURL=muc.d.ts.map