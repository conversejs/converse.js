import { html } from 'lit';
import { api } from '@converse/headless';

export default () => {
    return html`
        <converse-app-switcher></converse-app-switcher>
        ${api.apps.getActive().render()}
    `;
};
