/**
 * The view of an open/ongoing chat conversation.
 * @class
 * @namespace _converse.ChatView
 * @memberOf _converse
 */
export default class ChatView extends BaseChatView {
    length: number;
    initialize(): Promise<void>;
    render(): import("lit-html").TemplateResult<1>;
    getHelpMessages(): string[];
    afterShown(): void;
}
import BaseChatView from 'shared/chat/baseview.js';
//# sourceMappingURL=chat.d.ts.map