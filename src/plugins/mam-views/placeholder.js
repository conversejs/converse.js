import { api, u } from "@converse/headless";
import { ObservableElement } from "shared/components/observable.js";
import tplPlaceholder from "./templates/placeholder.js";

import "./styles/placeholder.scss";

class Placeholder extends ObservableElement {
    static get properties() {
        return {
            ...super.properties,
            model: { type: Object },
        };
    }

    constructor() {
        super();
        this.model = null;
    }

    render() {
        return tplPlaceholder(this);
    }

    /**
     * @param {Event} [ev]
     */
    async fetchMissingMessages(ev) {
        ev?.preventDefault?.();
        this.model.set("fetching", true);
        const options = {
            before: this.model.get("before"),
            start: this.model.get("start"),
        };
        await u.mam.fetchArchivedMessages(this.model.collection.chatbox, options);
        this.model.destroy();
    }
}

api.elements.define("converse-mam-placeholder", Placeholder);
