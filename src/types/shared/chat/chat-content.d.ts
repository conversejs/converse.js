export default class ChatContent extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    initialize(): Promise<void>;
    setModels(): Promise<void>;
    model: any;
    render(): import("lit").TemplateResult<1> | "";
    scrollDown(): void;
}
import { CustomElement } from "../components/element.js";
//# sourceMappingURL=chat-content.d.ts.map