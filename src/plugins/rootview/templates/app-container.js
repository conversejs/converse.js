import { html } from 'lit';
import { api } from '@converse/headless';

export default () => {
    return html`
        ${api.connection.get().connected ? html`<converse-app-switcher></converse-app-switcher>` : ''}
        ${api.apps.getActive().render()}
    `;
};
