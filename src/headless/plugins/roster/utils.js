import { _converse, api } from "@converse/headless/core";
import { Model } from '@converse/skeletor/src/model.js';


export async function initRoster () {
    // Initialize the Bakcbone collections that represent the contats
    // roster and the roster groups.
    await api.waitUntil('VCardsInitialized');
    _converse.roster = new _converse.RosterContacts();
    let id = `converse.contacts-${_converse.bare_jid}`;
    _converse.roster.browserStorage = _converse.createStore(id);

    _converse.roster.data = new Model();
    id = `converse-roster-model-${_converse.bare_jid}`;
    _converse.roster.data.id = id;
    _converse.roster.data.browserStorage = _converse.createStore(id);
    _converse.roster.data.fetch();

    id = `converse.roster.groups${_converse.bare_jid}`;
    _converse.rostergroups = new _converse.RosterGroups();
    _converse.rostergroups.browserStorage = _converse.createStore(id);
    /**
     * Triggered once the `_converse.RosterContacts` and `_converse.RosterGroups` have
     * been created, but not yet populated with data.
     * This event is useful when you want to create views for these collections.
     * @event _converse#chatBoxMaximized
     * @example _converse.api.listen.on('rosterInitialized', () => { ... });
     * @example _converse.api.waitUntil('rosterInitialized').then(() => { ... });
     */
    api.trigger('rosterInitialized');
}


export function updateUnreadCounter (chatbox) {
    const contact = _converse.roster && _converse.roster.findWhere({'jid': chatbox.get('jid')});
    if (contact !== undefined) {
        contact.save({'num_unread': chatbox.get('num_unread')});
    }
}


export async function clearPresences () {
    await _converse.presences?.clearStore();
}
