import { Model } from '@converse/skeletor';
import { _converse, api, constants, u } from '@converse/headless';
import { __ } from 'i18n';
import { CustomElement } from 'shared/components/element.js';
import tplTodoProjects from './templates/lists.js';

const { initStorage } = u;

export default class TodoLists extends CustomElement {
    render() {
        const bare_jid = _converse.session.get('bare_jid');
        const id = `converse.todo-lists-${bare_jid}`;
        this.model = new Model({ id });
        initStorage(this.model, id);
        this.model.fetch();

        return tplTodoProjects(this);
    }

    /** @param {Event} [ev] */
    toggleList(ev) {
        ev?.preventDefault?.();
        const list_el = this.querySelector('.open-rooms-list');
        if (this.model.get('toggle_state') === constants.CLOSED) {
            u.slideOut(list_el).then(() => this.model.save({ toggle_state: constants.OPENED }));
        } else {
            u.slideIn(list_el).then(() => this.model.save({ toggle_state: constants.CLOSED }));
        }
    }

    getProjects() {
        return [];
    }
}

api.elements.define('converse-todo-lists', TodoLists);
