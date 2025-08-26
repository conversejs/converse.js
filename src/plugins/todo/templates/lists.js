import { html } from 'lit';
import { api, constants } from '@converse/headless';
import '../modals/add-todo-modal.js';
import { __ } from 'i18n';

/**
 * @param {import('../lists.js').default} el
 */
export default (el) => {
    const projects = el.getProjects();
    const i18n_desc_rooms = __('Click to toggle the list of todo lists');
    const i18n_heading_projects = __('TODO LISTS');
    const i18n_title_new_todo = __('Add new todo list');
    const is_closed = el.model.get('toggle_state') === constants.CLOSED;

    const btns = [
        html`<a
            class="dropdown-item show-add-todo-modal"
            role="button"
            @click="${(ev) => api.modal.show('converse-add-todo-modal', { 'model': el.model }, ev)}"
            data-toggle="modal"
            data-target="#add-todo-modal"
        >
            <converse-icon class="fa fa-plus" size="1em"></converse-icon>
            ${i18n_title_new_todo}
        </a>`,
    ];

    return html`<div class="d-flex controlbox-padded">
            <span class="w-100 controlbox-heading controlbox-heading--groupchats">
                <a
                    class="list-toggle open-rooms-toggle"
                    role="heading"
                    aria-level="3"
                    title="${i18n_desc_rooms}"
                    @click=${(ev) => el.toggleList(ev)}
                >
                    ${i18n_heading_projects}
                    ${projects.length
                        ? html`<converse-icon
                              class="fa ${is_closed ? 'fa-caret-right' : 'fa-caret-down'}"
                              size="1em"
                              color="var(--muc-color)"
                          ></converse-icon>`
                        : ''}
                </a>
            </span>
            <converse-dropdown class="btn-group dropstart" .items=${btns}></converse-dropdown>
        </div>

        <div class="list-container list-container--openrooms ${projects.length ? '' : 'hidden'}">
            <ul class="items-list rooms-list open-rooms-list ${is_closed ? 'collapsed' : ''}">
                ${projects.map(() => html`<p>Here comes a project</p>`)}
            </ul>
        </div>`;
};
