import { api } from '@converse/headless';
import { html, nothing } from 'lit';

/**
 * @param {import('../app-switcher').default} el
 */
export default (el) => {
    const active_app = api.apps.getActive().name;
    return html`
        <ul class="nav nav-pills nav-flush flex-column mb-auto text-center">
            ${api.apps.get().map((app) => {
                const is_active = app.name === active_app;
                return html`
                    <li class="nav-item" title="${app.title}" aria-label="${app.title}">
                        <a
                            href="#"
                            class="${is_active ? 'active' : ''} nav-link py-3 border-bottom"
                            data-app-name="${app.name}"
                            aria-current="${is_active ? 'page' : nothing}"
                            @click="${el.switchApp}"
                        >
                            <converse-icon size="1em" class="fa ${app.icon}"></converse-icon>
                        </a>
                    </li>
                `;
            })}
        </ul>
    `;
};
