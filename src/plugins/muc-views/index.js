/**
 * @copyright The Converse.js developers
 * @description XEP-0045 Multi-User Chat Views
 * @license Mozilla Public License (MPLv2)
 */
import '../chatboxviews/index.js';
import 'plugins/modal/index.js';
import './adhoc-commands.js';
import MUCView from './muc.js';
import { api, converse } from '@converse/headless/core';
import { clearHistory, fetchAndSetMUCDomain } from './utils.js';

import './styles/index.scss';

converse.MUC.VIEWS = {
    CONFIG: 'config-form',
    BOOKMARK: 'bookmark-form'
}

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

        _converse.ChatRoomView = MUCView;

        api.listen.on('clearsession', () => {
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

        api.listen.on('chatBoxClosed', (model) => {
            if (model.get('type') === _converse.CHATROOMS_TYPE) {
                clearHistory(model.get('jid'));
            }
        });
    }
});
