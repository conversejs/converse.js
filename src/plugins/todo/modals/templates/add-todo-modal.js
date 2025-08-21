import { _converse } from '@converse/headless';
import { html } from 'lit';
import { __ } from 'i18n';

/**
 * @param {import('../add-todo-modal.js').default} el
 */
export default (el) => {
    const i18n_create = __('Create');
    const label_name = __('Todo name');

    return html` <form
        class="converse-form add-chatroom needs-validation"
        @submit=${(ev) => el.createTodo(ev)}
        novalidate
    >
        <div class="mb-3">
            <label for="chatroom" class="form-label">${label_name}:</label>
            <div class="input-group">
                <input type="text" class="form-control" id="chatroom" placeholder="${label_name}" required />
            </div>
        </div>
        <input type="submit" class="btn btn-primary mt-3" value="${i18n_create || ''}" />
    </form>`;
};
