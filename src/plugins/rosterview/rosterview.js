import debounce from 'lodash/debounce';
import tpl_roster from "./templates/roster.js";
import { ElementView } from "@converse/skeletor/src/element";
import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api, converse } from "@converse/headless/core";
import { render } from 'lit-html';

const u = converse.env.utils;


/**
 * @class
 * @namespace _converse.RosterView
 * @memberOf _converse
 */
export default class RosterView extends ElementView {
    events = {
        'click a.controlbox-heading__btn.add-contact': 'showAddContactModal',
        'click a.controlbox-heading__btn.sync-contacts': 'syncContacts'
    }

    async initialize () {
        await api.waitUntil('rosterInitialized')
        this.debouncedRender = debounce(this.render, 100);
        this.listenTo(_converse.roster, "add", this.debouncedRender);
        this.listenTo(_converse.roster, "destroy", this.debouncedRender);
        this.listenTo(_converse.roster, "remove", this.debouncedRender);
        this.listenTo(_converse.roster, 'change', this.renderIfRelevantChange);

        // FIXME Need to find a fix for this on the contact.presence
        // this.listenTo(this.model.presence, "change:show", this.requestUpdate);

        this.listenTo(_converse.roster.state, "change", this.render);
        _converse.presences.on('change:show', () => this.debouncedRender());
        api.listen.on('rosterContactsFetched', () => this.render());
        this.render();
        this.listenToRosterFilter();
        /**
         * Triggered once the _converse.RosterView instance has been created and initialized.
         * @event _converse#rosterViewInitialized
         * @example _converse.api.listen.on('rosterViewInitialized', () => { ... });
         */
        api.trigger('rosterViewInitialized');
    }

    render () {
        render(tpl_roster(), this);
    }

    renderIfRelevantChange (model) {
        const attrs = ['ask', 'requesting', 'groups', 'num_unread'];
        const changed = model.changed || {};
        if (Object.keys(changed).filter(m => attrs.includes(m)).length) {
            this.render();
        }
    }

    listenToRosterFilter () {
        this.filter_view = this.querySelector('converse-roster-filter');
        this.filter_view.addEventListener('update', () => this.render());
    }

    showAddContactModal (ev) { // eslint-disable-line class-methods-use-this
        api.modal.show(_converse.AddContactModal, {'model': new Model()}, ev);
    }

    async syncContacts (ev) { // eslint-disable-line class-methods-use-this
        ev.preventDefault();
        u.addClass('fa-spin', ev.target);
        _converse.roster.data.save('version', null);
        await _converse.roster.fetchFromServer();
        api.user.presence.send();
        u.removeClass('fa-spin', ev.target);
    }
}

api.elements.define('converse-roster', RosterView);
