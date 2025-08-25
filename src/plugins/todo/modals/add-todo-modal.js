import { _converse, api } from '@converse/headless';
import BaseModal from 'plugins/modal/modal.js';
import tplAddTodo from './templates/add-todo-modal.js';
import { __ } from 'i18n';

export default class AddTodoModal extends BaseModal {
    initialize() {
        super.initialize();
        this.requestUpdate();
        this.addEventListener(
            'shown.bs.modal',
            () => {
                /** @type {HTMLInputElement} */ (this.querySelector('input[name="name"]'))?.focus();
            },
            false
        );
    }

    renderModal() {
        return tplAddTodo(this);
    }

    getModalTitle() {
        return __('Create a new todo list');
    }

    /**
     * @param {Event} ev
     */
    async createTodo(ev) {
        ev.preventDefault();

        const form = /** @type {HTMLFormElement} */ (ev.target);
        const data = new FormData(form);
        const name = data.get('name');
        const jid = data.get('jid');

        api.pubsub.nodes.create(jid, name);
        form.reset();
        this.modal.hide();
    }
}

api.elements.define('converse-add-todo-modal', AddTodoModal);
