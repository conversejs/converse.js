import tpl_roster from "./templates/roster.js";
import { CustomElement } from 'shared/components/element.js';
import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api } from "@converse/headless/core";


/**
 * @class
 * @namespace _converse.RosterView
 * @memberOf _converse
 */
export default class RosterView extends CustomElement {

    async initialize () {
        await api.waitUntil('rosterInitialized')
        const { presences, roster } = _converse;
        this.listenTo(_converse, 'rosterContactsFetched', () => this.requestUpdate());
        this.listenTo(presences, 'change:show', () => this.requestUpdate());
        this.listenTo(roster, 'add', () => this.requestUpdate());
        this.listenTo(roster, 'destroy', () => this.requestUpdate());
        this.listenTo(roster, 'remove', () => this.requestUpdate());
        this.listenTo(roster, 'change', () => this.requestUpdate());
        this.listenTo(roster.state, 'change', () => this.requestUpdate());
        /**
         * Triggered once the _converse.RosterView instance has been created and initialized.
         * @event _converse#rosterViewInitialized
         * @example _converse.api.listen.on('rosterViewInitialized', () => { ... });
         */
        api.trigger('rosterViewInitialized');
    }

    firstUpdated () {
        this.listenToRosterFilter();
    }

    render () {
        return tpl_roster(this);
    }

    listenToRosterFilter () {
        this.filter_view = this.querySelector('converse-roster-filter');
        this.filter_view.addEventListener('update', () => this.requestUpdate());
    }

    showAddContactModal (ev) { // eslint-disable-line class-methods-use-this
        api.modal.show('converse-add-contact-modal', {'model': new Model()}, ev);
    }

    async syncContacts (ev) { // eslint-disable-line class-methods-use-this
        ev.preventDefault();
        this.syncing_contacts = true;
        this.requestUpdate();

        _converse.roster.data.save('version', null);
        await _converse.roster.fetchFromServer();
        api.user.presence.send();

        this.syncing_contacts = false;
        this.requestUpdate();
    }
}

api.elements.define('converse-roster', RosterView);
