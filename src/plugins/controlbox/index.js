/**
 * @module converse-controlbox
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "../../components/brand-heading";
import "../chatview/index.js";
import ControlBoxMixin from './model.js';
import ControlBoxPane from './pane.js';
import ControlBoxToggle from './toggle.js';
import ControlBoxView from './view.js';
import log from '@converse/headless/log';
import { LoginPanelModel, LoginPanel } from './loginpanel.js';
import { _converse, api, converse } from '@converse/headless/core';
import { addControlBox } from './utils.js';
import controlbox_api from './api.js';

const u = converse.env.utils;


function disconnect () {
    /* Upon disconnection, set connected to `false`, so that if
     * we reconnect, "onConnected" will be called,
     * to fetch the roster again and to send out a presence stanza.
     */
    const view = _converse.chatboxviews.get('controlbox');
    view.model.set({ 'connected': false });
    return view;
}

function clearSession () {
    const chatboxviews = _converse?.chatboxviews;
    const view = chatboxviews && chatboxviews.get('controlbox');
    if (view) {
        u.safeSave(view.model, { 'connected': false });
        if (view?.controlbox_pane) {
            view.controlbox_pane.remove();
            delete view.controlbox_pane;
        }
    }
}

function onChatBoxesFetched () {
    const controlbox = _converse.chatboxes.get('controlbox') || addControlBox();
    controlbox.save({ 'connected': true });
}

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
                const { _converse } = this.__super__;
                if (attrs && attrs.id == 'controlbox') {
                    return new _converse.ControlBox(attrs, options);
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
        _converse.ControlBox = _converse.ChatBox.extend(ControlBoxMixin);
        _converse.LoginPanelModel = LoginPanelModel;
        _converse.LoginPanel = LoginPanel;
        _converse.ControlBoxPane = ControlBoxPane;
        _converse.ControlBoxToggle = ControlBoxToggle;

        /******************** Event Handlers ********************/
        api.listen.on('chatBoxesFetched', onChatBoxesFetched);
        api.listen.on('cleanup', () => delete _converse.controlboxtoggle);
        api.listen.on('clearSession', clearSession);
        api.listen.on('disconnected', () => disconnect().renderLoginPanel());
        api.listen.on('will-reconnect', disconnect);

        api.waitUntil('chatBoxViewsInitialized')
            .then(addControlBox)
            .catch(e => log.fatal(e));
    }
});
