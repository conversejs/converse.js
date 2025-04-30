export default ConverseBackground;
declare class ConverseBackground extends CustomElement {
    static get properties(): {
        logo: {
            type: BooleanConstructor;
        };
    };
    initialize(): void;
    render(): import("lit-html").TemplateResult<1>;
    setThemeAttributes(): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=background.d.ts.map