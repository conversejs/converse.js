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
    render(): import("lit-html").TemplateResult<1>;
    /** @param {Event} ev */
    openFileSelection(ev: Event): void;
    /** @param {InputEvent} ev */
    updateFilePreview(ev: InputEvent): void;
    data: {
        data_uri: string | ArrayBuffer;
        image_type: string;
    };
}
import { CustomElement } from "./element.js";
//# sourceMappingURL=image-picker.d.ts.map