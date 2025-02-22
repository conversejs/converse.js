import { api } from "@converse/headless";
import { CustomElement } from "./element";

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
         * - 'once': an event will be triggered once when the element becomes visible.
         * - 'always': an event is triggered every time (the IntersectionObserver callback is called).
         * @type {import('./types').ObservableProperty}
         */
        this.observable = null;

        this.isVisible = false;
        this.observableThresholds = [0.0, 0.25, 0.5, 0.75, 1.0]; // thresholds to check for, every 25%
        this.observableMargin = "0px"; // margin from root element
        this.intersectionRatio = 0.5; // wait till at least 50% of the item is visible
        this.observableDelay = 100;
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
                }
            );
            this.intersectionObserver.observe(this);
        }
    }

    alreadyHandled() {
        return (this.observable === "once" && this.isVisible);
    }

    /**
     * @param {IntersectionObserverEntry[]} entries
     */
    handleIntersectionCallback(entries) {
        if (this.alreadyHandled()) return;

        for (const entry of entries) {
            const ratio = Number(entry.intersectionRatio.toFixed(2));
            if (ratio >= this.intersectionRatio && !this.alreadyHandled()) {
                if (this.observable === "once") {
                    this.intersectionObserver.disconnect();
                }
                this.isVisible = true;

                api.trigger("visibilityChanged", { el: this, entry });
                this.onVisibilityChanged(entry);
            }
        }
    }

    /**
     * @param {IntersectionObserverEntry} _entry
     */
    onVisibilityChanged(_entry) {
        // override this method in your subclass
    }
}
