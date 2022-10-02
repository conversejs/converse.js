import tpl_roster from "./templates/roster.js";
import { CustomElement } from 'shared/components/element.js';
import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api } from "@converse/headless/core";
import { initStorage } from '@converse/headless/utils/storage.js';
import { slideIn, slideOut } from 'utils/html.js';


/**
 * @class
 * @namespace _converse.RosterView
 * @memberOf _converse
 */
export default class RosterView extends CustomElement {

    async initialize () {
        const id = `converse.contacts-panel${_converse.bare_jid}`;
        this.model = new Model({ id });
        initStorage(this.model, id);
        this.model.fetch();

        await api.waitUntil('rosterInitialized')

        const { presences, roster } = _converse;
        this.listenTo(_converse, 'rosterContactsFetched', () => this.requestUpdate());
        this.listenTo(presences, 'change:show', () => this.requestUpdate());
        this.listenTo(roster, 'add', () => this.requestUpdate());
        this.listenTo(roster, 'destroy', () => this.requestUpdate());
        this.listenTo(roster, 'remove', () => this.requestUpdate());
        this.listenTo(roster, 'change', () => this.requestUpdate());
        this.listenTo(roster.state, 'change', () => this.requestUpdate());
        this.listenTo(this.model, 'change', () => this.requestUpdate());
        /**
         * Triggered once the _converse.RosterView instance has been created and initialized.
         * @event _converse#rosterViewInitialized
         * @example _converse.api.listen.on('rosterViewInitialized', () => { ... });
         */
        api.trigger('rosterViewInitialized');
    }

    render () {
        return tpl_roster(this);
    }

    showAddContactModal (ev) { // eslint-disable-line class-methods-use-this
        api.modal.show('converse-add-contact-modal', {'model': new Model()}, ev);
    }

    async syncContacts (ev) { // eslint-disable-line class-methods-use-this
        ev.preventDefault();
        const { roster } = _converse;
        this.syncing_contacts = true;
        this.requestUpdate();

        roster.data.save('version', null);
        await roster.fetchFromServer();
        api.user.presence.send();

        this.syncing_contacts = false;
        this.requestUpdate();
    }

    toggleRoster (ev) {
        ev?.preventDefault?.();
        const list_el = this.querySelector('.list-container.roster-contacts');
        if (this.model.get('toggle_state') === _converse.CLOSED) {
            slideOut(list_el).then(() => this.model.save({'toggle_state': _converse.OPENED}));
        } else {
            slideIn(list_el).then(() => this.model.save({'toggle_state': _converse.CLOSED}));
        }
    }
}

api.elements.define('converse-roster', RosterView);
