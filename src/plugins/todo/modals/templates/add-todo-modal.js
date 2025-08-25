import { _converse } from '@converse/headless';
import { html } from 'lit';
import { __ } from 'i18n';

/**
 * @param {import('../add-todo-modal.js').default} el
 */
export default (el) => {
    const i18n_create = __('Create');
    const label_name = __('Todo name');
    const label_service = __('PubSub service (XMPP Address) for your todo list');

    const pubsub_services = el.state.get('services') ?? [];

    return html`<form class="converse-form" @submit=${(ev) => el.createTodo(ev)}>
        <div class="mb-3">
            <label for="todo-name" class="form-label">${label_name}:</label>
            <input type="text" id="todo-name" name="name" class="form-control" placeholder="${label_name}" required />
        </div>

        ${el.state.get('manual_jid')
            ? html`<div class="mb-3">
                  ${pubsub_services.length > 1
                      ? html`${__('Available PubSub services')}
                            <ul class="list-group">
                                ${(pubsub_services ?? []).map((jid) => html`<li class="list-group-item">${jid}</li>`)}
                            </ul>`
                      : ''}

                  <label for="todo-jid" class="form-label">${label_service}:</label>
                  <input
                      type="text"
                      id="todo-jid"
                      name="jid"
                      class="form-control"
                      required
                  />
              </div>`
            : ''}

        <input type="submit" class="btn btn-primary mt-3" value="${i18n_create || ''}" />
    </form>`;
};
