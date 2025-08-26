export default class AddTodoModal extends BaseModal {
    static get properties(): {
        _manual_jid: {
            state: boolean;
            type: BooleanConstructor;
        };
        _entities: {
            state: boolean;
            type: ArrayConstructor;
        };
        model: {
            type: typeof import("@converse/headless").Model;
        };
    };
    collapse: any;
    renderModal(): import("lit-html").TemplateResult<1>;
    getModalTitle(): any;
    /**
     * @param {Event} ev
     */
    createTodo(ev: Event): Promise<void>;
    _manual_jid: boolean;
    _entities: any;
}
import BaseModal from 'plugins/modal/modal.js';
//# sourceMappingURL=add-todo-modal.d.ts.map