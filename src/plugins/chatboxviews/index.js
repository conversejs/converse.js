/**
 * @copyright 2024, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { html } from 'lit';
import { _converse, api, converse } from '@converse/headless';
import './view.js';
import ChatBoxViews from './container.js';
import { calculateViewportHeightUnit } from './utils.js';
import '../rootview/index.js';

import './styles/chats.scss';

converse.plugins.add('converse-chatboxviews', {
    dependencies: ['converse-rootview', 'converse-chatboxes', 'converse-vcard'],

    initialize() {
        api.promises.add(['chatBoxViewsInitialized']);

        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        api.settings.extend({ animate: true });

        api.apps.add({
            name: 'chat',
            render: () => {
                const extra_classes = api.settings.get('singleton') ? ['converse-singleton'] : [];
                extra_classes.push(`converse-${api.settings.get('view_mode')}`);
                return html`<converse-chats
                    class="converse-chatboxes row justify-content-start g-0 ${extra_classes.join(' ')}"
                ></converse-chats>`;
            },
            active: true,
        });

        // TODO: move to own plugin
        api.apps.add({
            name: 'todo',
            render: () => {
                return html`<p>hello world: todo</p>`;
            },
            active: false,
        });

        // TODO: move to own plugin
        api.apps.add({
            name: 'timetracker',
            render: () => {
                return html`<p>hello world: timetracker</p>`;
            },
            active: false,
        });

        const chatboxviews = new ChatBoxViews();
        Object.assign(_converse, { chatboxviews }); // XXX DEPRECATED
        Object.assign(_converse.state, { chatboxviews });

        /************************ BEGIN Event Handlers ************************/
        api.listen.on('chatBoxesInitialized', () => {
            _converse.state.chatboxes.on('destroy', (m) => chatboxviews.remove(m.get('jid')));
        });

        api.listen.on('cleanup', () => Object.assign(_converse, { chatboxviews: null })); // DEPRECATED
        api.listen.on('cleanup', () => delete _converse.state.chatboxviews);
        api.listen.on('clearSession', () => chatboxviews.closeAllChatBoxes());
        api.listen.on('chatBoxViewsInitialized', calculateViewportHeightUnit);

        window.addEventListener('resize', calculateViewportHeightUnit);
        /************************ END Event Handlers ************************/

        Object.assign(converse, {
            /**
             * Public API method which will ensure that the #conversejs element
             * is inserted into a container element.
             *
             * This method is useful when the #conversejs element has been
             * detached from the DOM somehow.
             * @async
             * @memberOf converse
             * @method insertInto
             * @param {HTMLElement} container
             * @example
             * converse.insertInto(document.querySelector('#converse-container'));
             */
            insertInto(container) {
                const el = chatboxviews.el;
                if (el && !container.contains(el)) {
                    container.insertAdjacentElement('afterbegin', el);
                } else if (!el) {
                    throw new Error('Cannot insert non-existing #conversejs element into the DOM');
                }
            },
        });
    },
});
