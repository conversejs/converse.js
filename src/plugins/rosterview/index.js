/**
 * @copyright 2025, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { _converse, api, converse, RosterFilter } from '@converse/headless';
import RosterContactView from './contactview.js';
import { highlightRosterItem } from './utils.js';
import '../modal';
import AddContactModal from './modals/add-contact.js';
import AcceptContactRequestModal from './modals/accept-contact-request.js';
import NewChatModal from './modals/new-chat.js';
import BlockListModal from './modals/blocklist.js';
import RosterView from './rosterview.js';

import './approval-alert.js';
import 'shared/styles/status.scss';
import './styles/roster.scss';

converse.plugins.add('converse-rosterview', {
    dependencies: ['converse-roster', 'converse-modal', 'converse-chatboxviews', 'converse-blocklist'],

    initialize() {
        api.settings.extend({
            allow_contact_removal: true,
            hide_offline_users: false,
            roster_groups: true,
            xhr_user_search_url: null,
            // XMPP Providers autocomplete settings
            xmpp_providers_url: 'https://data.xmpp.net/providers/v2/providers-Ds.json',
        });
        api.promises.add('rosterViewInitialized');

        const exports = {
            AcceptContactRequestModal,
            AddContactModal,
            BlockListModal,
            NewChatModal,
            RosterContactView,
            RosterFilter,
            RosterView,
        };
        Object.assign(_converse, exports); // DEPRECATED
        Object.assign(_converse.exports, exports);

        /* -------- Event Handlers ----------- */
        api.listen.on('chatBoxesInitialized', () => {
            _converse.state.chatboxes.on('destroy', (c) => highlightRosterItem(c.get('jid')));
            _converse.state.chatboxes.on('change:hidden', (c) => highlightRosterItem(c.get('jid')));
        });
    },
});
