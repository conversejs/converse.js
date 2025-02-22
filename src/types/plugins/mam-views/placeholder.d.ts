export default Placeholder;
declare class Placeholder extends ObservableElement {
    /**
     * @typedef {import('shared/components/types').ObservableProperty} ObservableProperty
     */
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
    render(): import("lit").TemplateResult<1>;
    /**
     * @param {Event} [ev]
     */
    fetchMissingMessages(ev?: Event): void;
}
import { ObservableElement } from "shared/components/observable.js";
//# sourceMappingURL=placeholder.d.ts.map