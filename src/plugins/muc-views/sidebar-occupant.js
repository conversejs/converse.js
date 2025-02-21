import { Model } from "@converse/skeletor";
import { MUC, _converse, api } from "@converse/headless";
import { ObservableElement } from "shared/components/observable.js";
import tplMUCOccupant from "./templates/occupant.js";
import "./occupant-bottom-panel.js";

export default class MUCOccupantListItem extends ObservableElement {
    /**
     * @typedef {import('shared/components/types').ObservableProperty} ObservableProperty
     */

    constructor() {
        super();
        this.muc = null;
        this.observable = /** @type {ObservableProperty} */ ("once");
    }

    static get properties() {
        return {
            ...super.properties,
            model: { type: Model },
            muc: { type: MUC },
        };
    }

    async initialize() {
        super.initialize();
        await this.muc.initialized;
        this.listenTo(this.model, "change", () => this.requestUpdate());
        this.listenTo(this.model, "vcard:add", () => this.requestUpdate());
        this.listenTo(this.model, "vcard:change", () => this.requestUpdate());
        this.requestUpdate();
    }

    render() {
        return this.muc ? tplMUCOccupant(this) : "";
    }

    /**
     * @param {MouseEvent} ev
     * @param {import('@converse/headless/types/plugins/muc/occupant.js').default} occupant
     */
    onOccupantClicked(ev, occupant) {
        ev.preventDefault();
        if (this.muc.getOwnOccupant() === occupant) {
            api.modal.show("converse-profile-modal", { model: _converse.state.xmppstatus }, ev);
        } else {
            this.muc.save({ sidebar_view: `occupant:${occupant.id}` });
        }
    }
}

api.elements.define("converse-muc-occupant-list-item", MUCOccupantListItem);
