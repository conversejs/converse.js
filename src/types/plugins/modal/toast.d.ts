export default class Toast extends CustomElement {
    static get properties(): {
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
    initialize(): void;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {MouseEvent} [ev]
     */
    hide(ev?: MouseEvent): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=toast.d.ts.map