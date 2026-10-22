export default class Time extends CustomElement {
    static get properties(): {
        timestamp: {
            type: StringConstructor;
        };
    };
    timestamp: string;
    render(): import("lit-html").TemplateResult<1>;
    /** @param {Map<string, any>} changed */
    updated(changed: Map<string, any>): void;
    #private;
}
import { CustomElement } from './element.js';
//# sourceMappingURL=time.d.ts.map