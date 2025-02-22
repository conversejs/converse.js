import { api } from "@converse/headless";
import { ObservableElement } from "shared/components/observable.js";
import tplPlaceholder from "./templates/placeholder.js";

import "./styles/placeholder.scss";

class Placeholder extends ObservableElement {
    /**
     * @typedef {import('shared/components/types').ObservableProperty} ObservableProperty
     */

    static get properties() {
        return {
            ...super.properties,
            model: { type: Object },
        };
    }

    constructor() {
        super();
        this.model = null;
        this.observable = /** @type {ObservableProperty} */ ("once");
        this.intersectionRatio = 0.1;
    }

    render() {
        return tplPlaceholder(this);
    }

    /**
     * @param {Event} [ev]
     */
    fetchMissingMessages(ev) {
        ev?.preventDefault?.();
        this.model.fetchMissingMessages();
    }

    /**
     * @param {IntersectionObserverEntry} _entry
     */
    onVisibilityChanged(_entry) {
        if (api.settings.get("auto_fill_history_gaps") && this.isVisible && !this.model.get("fetching")) {
            this.fetchMissingMessages();
        }
    }
}

api.elements.define("converse-mam-placeholder", Placeholder);

export default Placeholder;
