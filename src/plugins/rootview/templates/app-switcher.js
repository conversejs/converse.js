import { api } from '@converse/headless';
import { html } from 'lit';

/**
 * @param {import('../app-switcher').default} el
 */
export default (el) => {
    const { name: active_app } = api.apps.getActive();
    return html`
        <ul class="nav nav-pills nav-flush flex-column mb-auto text-center">
            <li class="nav-item" title="Chat" aria-label="Chat">
                <a
                    href="#"
                    class="${active_app === 'chat' ? 'active' : ''} nav-link py-3 border-bottom"
                    data-app-name="chat"
                    aria-current="page"
                    @click="${el.switchApp}"
                >
                    <converse-icon size="1em" class="fa fa-users"></converse-icon>
                </a>
            </li>
            <li title="TODO" aria-label="TODO">
                <a
                    href="#"
                    class="${active_app === 'todo' ? 'active' : ''} nav-link py-3 border-bottom"
                    data-app-name="todo"
                    @click="${el.switchApp}"
                >
                    <converse-icon size="1em" class="fa fa-list-ul"></converse-icon>
                </a>
            </li>
            <li title="Time Tracker" aria-label="Time Tracker">
                <a
                    href="#"
                    class="${active_app === 'timetracker' ? 'active' : ''} nav-link py-3 border-bottom"
                    data-app-name="timetracker"
                    @click="${el.switchApp}"
                >
                    <converse-icon size="1em" class="fa fa-lock"></converse-icon>
                </a>
            </li>
        </ul>
    `;
};
