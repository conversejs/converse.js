export default class Time extends CustomElement {
    static get properties(): {
        timestamp: {
            type: StringConstructor;
        };
    };
    timestamp: string;
    render(): import("lit-html").TemplateResult<1>;
    #private;
}
import { CustomElement } from './element.js';
//# sourceMappingURL=time.d.ts.map