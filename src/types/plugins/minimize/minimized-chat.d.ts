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
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {MouseEvent} ev
     */
    close(ev: MouseEvent): void;
    /**
     * @param {MouseEvent} ev
     */
    restore(ev: MouseEvent): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=minimized-chat.d.ts.map