import { _converse, api, converse, parsers } from '@converse/headless';
import BaseModal from 'plugins/modal/modal.js';
import tplAddTodo from './templates/add-todo-modal.js';
import { __ } from 'i18n';

const { Strophe } = converse.env;

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
        const jid = data.get('jid') ?? _converse.state.session.get('domain');

        const service_jids = await api.disco.entities.find(Strophe.NS.PUBSUB, jid);
        if (service_jids.length === 0) {
            this.alert(__('Could not find a PubSub service to host your todo list'), 'danger');
            this.state.set({ manual_jid: true });
            return;
        } else if (service_jids.length > 1) {
            this.alert(__('Found multiple possible PubSub services to host your todo list, please choose one.'));
            this.state.set({ services: service_jids, manual_jid: true });
            return;
        }

        try {
            await api.pubsub.create(service_jids[0].get('jid'), name);
        } catch (e) {
            const err = await parsers.parseErrorStanza(e);
            this.alert(__('Sorry, an error occurred: %s', err.message), 'danger');
            return;
        }
        form.reset();
        this.modal.hide();
    }
}

api.elements.define('converse-add-todo-modal', AddTodoModal);
