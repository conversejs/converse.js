export default class Image extends CustomElement {
    static get properties(): {
        src: {
            type: StringConstructor;
        };
        onImgLoad: {
            type: FunctionConstructor;
        };
        href: {
            type: StringConstructor;
        };
    };
    src: any;
    href: any;
    onImgClick: any;
    onImgLoad: any;
    render(): import("lit-html").TemplateResult<1>;
}
import { CustomElement } from "./element.js";
//# sourceMappingURL=image.d.ts.map