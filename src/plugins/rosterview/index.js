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
import { RosterFilterView } from './filterview.js';
import { _converse, api, converse } from "@converse/headless/core";
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

        _converse.RosterFilter = RosterFilter;
        _converse.RosterFilterView = RosterFilterView;
        _converse.RosterContactView = RosterContactView;

        /* -------- Event Handlers ----------- */
        api.listen.on('chatBoxesInitialized', () => {
            _converse.chatboxes.on('destroy', chatbox => highlightRosterItem(chatbox));
            _converse.chatboxes.on('change:hidden', chatbox => highlightRosterItem(chatbox));
        });

        api.listen.on('afterTearDown', () => _converse.rotergroups?.off().reset());
    }
});
