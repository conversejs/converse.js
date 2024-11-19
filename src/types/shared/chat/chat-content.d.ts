export default class ChatContent extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
    };
    model: any;
    initialize(): Promise<void>;
    render(): import("lit").TemplateResult<1> | "";
    scrollDown(): void;
}
import { CustomElement } from '../components/element.js';
//# sourceMappingURL=chat-content.d.ts.map