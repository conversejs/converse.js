export default class MinimizedChat extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        title: {
            type: StringConstructor;
        };
        type: {
            type: StringConstructor;
        };
        num_unread: {
            type: NumberConstructor;
        };
    };
    model: any;
    num_unread: any;
    type: any;
    title: any;
    render(): import("lit").TemplateResult<1>;
    close(ev: any): void;
    restore(ev: any): void;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=minimized-chat.d.ts.map