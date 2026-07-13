/**
 * @copyright 2026, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { html } from 'lit';
import { api, converse } from '@converse/headless';
import { addHashtagAnnotations } from './texture.js';
import { requestOpenPost } from './view.js';
import '../rootview/index.js';
import './modals/discover.js';

converse.plugins.add('converse-app-social', {
    dependencies: ['converse-rootview', 'converse-microblog'],

    initialize() {
        api.listen.on('afterMessageBodyTransformed', addHashtagAnnotations);

        // A desktop-notification click for a comment on one of our posts asks the
        // Social app to open that post's thread (see the notifications plugin).
        api.listen.on('openMicroblogPost', requestOpenPost);

        // Registers a second top-level app (alongside "chat") in the app
        // switcher: the XEP-0277 (Microblogging over XMPP) "Social" feed.
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
