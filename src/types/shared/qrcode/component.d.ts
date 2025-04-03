export default QRCodeComponent;
declare class QRCodeComponent extends CustomElement {
    static get properties(): {
        text: {
            type: StringConstructor;
        };
        width: {
            type: StringConstructor;
        };
        height: {
            type: StringConstructor;
        };
    };
    text: any;
    width: string;
    height: string;
    colorDark: string;
    colorLight: string;
    correctLevel: number;
    render(): import("lit-html").TemplateResult<2>;
    #private;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=component.d.ts.map