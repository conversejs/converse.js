export default class ImagePicker extends CustomElement {
    static get properties(): {
        height: {
            type: NumberConstructor;
        };
        data: {
            type: ObjectConstructor;
        };
        width: {
            type: NumberConstructor;
        };
    };
    width: any;
    height: any;
    render(): import("lit-html").TemplateResult<1>;
    openFileSelection(ev: any): void;
    updateFilePreview(ev: any): void;
    data: {
        data_uri: string | ArrayBuffer;
        image_type: any;
    };
}
import { CustomElement } from "./element.js";
//# sourceMappingURL=image-picker.d.ts.map