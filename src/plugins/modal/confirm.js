import BaseModal from "plugins/modal/modal.js";
import tplPrompt from "./templates/prompt.js";
import { getOpenPromise } from '@converse/openpromise';
import { api } from "@converse/headless";

export default class Confirm extends BaseModal {

    constructor (options) {
        super(options);
        this.confirmation = getOpenPromise();
    }

    initialize () {
        super.initialize();
        this.listenTo(this.model, 'change', () => this.render())
        this.addEventListener('hide.bs.modal', () => {
            if (!this.confirmation.isResolved) {
                this.confirmation.reject()
            }
        }, false);
    }

    renderModal () {
        return tplPrompt(this);
    }

    getModalTitle () {
        return this.model.get('title');
    }

    onConfimation (ev) {
        ev.preventDefault();
        const form_data = new FormData(ev.target);
        const fields = (this.model.get('fields') || [])
            .map(field => {
                const value = /** @type {string }*/(form_data.get(field.name)).trim();
                field.value = value;
                if (field.challenge) {
                    field.challenge_failed = (value !== field.challenge);
                }
                return field;
            });

        if (fields.filter(c => c.challenge_failed).length) {
            this.model.set('fields', fields);
            // Setting an array doesn't trigger a change event
            this.model.trigger('change');
            return;
        }
        this.confirmation.resolve(fields);
        this.modal.hide();
    }

    renderModalFooter () {
        return '';
    }
}

api.elements.define('converse-confirm-modal', Confirm);
