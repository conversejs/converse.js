import { CustomElement } from "./element";

export class ObservableElement extends CustomElement {
    static get properties() {
        return {
            ...super.properties,
            observable: { type: String },
        };
    }

    constructor() {
        super();
        this.model = null;

        // Related to IntersectionObserver
        this.isVisible = false;
        /**
         * The observable property determines the observability of this element.
         * - 'once': an event will be triggered once when the element becomes visible.
         * - 'always': an event is triggered every time (the IntersectionObserver callback is called).
         * @type {import('./types').ObservableProperty}
         */
        this.observable = null;
        this.observableThresholds = [0.0, 0.25, 0.5, 0.75, 1.0]; // thresholds to check for, every 25%
        this.observableMargin = "0px"; // margin from root element
        this.observableRatio = 0.5; // wait till at least 50% of the item is visible
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

    /**
     * @param {IntersectionObserverEntry[]} entries
     */
    handleIntersectionCallback(entries) {
        for (const entry of entries) {
            const ratio = Number(entry.intersectionRatio.toFixed(2));
            if (ratio >= this.observableRatio) {
                this.isVisible = true;
                this.trigger("visibilityChanged", entry);
                this.model?.trigger("visibilityChanged", entry);

                if (this.observable === "once") {
                    this.intersectionObserver.disconnect();
                }
            }
        }
    }
}
