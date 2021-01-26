/**
 * @module converse-muc-views
 * @copyright 2020, the Converse.js contributors
 * @description XEP-0045 Multi-User Chat Views
 * @license Mozilla Public License (MPLv2)
 */
import '../../components/muc-sidebar';
import '../chatview/index.js';
import '../modal.js';
import MUCView from './muc.js';
import MUCConfigForm from './config-form.js';
import MUCPasswordForm from './password-form.js';
import log from '@converse/headless/log';
import muc_api from './api.js';
import { RoomsPanel, RoomsPanelViewMixin } from './rooms-panel.js';
import { api, converse, _converse } from '@converse/headless/core';

const { Strophe } = converse.env;

function setMUCDomain (domain, controlboxview) {
    controlboxview.getRoomsPanel().model.save('muc_domain', Strophe.getDomainFromJid(domain));
}

function setMUCDomainFromDisco (controlboxview) {
    /* Check whether service discovery for the user's domain
     * returned MUC information and use that to automatically
     * set the MUC domain in the "Add groupchat" modal.
     */
    function featureAdded (feature) {
        if (!feature) {
            return;
        }
        if (feature.get('var') === Strophe.NS.MUC) {
            feature.entity.getIdentity('conference', 'text').then(identity => {
                if (identity) {
                    setMUCDomain(feature.get('from'), controlboxview);
                }
            });
        }
    }
    api.waitUntil('discoInitialized')
        .then(() => {
            api.listen.on('serviceDiscovered', featureAdded);
            // Features could have been added before the controlbox was
            // initialized. We're only interested in MUC
            _converse.disco_entities.each(entity => featureAdded(entity.features.findWhere({ 'var': Strophe.NS.MUC })));
        })
        .catch(e => log.error(e));
}

function fetchAndSetMUCDomain (controlboxview) {
    if (controlboxview.model.get('connected')) {
        if (!controlboxview.getRoomsPanel().model.get('muc_domain')) {
            if (api.settings.get('muc_domain') === undefined) {
                setMUCDomainFromDisco(controlboxview);
            } else {
                setMUCDomain(api.settings.get('muc_domain'), controlboxview);
            }
        }
    }
}

// function openChatRoomFromURIClicked (ev) {
//     ev.preventDefault();
//     api.rooms.open(ev.target.href);
// }

converse.plugins.add('converse-muc-views', {
    /* Dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin. They are "optional" because they might not be
     * available, in which case any overrides applicable to them will be
     * ignored.
     *
     * NB: These plugins need to have already been loaded via require.js.
     *
     * It's possible to make these dependencies "non-optional".
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found.
     */
    dependencies: ['converse-modal', 'converse-controlbox', 'converse-chatview'],

    overrides: {
        ControlBoxView: {
            renderControlBoxPane () {
                this.__super__.renderControlBoxPane.apply(this, arguments);
                if (api.settings.get('allow_muc')) {
                    this.renderRoomsPanel();
                }
            }
        }
    },

    initialize () {
        const { _converse } = this;

        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        api.settings.extend({
            'auto_list_rooms': false,
            'cache_muc_messages': true,
            'locked_muc_nickname': false,
            'modtools_disable_query': [],
            'modtools_disable_assign': false,
            'muc_disable_slash_commands': false,
            'muc_mention_autocomplete_filter': 'contains',
            'muc_mention_autocomplete_min_chars': 0,
            'muc_mention_autocomplete_show_avatar': true,
            'muc_roomid_policy': null,
            'muc_roomid_policy_hint': null,
            'roomconfig_whitelist': [],
            'show_retraction_warning': true,
            'visible_toolbar_buttons': {
                'toggle_occupants': true
            }
        });

        _converse.MUCConfigForm = MUCConfigForm;
        _converse.MUCPasswordForm = MUCPasswordForm;
        _converse.ChatRoomView = MUCView;
        _converse.RoomsPanel = RoomsPanel;
        _converse.ControlBoxView && Object.assign(_converse.ControlBoxView.prototype, RoomsPanelViewMixin);

        Object.assign(_converse.api, muc_api);

        /************************ BEGIN Event Handlers ************************/
        api.listen.on('chatBoxViewsInitialized', () => {
            // FIXME: Find a new way to implement this
            // _converse.chatboxviews.delegate('click', 'a.open-chatroom', openChatRoomFromURIClicked);

            // TODO: Remove
            // _converse.chatboxes.on('add', addView);
        });

        api.listen.on('clearSession', () => {
            const view = _converse.chatboxviews.get('controlbox');
            if (view && view.roomspanel) {
                view.roomspanel.model.destroy();
                view.roomspanel.remove();
                delete view.roomspanel;
            }
        });

        api.listen.on('controlBoxInitialized', view => {
            if (!api.settings.get('allow_muc')) {
                return;
            }
            fetchAndSetMUCDomain(view);
            view.model.on('change:connected', () => fetchAndSetMUCDomain(view));
        });
        /************************ END Event Handlers ************************/
    }
});
