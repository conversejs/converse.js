/**
 * An element which triggers a global `visibilityChanged` event when
 * it becomes visible in the viewport. The `observable` property needs to be set.
 */
export class ObservableElement extends CustomElement {
    static get properties(): {
        observable: {
            type: StringConstructor;
        };
        intersectionRatio: {
            type: NumberConstructor;
        };
    };
    model: any;
    /**
     * The observable property determines the observability of this element.
     * - 'once': an event will be triggered once when the element becomes visible.
     * - 'always': an event is triggered every time (the IntersectionObserver callback is called).
     * @type {import('./types').ObservableProperty}
     */
    observable: import("./types").ObservableProperty;
    isVisible: boolean;
    observableThresholds: number[];
    observableMargin: string;
    intersectionRatio: number;
    observableDelay: number;
    initIntersectionObserver(): void;
    intersectionObserver: IntersectionObserver;
    alreadyHandled(): boolean;
    /**
     * @param {IntersectionObserverEntry[]} entries
     */
    handleIntersectionCallback(entries: IntersectionObserverEntry[]): void;
    /**
     * @param {IntersectionObserverEntry} _entry
     */
    onVisibilityChanged(_entry: IntersectionObserverEntry): void;
}
import { CustomElement } from "./element";
//# sourceMappingURL=observable.d.ts.map