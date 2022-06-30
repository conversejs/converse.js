/**
 * @description Converse.js plugin which adds XEP-0166 Jingle
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */

import { _converse, converse } from '@converse/headless/core.js';
import 'plugins/modal/index.js';
import "./chat-header-notification.js";
import './toolbar-button.js';
import { JINGLE_CALL_STATUS } from './constants.js';
import { html } from "lit";


converse.plugins.add('converse-jingle', {
    /* Plugin dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin.
     *
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found. By default it's
     * false, which means these plugins are only loaded opportunistically.
     *
     * NB: These plugins need to have already been loaded via require.js.
     */
    dependencies: ['converse-chatview'],

    initialize: function () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        _converse.JINGLE_CALL_STATUS = JINGLE_CALL_STATUS;
        _converse.api.listen.on('getToolbarButtons', (toolbar_el, buttons) => {
            if (!this.is_groupchat) {
                buttons.push(html`
                  <converse-jingle-toolbar-button jid=${toolbar_el.model.get('jid')}>
                  </converse-jingle-toolbar-button>
                `);
            }

           return buttons;
        });
    },
});
