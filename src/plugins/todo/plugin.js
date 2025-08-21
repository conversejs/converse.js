import { html } from 'lit';
import { _converse, api, converse } from '@converse/headless';

converse.plugins.add('converse-app-todo', {
    initialize() {
        api.apps.add({
            name: 'todo',
            render: () => {
                return html`<converse-app-todo></converse-app-todo>`;
            },
            renderControlbox: () => {
                return html`<converse-todo-lists></converse-todo-lists>`;
            },
            active: false,
        });
    },
});
