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
     * - 'once': an event is triggered once, when the element first becomes visible.
     * - 'always': an event is triggered every time the element becomes visible
     *   (on each intersection change while visible, and — when
     *   `observableRequireFocus` is set — each time the tab regains focus
     *   while the element is in view).
     * @type {import('./types').ObservableProperty}
     */
    observable: import("./types").ObservableProperty;
    isVisible: boolean;
    observableThresholds: number[];
    observableMargin: string;
    intersectionRatio: number;
    observableDelay: number;
    /**
     * When `true`, the element is only considered visible ("seen") once it's
     * both within the viewport AND the browser tab/window is focused
     * (`document.visibilityState === 'visible'`). If the element scrolls into
     * view while the tab is in the background, the visibility handling is
     * deferred until the user returns to the tab. Defaults to `false`, which
     * preserves the purely geometric (viewport-only) behaviour.
     * @type {boolean}
     */
    observableRequireFocus: boolean;
    /** Whether the element currently meets the intersection threshold. */
    isIntersecting: boolean;
    /** The most recent IntersectionObserver entry. @type {?IntersectionObserverEntry} */
    lastEntry: IntersectionObserverEntry | null;
    removeDocumentVisibilityListener(): void;
    documentVisibilityListener: () => void;
    initIntersectionObserver(): void;
    intersectionObserver: IntersectionObserver;
    alreadyHandled(): boolean;
    /**
     * @param {IntersectionObserverEntry[]} entries
     */
    handleIntersectionCallback(entries: IntersectionObserverEntry[]): void;
    /**
     * Evaluate whether the element should now be considered "seen", and if so
     * fire the visibility handlers. This is re-evaluated whenever the
     * intersection state changes and, when `observableRequireFocus` is set, also
     * whenever the document's focus/visibility changes — so the *current*
     * intersection state is always used (the element may have scrolled back out
     * of view while the tab was in the background).
     * @param {IntersectionObserverEntry} entry
     */
    evaluateVisibility(entry: IntersectionObserverEntry): void;
    addDocumentVisibilityListener(): void;
    /**
     * @param {IntersectionObserverEntry} _entry
     */
    onVisibilityChanged(_entry: IntersectionObserverEntry): void;
}
import { CustomElement } from './element.js';
//# sourceMappingURL=observable.d.ts.map