/**
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "../modal";
import "@converse/headless/plugins/chatboxes/index.js";
import "@converse/headless/plugins/roster/index.js";
import "./modals/add-contact.js";
import './rosterview.js';
import RosterContactView from './contactview.js';
import { RosterFilter } from '@converse/headless/plugins/roster/filter.js';
import { _converse, api, converse } from "@converse/headless";
import { highlightRosterItem } from './utils.js';

import 'shared/styles/status.scss';
import './styles/roster.scss';


converse.plugins.add('converse-rosterview', {

    dependencies: ["converse-roster", "converse-modal", "converse-chatboxviews"],

    initialize () {
        api.settings.extend({
            'autocomplete_add_contact': true,
            'allow_contact_removal': true,
            'hide_offline_users': false,
            'roster_groups': true,
            'xhr_user_search_url': null,
        });
        api.promises.add('rosterViewInitialized');

        const exports = { RosterFilter, RosterContactView };
        Object.assign(_converse, exports); // DEPRECATED
        Object.assign(_converse.exports, exports);

        /* -------- Event Handlers ----------- */
        api.listen.on('chatBoxesInitialized', () => {
            _converse.state.chatboxes.on('destroy', c => highlightRosterItem(c));
            _converse.state.chatboxes.on('change:hidden', c => highlightRosterItem(c));
        });
    }
});
