import { api } from '@converse/headless';
import { CustomElement } from './element.js';

/**
 * Whether the document (browser tab/window) is currently focused/visible.
 * Treated as visible when there's no `document` (e.g. non-browser contexts),
 * so visibility handling can't deadlock.
 * @returns {boolean}
 */
function isDocumentVisible() {
    return typeof document === 'undefined' || document.visibilityState === 'visible';
}

/**
 * An element which triggers a global `visibilityChanged` event when
 * it becomes visible in the viewport. The `observable` property needs to be set.
 */
export class ObservableElement extends CustomElement {
    static get properties() {
        return {
            ...super.properties,
            observable: { type: String },
            intersectionRatio: { type: Number },
        };
    }

    constructor() {
        super();
        this.model = null;

        /**
         * The observable property determines the observability of this element.
         * - 'once': an event is triggered once, when the element first becomes visible.
         * - 'always': an event is triggered every time the element becomes visible
         *   (on each intersection change while visible, and — when
         *   `observableRequireFocus` is set — each time the tab regains focus
         *   while the element is in view).
         * @type {import('./types').ObservableProperty}
         */
        this.observable = null;

        this.isVisible = false;
        this.observableThresholds = [0.0, 0.25, 0.5, 0.75, 1.0]; // thresholds to check for, every 25%
        this.observableMargin = '0px'; // margin from root element
        this.intersectionRatio = 0.5; // wait till at least 50% of the item is visible
        this.observableDelay = 100;

        /**
         * When `true`, the element is only considered visible ("seen") once it's
         * both within the viewport AND the browser tab/window is focused
         * (`document.visibilityState === 'visible'`). If the element scrolls into
         * view while the tab is in the background, the visibility handling is
         * deferred until the user returns to the tab. Defaults to `false`, which
         * preserves the purely geometric (viewport-only) behaviour.
         * @type {boolean}
         */
        this.observableRequireFocus = false;

        /** Whether the element currently meets the intersection threshold. */
        this.isIntersecting = false;

        /** The most recent IntersectionObserver entry. @type {?IntersectionObserverEntry} */
        this.lastEntry = null;
    }

    /**
     * @param {import("lit").PropertyValues} changedProperties
     */
    firstUpdated(changedProperties) {
        super.firstUpdated(changedProperties);
        this.initIntersectionObserver();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.intersectionObserver?.disconnect();
        this.removeDocumentVisibilityListener();
    }

    removeDocumentVisibilityListener() {
        if (this.documentVisibilityListener) {
            document.removeEventListener('visibilitychange', this.documentVisibilityListener);
            this.documentVisibilityListener = null;
        }
    }

    initIntersectionObserver() {
        if (this.observable && !this.isVisible) {
            this.intersectionObserver = new IntersectionObserver(
                (entries) => this.handleIntersectionCallback(entries),
                {
                    rootMargin: this.observableMargin,
                    threshold: this.observableThresholds,
                    // @ts-ignore
                    delay: this.observableDelay,
                },
            );
            this.intersectionObserver.observe(this);

            // Focus-aware elements must also re-evaluate when the tab gains or
            // loses focus, not only when their intersection changes, so the
            // listener lives for the whole observed lifetime (torn down on
            // disconnect, or when an `observable === 'once'` element is handled).
            if (this.observableRequireFocus) this.addDocumentVisibilityListener();
        }
    }

    alreadyHandled() {
        return this.observable === 'once' && this.isVisible;
    }

    /**
     * @param {IntersectionObserverEntry[]} entries
     */
    handleIntersectionCallback(entries) {
        for (const entry of entries) {
            const ratio = Number(entry.intersectionRatio.toFixed(2));
            this.isIntersecting = ratio >= this.intersectionRatio;
            this.lastEntry = entry;
            this.evaluateVisibility(entry);
        }
    }

    /**
     * Evaluate whether the element should now be considered "seen", and if so
     * fire the visibility handlers. This is re-evaluated whenever the
     * intersection state changes and, when `observableRequireFocus` is set, also
     * whenever the document's focus/visibility changes — so the *current*
     * intersection state is always used (the element may have scrolled back out
     * of view while the tab was in the background).
     * @param {IntersectionObserverEntry} entry
     */
    evaluateVisibility(entry) {
        if (this.alreadyHandled()) return;
        if (!this.isIntersecting) return;

        // In the viewport, but a focus-aware element isn't "seen" while the tab
        // is in the background. The 'visibilitychange' listener (attached when
        // the observer was set up) re-evaluates against the then-current
        // intersection state once focus returns.
        if (this.observableRequireFocus && !isDocumentVisible()) return;

        if (this.observable === 'once') {
            this.intersectionObserver?.disconnect();
            this.removeDocumentVisibilityListener();
        }
        this.isVisible = true;

        api.trigger('visibilityChanged', { el: this, entry });
        this.onVisibilityChanged(entry);
    }

    addDocumentVisibilityListener() {
        if (this.documentVisibilityListener) return;
        this.documentVisibilityListener = () => this.evaluateVisibility(this.lastEntry);
        document.addEventListener('visibilitychange', this.documentVisibilityListener);
    }

    /**
     * @param {IntersectionObserverEntry} _entry
     */
    onVisibilityChanged(_entry) {
        // override this method in your subclass
    }
}
