/**
 * The view of an open/ongoing chat conversation.
 * @class
 * @namespace _converse.ChatBoxView
 * @memberOf _converse
 */
export default class ChatView {
    length: number;
    initialize(): Promise<void>;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    getHelpMessages(): string[];
    afterShown(): void;
}
