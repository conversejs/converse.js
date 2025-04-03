export default class ImagePicker extends CustomElement {
    static get properties(): {
        height: {
            type: NumberConstructor;
        };
        model: {
            type: ObjectConstructor;
        };
        width: {
            type: NumberConstructor;
        };
    };
    model: any;
    width: any;
    height: any;
    data: Model;
    nonce: string;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {Event} ev
     */
    openFileSelection(ev: Event): void;
    /**
     * @param {InputEvent} ev
     */
    updateFilePreview(ev: InputEvent): void;
}
import { CustomElement } from './element.js';
import { Model } from '@converse/skeletor';
//# sourceMappingURL=image-picker.d.ts.map