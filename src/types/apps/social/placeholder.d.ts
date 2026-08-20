export default Placeholder;
declare class Placeholder extends ObservableElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        observable: {
            type: StringConstructor;
        };
        intersectionRatio: {
            type: NumberConstructor;
        };
    };
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {Event} [ev]
     */
    fetchMissingMessages(ev?: Event): void;
}
import { ObservableElement } from 'shared/components/observable.js';
//# sourceMappingURL=placeholder.d.ts.map