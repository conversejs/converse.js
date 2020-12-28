/**
 * @module converse-rosterview
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "../modal";
import "@converse/headless/plugins/chatboxes";
import "@converse/headless/plugins/roster";
import "modals/add-contact.js";
import RosterContactView from './contactview.js';
import RosterGroupView from './groupview.js';
import RosterView from './rosterview.js';
import log from "@converse/headless/log";
import { RosterFilter, RosterFilterView } from './filterview.js';
import { _converse, api, converse } from "@converse/headless/core";


converse.plugins.add('converse-rosterview', {

    dependencies: ["converse-roster", "converse-modal", "converse-chatboxviews"],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */

        api.settings.extend({
            'autocomplete_add_contact': true,
            'allow_chat_pending_contacts': true,
            'allow_contact_removal': true,
            'hide_offline_users': false,
            'roster_groups': true,
            'xhr_user_search_url': null,
        });
        api.promises.add('rosterViewInitialized');

        _converse.RosterFilter = RosterFilter;
        _converse.RosterFilterView = RosterFilterView;
        _converse.RosterContactView = RosterContactView;
        _converse.RosterGroupView = RosterGroupView;
        _converse.RosterView = RosterView;

        /* -------- Event Handlers ----------- */
        api.listen.on('chatBoxesInitialized', () => {
            function highlightRosterItem (chatbox) {
                const contact = _converse.roster && _converse.roster.findWhere({'jid': chatbox.get('jid')});
                if (contact !== undefined) {
                    contact.trigger('highlight');
                }
            }
            _converse.chatboxes.on('destroy', chatbox => highlightRosterItem(chatbox));
            _converse.chatboxes.on('change:hidden', chatbox => highlightRosterItem(chatbox));
        });


        api.listen.on('controlBoxInitialized', (view) => {
            function insertRoster () {
                if (!view.model.get('connected') || api.settings.get("authentication") === _converse.ANONYMOUS) {
                    return;
                }
                /* Place the rosterview inside the "Contacts" panel. */
                api.waitUntil('rosterViewInitialized')
                    .then(() => view.controlbox_pane.el.insertAdjacentElement('beforeEnd', _converse.rosterview.el))
                    .catch(e => log.fatal(e));
            }
            insertRoster();
            view.model.on('change:connected', insertRoster);
        });


        function initRosterView () {
            /* Create an instance of RosterView once the RosterGroups
             * collection has been created (in @converse/headless/core.js)
             */
            if (api.settings.get("authentication") === _converse.ANONYMOUS) {
                return;
            }
            _converse.rosterview = new _converse.RosterView({
                'model': _converse.rostergroups
            });
            _converse.rosterview.render();
            /**
             * Triggered once the _converse.RosterView instance has been created and initialized.
             * @event _converse#rosterViewInitialized
             * @example _converse.api.listen.on('rosterViewInitialized', () => { ... });
             */
            api.trigger('rosterViewInitialized');
        }
        api.listen.on('rosterInitialized', initRosterView);
        api.listen.on('rosterReadyAfterReconnection', initRosterView);

        api.listen.on('afterTearDown', () => {
            if (converse.rosterview) {
                converse.rosterview.model.off().reset();
                converse.rosterview.each(groupview => groupview.removeAll().remove());
                converse.rosterview.removeAll().remove();
                delete converse.rosterview;
            }
        });
    }
});
