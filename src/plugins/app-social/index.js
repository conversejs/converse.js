/**
 * @copyright 2026, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { html } from 'lit';
import { api, converse } from '@converse/headless';
import './view.js';
import '../rootview/index.js';

converse.plugins.add('converse-app-social', {
    dependencies: ['converse-rootview'],

    initialize() {
        // Registers a second top-level app (alongside "chat") so the app
        // switcher has something to switch to. This is a placeholder for the
        // upcoming XEP-0277 (Microblogging over XMPP) work.
        api.apps.add({
            name: 'social',
            title: 'Social',
            icon: 'fa-users',
            render: () => {
                const extra_classes = api.settings.get('singleton') ? ['converse-singleton'] : [];
                extra_classes.push(`converse-${api.settings.get('view_mode')}`);
                return html`<converse-app-social
                    class="converse-app ${extra_classes.join(' ')}"
                ></converse-app-social>`;
            },
        });
    },
});
