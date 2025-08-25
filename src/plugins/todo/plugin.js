import { html } from 'lit';
import { _converse, api, converse } from '@converse/headless';

converse.plugins.add('converse-app-todo', {
    initialize() {
        api.apps.add({
            name: 'todo',
            render: () => {
                const extra_classes = api.settings.get('singleton') ? ['converse-singleton'] : [];
                extra_classes.push(`converse-${api.settings.get('view_mode')}`);
                return html`<converse-app-todo
                    class="converse-chatboxes row justify-content-start g-0 ${extra_classes.join(' ')}"
                ></converse-app-todo>`;
            },
            renderControlbox: () => {
                return html`<converse-todo-lists></converse-todo-lists>`;
            },
            active: false,
        });
    },
});
