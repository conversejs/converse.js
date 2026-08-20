import { html } from 'lit';
import { api } from '@converse/headless';
import 'shared/components/font-awesome.js';

export default () => {
    return html`
        ${api.settings.get('show_background') ? html`<converse-bg logo></converse-bg>` : ''}
        <converse-app-container></converse-app-container>
        <converse-modals id="converse-modals" class="modals"></converse-modals>
        <converse-toasts></converse-toasts>
        <converse-fontawesome></converse-fontawesome>
    `;
};
