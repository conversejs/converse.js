export default class Toast extends CustomElement {
    static get properties(): {
        type: {
            type: StringConstructor;
        };
        name: {
            type: StringConstructor;
        };
        title: {
            type: StringConstructor;
        };
        body: {
            type: StringConstructor;
        };
    };
    name: string;
    body: string;
    header: string;
    type: string;
    timeoutId: NodeJS.Timeout;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {MouseEvent} [ev]
     */
    hide(ev?: MouseEvent): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=toast.d.ts.map