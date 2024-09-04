/**
 * A component that exposes a text input to enable filtering of a list of DOM items.
 */
export default class ListFilter extends CustomElement {
    static get properties(): {
        items: {
            type: ArrayConstructor;
        };
        model: {
            type: ObjectConstructor;
        };
        promise: {
            type: PromiseConstructor;
        };
        template: {
            type: ObjectConstructor;
        };
    };
    items: any;
    model: any;
    template: any;
    promise: Promise<void>;
    initialize(): void;
    liveFilter: import("lodash").DebouncedFunc<(ev: any) => any>;
    render(): any;
    dispatchUpdateEvent(): void;
    /**
     * @param {Event} ev
     */
    changeChatStateFilter(ev: Event): void;
    /**
     * @param {Event} ev
     */
    changeTypeFilter(ev: Event): void;
    /**
     * @param {Event} ev
     */
    submitFilter(ev: Event): void;
    /**
     * Returns true if the filter is enabled (i.e. if the user
     * has added values to the filter).
     * @returns {boolean}
     */
    isActive(): boolean;
    /**
     * @returns {boolean}
     */
    shouldBeVisible(): boolean;
    /**
     * @param {Event} ev
     */
    clearFilter(ev: Event): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=list-filter.d.ts.map