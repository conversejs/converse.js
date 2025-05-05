import { html } from 'lit';
import { api } from '@converse/headless';
import 'shared/components/font-awesome.js';

export default () => {
    const extra_classes = api.settings.get('singleton') ? ['converse-singleton'] : [];
    extra_classes.push(`converse-${api.settings.get('view_mode')}`);
    return html`
        ${api.settings.get('show_background') ? html`<converse-bg logo></converse-bg>` : ''}
        <converse-chats class="converse-chatboxes row justify-content-start g-0 ${extra_classes.join(' ')}"></converse-chats>
        <converse-modals id="converse-modals" class="modals"></converse-modals>
        <converse-toasts></converse-toasts>
        <converse-fontawesome></converse-fontawesome>
    `;
};
