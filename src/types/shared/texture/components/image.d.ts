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
    render(): import("lit").TemplateResult<1>;
}
import { CustomElement } from "shared/components/element";
//# sourceMappingURL=image.d.ts.map