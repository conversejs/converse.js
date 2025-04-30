export default class Avatar extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        pickerdata: {
            type: ObjectConstructor;
        };
        name: {
            type: StringConstructor;
        };
        width: {
            type: StringConstructor;
        };
        height: {
            type: StringConstructor;
        };
        nonce: {
            type: StringConstructor;
        };
    };
    model: any;
    pickerdata: any;
    width: number;
    height: number;
    name: string;
    render(): import("lit-html").TemplateResult<1> | "";
    /**
     * @param {string} name
     * @returns {string}
     */
    getInitials(name: string): string;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=avatar.d.ts.map