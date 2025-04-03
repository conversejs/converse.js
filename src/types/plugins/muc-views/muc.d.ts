export default class MUCView extends BaseChatView {
    length: number;
    is_chatroom: boolean;
    initialize(): Promise<void>;
    render(): import("lit-html").TemplateResult<1>;
    onConnectionStatusChanged(): void;
}
import BaseChatView from 'shared/chat/baseview.js';
//# sourceMappingURL=muc.d.ts.map