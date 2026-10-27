declare const ChatView_base: typeof BaseChatView & import("../dragresize/types.js").DragResizableConstructor;
/**
 * The view of an open/ongoing chat conversation.
 */
export default class ChatView extends ChatView_base {
    length: number;
    initialize(): Promise<void>;
    render(): import("lit-html").TemplateResult<1>;
    getHelpMessages(): string[];
    afterShown(): void;
}
import BaseChatView from 'shared/chat/baseview.js';
export {};
//# sourceMappingURL=chat.d.ts.map