/**
 * @copyright 2022, the Converse.js contributors
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
import { _converse, api, converse, log } from '@converse/headless';
import { addControlBox, clearSession, disconnect, onChatBoxesFetched } from './utils.js';
import { CONTROLBOX_TYPE } from "@converse/headless/shared/constants.js";

import './styles/_controlbox.scss';
import './styles/controlbox-head.scss';


converse.plugins.add('converse-controlbox', {
    /* Plugin dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin.
     *
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found. By default it's
     * false, which means these plugins are only loaded opportunistically.
     */
    dependencies: ['converse-modal', 'converse-chatboxes', 'converse-chat', 'converse-rosterview', 'converse-chatview'],

    enabled (_converse) {
        return !_converse.api.settings.get('singleton');
    },

    initialize () {
        api.settings.extend({
            allow_logout: true,
            allow_user_trust_override: true,
            default_domain: undefined,
            locked_domain: undefined,
            show_connection_url_input: false,
            show_controlbox_by_default: false,
            sticky_controlbox: false
        });

        api.promises.add('controlBoxInitialized', false);
        Object.assign(api, controlbox_api);

        _converse.ControlBoxView = ControlBoxView;
        _converse.ControlBox = ControlBox;
        _converse.ControlBoxToggle = ControlBoxToggle;

        api.chatboxes.registry.add(CONTROLBOX_TYPE, ControlBox);

        api.listen.on('chatBoxesFetched', onChatBoxesFetched);
        api.listen.on('clearSession', clearSession);
        api.listen.on('will-reconnect', disconnect);

        api.waitUntil('chatBoxViewsInitialized')
            .then(addControlBox)
            .catch(e => log.fatal(e));
    }
});
