/**
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "shared/components/brand-heading.js";
import "../chatview/index.js";
import './loginform.js';
import './navback.js';
import ControlBox from './model.js';
import ControlBoxToggle from './toggle.js';
import ControlBoxView from './controlbox.js';
import controlbox_api from './api.js';
import log from '@converse/headless/log';
import { _converse, api, converse } from '@converse/headless/core';
import { addControlBox, clearSession, disconnect, onChatBoxesFetched } from './utils.js';

import './styles/_controlbox.scss';


converse.plugins.add('converse-controlbox', {
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
    dependencies: ['converse-modal', 'converse-chatboxes', 'converse-chat', 'converse-rosterview', 'converse-chatview'],

    enabled (_converse) {
        return !_converse.api.settings.get('singleton');
    },

    overrides: {
        // Overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        //
        // New functions which don't exist yet can also be added.

        ChatBoxes: {
            model (attrs, options) {
                if (attrs && attrs.id == 'controlbox') {
                    return new ControlBox(attrs, options);
                } else {
                    return this.__super__.model.apply(this, arguments);
                }
            }
        }
    },

    initialize () {
        api.settings.extend({
            allow_logout: true,
            allow_user_trust_override: true,
            default_domain: undefined,
            locked_domain: undefined,
            show_controlbox_by_default: false,
            sticky_controlbox: false
        });

        api.promises.add('controlBoxInitialized');
        Object.assign(api, controlbox_api);

        _converse.ControlBoxView = ControlBoxView;
        _converse.ControlBox = ControlBox;
        _converse.ControlBoxToggle = ControlBoxToggle;

        api.listen.on('chatBoxesFetched', onChatBoxesFetched);
        api.listen.on('clearSession', clearSession);
        api.listen.on('will-reconnect', disconnect);

        api.waitUntil('chatBoxViewsInitialized')
            .then(addControlBox)
            .catch(e => log.fatal(e));
    }
});
