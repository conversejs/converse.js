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

    return html`<form class="converse-form" @submit=${(ev) => el.createTodo(ev)}>
        <div class="mb-3">
            <label for="todo-name" class="form-label">${label_name}:</label>
            <input type="text" id="todo-name" name="name" class="form-control" placeholder="${label_name}" required />
        </div>

        ${el._manual_jid
            ? html` ${(el._entities?.length ?? 0) > 1
                  ? html`<div class="mb-3">
                        <label class="form-label">${__('Available PubSub services:')}</label>
                        <div class="list-group">
                            ${el._entities.map(
                                /** @param {import('@converse/headless').DiscoEntity} entity */ (entity) => {
                                    const jid = entity.get('jid');
                                    const features = entity.features
                                        .map((f) => f.get('var'))
                                        .filter((f) => f.includes('pubsub'));
                                    return html`<div class="form-check">
                                        <input
                                            class="form-check-input"
                                            type="radio"
                                            name="jid"
                                            id="${jid}"
                                            value="${jid}"
                                        />
                                        <label class="form-check-label fw-bold" for="${jid}">${jid}</label>
                                        <button
                                            class="btn btn-link p-0"
                                            type="button"
                                            data-bs-toggle="collapse"
                                            data-bs-target="#collapse-${jid}"
                                            aria-expanded="false"
                                            aria-controls="collapse-${jid}"
                                        >
                                            ${__('Show Features')}
                                        </button>
                                        <div class="collapse" id="collapse-${jid}">
                                            <div class="card card-body">
                                                <ul class="list-unstyled mt-2 text-muted small">
                                                    ${features.map((feature) => html`<li>${feature}</li>`)}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>`;
                                }
                            )}
                        </div>
                    </div>`
                  : html`<div class="mb-3">
                        <label for="todo-jid" class="form-label">${label_service}:</label>
                        <input type="text" id="todo-jid" name="jid" class="form-control" required />
                    </div>`}`
            : ''}

        <input type="submit" class="btn btn-primary mt-3" value="${i18n_create || ''}" />
    </form>`;
};
