import { api } from "@converse/headless";
import { CustomElement } from "shared/components/element.js";
import tplFingerprints from "./templates/fingerprints.js";

export class Fingerprints extends CustomElement {
    constructor() {
        super();
        this.jid = null;
    }

    static get properties() {
        return {
            "jid": { type: String },
        };
    }

    async initialize() {
        this.devicelist = await api.omemo.devicelists.get(this.jid, true);
        this.listenTo(this.devicelist.devices, "change:bundle", () => this.requestUpdate());
        this.listenTo(this.devicelist.devices, "change:trusted", () => this.requestUpdate());
        this.listenTo(this.devicelist.devices, "remove", () => this.requestUpdate());
        this.listenTo(this.devicelist.devices, "add", () => this.requestUpdate());
        this.listenTo(this.devicelist.devices, "reset", () => this.requestUpdate());
        this.requestUpdate();
    }

    render() {
        return this.devicelist ? tplFingerprints(this) : "";
    }

    toggleDeviceTrust(ev) {
        const radio = ev.target;
        const device = this.devicelist.devices.get(radio.getAttribute("name"));
        device.save("trusted", parseInt(radio.value, 10));
    }
}

api.elements.define("converse-omemo-fingerprints", Fingerprints);
