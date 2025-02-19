import { _converse, api, log } from "@converse/headless";
import "shared/autocomplete/index.js";
import BaseModal from "plugins/modal/modal.js";
import tplAcceptContactRequest from "./templates/accept-contact-request.js";
import { __ } from "i18n";

export default class AcceptContactRequest extends BaseModal {

    /**
     * @param {Object} options
     */
    constructor(options) {
        super(options);
        this.contact = null;
    }

    initialize() {
        super.initialize();
        this.listenTo(this.model, "change", () => this.requestUpdate());
        this.listenTo(this.contact, "change", () => this.requestUpdate());
        this.requestUpdate();
        this.addEventListener(
            "shown.bs.modal",
            () => /** @type {HTMLInputElement} */ (this.querySelector('input[name="name"]'))?.focus(),
            false
        );
    }

    renderModal() {
        return tplAcceptContactRequest(this);
    }

    getModalTitle() {
        return __("Contact Request");
    }

    /**
     * @param {Event} ev
     */
    async acceptContactRequest(ev) {
        ev.preventDefault();
        const form = /** @type {HTMLFormElement} */ (ev.target);
        const data = new FormData(form);
        const name = /** @type {string} */ (data.get("name") || "").trim();
        const group = data.get('group');
        try {
            await _converse.state.roster.sendContactAddIQ({
                jid: this.contact.get("jid"),
                name,
                group,
            });
            this.contact.authorize().subscribe();
        } catch (e) {
            log.error(e);
            this.model.set("error", __("Sorry, something went wrong"));
            return;
        }
        this.contact.save({ groups: [group] });
        this.modal.hide();
    }
}

api.elements.define("converse-accept-contact-request-modal", AcceptContactRequest);
