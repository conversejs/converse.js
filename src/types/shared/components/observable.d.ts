export class ObservableElement extends CustomElement {
    static get properties(): {
        observable: {
            type: StringConstructor;
        };
    };
    model: any;
    isVisible: boolean;
    /**
     * The observable property determines the observability of this element.
     * - 'once': an event will be triggered once when the element becomes visible.
     * - 'always': an event is triggered every time (the IntersectionObserver callback is called).
     * @type {import('./types').ObservableProperty}
     */
    observable: import("./types").ObservableProperty;
    observableThresholds: number[];
    observableMargin: string;
    observableRatio: number;
    observableDelay: number;
    initIntersectionObserver(): void;
    intersectionObserver: IntersectionObserver | undefined;
    /**
     * @param {IntersectionObserverEntry[]} entries
     */
    handleIntersectionCallback(entries: IntersectionObserverEntry[]): void;
}
import { CustomElement } from "./element";
//# sourceMappingURL=observable.d.ts.map