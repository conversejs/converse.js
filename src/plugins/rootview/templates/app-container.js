import { html } from 'lit';
import { api } from '@converse/headless';

export default () => {
    const show_switcher =
        api.settings.get('view_mode') === 'fullscreen' &&
        api.connection.get()?.connected &&
        api.apps.get().length > 1;
    return html`
        ${show_switcher ? html`<converse-app-switcher></converse-app-switcher>` : ''}
        ${api.apps.getActive().render()}
    `;
};
