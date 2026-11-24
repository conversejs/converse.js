import { converse, api, _converse } from '@converse/headless';
import { registerRestrictedReactionsHandler } from './utils.js';

import { html } from 'lit';
import { __ } from 'i18n';

const { Strophe } = converse.env;

converse.plugins.add('converse-reaction-views', {
    dependencies: ['converse-reactions', 'converse-disco', 'converse-chatview', 'converse-muc-views'],

    /**
     * Initializes the reactions UI plugin
     * Sets up event listeners for:
     * - Adding reaction buttons to messages
     * - Handling reaction picker interactions
     * - Disco feature advertisement and restrictions
     */
    initialize() {
        api.listen.on('addClientFeatures', () => {
            api.disco.own.features.add(Strophe.NS.REACTIONS);
        });

        api.listen.on('connected', () => registerRestrictedReactionsHandler());
        api.listen.on('reconnected', () => registerRestrictedReactionsHandler());

        api.listen.on('getMessageActionButtons', (el, buttons) => {
            buttons.unshift({
                'i18n_text': __('Add Reaction'),
                'handler': (ev) => {
                    const picker = el.querySelector('converse-reaction-picker');
                    picker.open(ev);
                },
                'button_class': 'chat-msg__action-reaction',
                'icon_class': 'fas fa-smile',
                'name': 'reaction',
            });

            return buttons;
        });

        api.listen.on('getMessageActionContent', (el, content) => {
            return html`${content}<converse-reaction-picker .model=${el.model}></converse-reaction-picker>`;
        });
    },
});
