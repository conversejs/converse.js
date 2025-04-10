import { getOpenPromise } from '@converse/openpromise';
import { api, constants } from '@converse/headless';
import BaseModal from 'plugins/modal/modal.js';
import tplPrompt from './templates/prompt.js';

export default class Confirm extends BaseModal {
    constructor(options) {
        super(options);
        this.confirmation = getOpenPromise();
    }

    initialize() {
        super.initialize();
        this.listenTo(this.model, 'change', () => this.requestUpdate());
        this.addEventListener(
            'hide.bs.modal',
            () => {
                if (!this.confirmation.isResolved) {
                    this.confirmation.reject();
                }
            },
            false
        );

        this.onKeyDown = /** @param {KeyboardEvent} ev */ (ev) => {
            if (ev.key === constants.KEYCODES.ESCAPE) {
                ev.preventDefault();
                ev.stopPropagation();
                /** @type {HTMLFormElement} */(this.querySelector('form.confirm')).submit();
            }
        };
    }

    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('keydown', this.onKeyDown);
    }

    disconnectedCallback() {
        this.removeEventListener('keydown', this.onKeyDown);
        super.disconnectedCallback();
    }

    renderModal() {
        return tplPrompt(this);
    }

    getModalTitle() {
        return this.model.get('title');
    }

    renderModalFooter() {
        return '';
    }

    /**
     * @param {SubmitEvent} ev
     */
    onConfimation(ev) {
        ev.preventDefault();
        const form = /** @type {HTMLFormElement} */ (ev.target);
        const form_data = new FormData(form);
        const fields = (this.model.get('fields') || []).map(
            /** @param {import('./types.js').Field} field */ (field) => {
                const value = form_data.get(field.name);
                field.value = /** @type {string} */ (value);
                if (field.challenge) {
                    field.challenge_failed = value !== field.challenge;
                }
                return field;
            }
        );

        if (fields.filter((c) => c.challenge_failed).length) {
            this.model.set('fields', fields);
            // Setting an array doesn't trigger a change event
            this.model.trigger('change');
            return;
        }
        this.confirmation.resolve(fields);
        this.modal.hide();
    }
}

api.elements.define('converse-confirm-modal', Confirm);
