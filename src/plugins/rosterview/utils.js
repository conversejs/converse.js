import log from "@converse/headless/log";
import { _converse, api } from "@converse/headless/core";


export function initRosterView () {
    if (api.settings.get("authentication") === _converse.ANONYMOUS) {
        return;
    }
    _converse.rosterview = new _converse.RosterView({'model': _converse.rostergroups });
    _converse.rosterview.render();
    /**
     * Triggered once the _converse.RosterView instance has been created and initialized.
     * @event _converse#rosterViewInitialized
     * @example _converse.api.listen.on('rosterViewInitialized', () => { ... });
     */
    api.trigger('rosterViewInitialized');
}


export function highlightRosterItem (chatbox) {
    _converse.roster?.findWhere({'jid': chatbox.get('jid')})?.trigger('highlight');
}


export function insertRoster (view) {
    if (!view.model.get('connected') || api.settings.get("authentication") === _converse.ANONYMOUS) {
        return;
    }
    /* Place the rosterview inside the "Contacts" panel. */
    api.waitUntil('rosterViewInitialized')
        .then(() => view.controlbox_pane.el.insertAdjacentElement('beforeEnd', _converse.rosterview.el))
        .catch(e => log.fatal(e));
}
