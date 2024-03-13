/**
 * @module converse-chatboxviews
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import './view.js';
import '@converse/headless/plugins/chatboxes/index.js';
import ChatBoxViews from './container.js';
import { _converse, api, converse } from '@converse/headless';
import { calculateViewportHeightUnit } from './utils.js';

import './styles/chats.scss';


converse.plugins.add('converse-chatboxviews', {
    dependencies: ['converse-chatboxes', 'converse-vcard'],

    initialize () {
        api.promises.add(['chatBoxViewsInitialized']);

        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        api.settings.extend({ 'animate': true });

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
            insertInto (container) {
                const el = chatboxviews.el;
                if (el && !container.contains(el)) {
                    container.insertAdjacentElement('afterbegin', el);
                } else if (!el) {
                    throw new Error('Cannot insert non-existing #conversejs element into the DOM');
                }
            }
        });
    }
});
