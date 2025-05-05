import { Strophe } from "strophe.js";
import { _converse, api, log } from "@converse/headless";
import BaseModal from "plugins/modal/modal.js";
import tplAddContactModal from "./templates/add-contact.js";
import { __ } from "i18n";

import './styles/add-contact.scss';

export default class AddContactModal extends BaseModal {
    initialize() {
        super.initialize();
        this.listenTo(this.model, "change", () => this.requestUpdate());
        this.requestUpdate();
        this.addEventListener(
            "shown.bs.modal",
            () => /** @type {HTMLInputElement} */ (this.querySelector('input[name="jid"]'))?.focus(),
            false
        );
    }

    renderModal() {
        return tplAddContactModal(this);
    }

    getModalTitle() {
        return __("Add a Contact");
    }

    /**
     * @param {string} jid
     */
    validateSubmission(jid) {
        if (!jid || jid.split("@").filter((s) => !!s).length < 2) {
            this.model.set("error", __("Please enter a valid XMPP address"));
            return false;
        } else if (_converse.state.roster.get(Strophe.getBareJidFromJid(jid))) {
            this.model.set("error", __("This contact has already been added"));
            return false;
        }
        this.model.set("error", null);
        return true;
    }

    /**
     * @param {HTMLFormElement} form
     * @param {string} jid
     * @param {string} name
     * @param {string[]} groups
     */
    async afterSubmission(form, jid, name, groups) {
        try {
            await api.contacts.add({ jid, name, groups });
        } catch (e) {
            log.error(e);
            this.model.set("error", __("Sorry, something went wrong"));
            return;
        }
        api.chats.open(jid, {}, true);
        form.reset();
        this.model.clear();
        this.modal.hide();
    }

    /**
     * @param {Event} ev
     */
    async addContactFromForm(ev) {
        ev.preventDefault();
        const form = /** @type {HTMLFormElement} */ (ev.target);
        const data = new FormData(form);
        let jid = /** @type {string} */ (data.get("jid") || "").trim();

        let name;
        if (api.settings.get("xhr_user_search_url")) {
            // In this case, the value of `jid` is something like `John Doe <john@chat.com>`
            // So we want to get `name` which is `John Doe` and reset `jid` to
            // what's inside the arrow brackets, so in this case
            // `john@chat.com`.
            const match = jid.match(/^(.*) <(.*)>$/);
            if (match) {
                name = match[1].trim();
                jid = match[2].trim();
            } else {
                this.model.set(
                    "error",
                    __(
                        'Invalid value for the name and XMPP address. Please use the format "Name <username@example.org>".'
                    )
                );
                return;
            }
        } else {
            name = /** @type {string} */ (data.get("name") || "").trim();
        }

        if (this.validateSubmission(jid)) {
            const groups =
                /** @type {string} */ (data.get("groups"))
                    ?.split(",")
                    .map((g) => g.trim())
                    .filter((g) => g) || [];
            this.afterSubmission(form, jid, name, groups);
        }
    }
}

api.elements.define("converse-add-contact-modal", AddContactModal);
