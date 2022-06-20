/**
 * @description Converse.js plugin which adds XEP-0166 Jingle
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */

import { _converse, converse } from '@converse/headless/core';
import { __ } from 'i18n';
import { html } from "lit";

converse.plugins.add('jingle', {
    /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
    initialize: function () {
        _converse.api.listen.on('getToolbarButtons', (toolbar_el, buttons) => {
            if (!this.is_groupchat) {
                const color = '--chat-toolbar-btn-color';
                const i18n_start_call = __('Start a call');
                buttons.push(html`
                    <button class="toggle-call" @click=${this.toggleCall} title="${i18n_start_call}">
                        <converse-icon color="var(${color})" class="fa fa-phone" size="1em"></converse-icon>
                    </button>`
                );
            }

           return buttons;
        });
    },
});
