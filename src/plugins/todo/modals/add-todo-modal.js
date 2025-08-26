import { default as Collapse } from 'bootstrap/js/src/collapse.js';
import { _converse, api, converse, parsers, u } from '@converse/headless';
import BaseModal from 'plugins/modal/modal.js';
import { __ } from 'i18n';
import tplAddTodo from './templates/add-todo-modal.js';

const { Strophe } = converse.env;

export default class AddTodoModal extends BaseModal {
    static get properties() {
        return {
            ...super.properties,
            _manual_jid: { state: true, type: Boolean },
            _entities: { state: true, type: Array },
        };
    }

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

    /**
     * @param {import('lit').PropertyValues} changed
     */
    firstUpdated(changed) {
        super.firstUpdated(changed);
        this.collapse = new Collapse(/** @type {HTMLElement} */ (this));
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

        const entities = await api.disco.entities.find(Strophe.NS.PUBSUB, jid);
        if (entities.length === 0) {
            this.alert(__('Could not find a PubSub service to host your todo list'), 'danger');
            this._manual_jid = true;
            return;
        } else if (entities.length > 1) {
            this.alert(__('Found multiple possible PubSub services to host your todo list, please choose one.'));

            this._entities = entities;
            this._manual_jid = true;
            return;
        }

        try {
            await api.pubsub.create(entities[0].get('jid'), `${Strophe.NS.TODO}/${u.getUniqueId()}`, { title: name });
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
