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
    nonce: string;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * Clears the selected image.
     * @param {Event} ev
     */
    clearImage(ev: Event): void;
    data: {
        data_uri: any;
        image_type: any;
    } | {
        data_uri: string | ArrayBuffer;
        image_type: string;
    };
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
//# sourceMappingURL=image-picker.d.ts.map