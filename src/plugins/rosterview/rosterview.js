import { Model } from '@converse/skeletor';
import { _converse, api, u, constants } from "@converse/headless";
import { CustomElement } from 'shared/components/element.js';
import { slideIn, slideOut } from 'utils/html.js';
import tplRoster from "./templates/roster.js";

const { initStorage } = u;
const { CLOSED, OPENED } = constants;


/**
 * @class
 * @namespace _converse.RosterView
 * @memberOf _converse
 */
export default class RosterView extends CustomElement {

    async initialize () {
        const bare_jid = _converse.session.get('bare_jid');
        const id = `converse.contacts-panel${bare_jid}`;
        this.model = new Model({ id });
        initStorage(this.model, id);
        this.model.fetch();

        await api.waitUntil('rosterInitialized')

        const { chatboxes, presences, roster } = _converse.state;
        this.listenTo(_converse, 'rosterContactsFetched', () => this.requestUpdate());
        this.listenTo(presences, 'change:show', () => this.requestUpdate());
        this.listenTo(chatboxes, 'change:hidden', () => this.requestUpdate());
        this.listenTo(roster, 'add', () => this.requestUpdate());
        this.listenTo(roster, 'destroy', () => this.requestUpdate());
        this.listenTo(roster, 'remove', () => this.requestUpdate());
        this.listenTo(roster, 'change', () => this.requestUpdate());
        this.listenTo(roster, 'presence:change', () => this.requestUpdate());
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
        return tplRoster(this);
    }

    /** @param {MouseEvent} ev */
    showAddContactModal (ev) {
        api.modal.show('converse-add-contact-modal', {'model': new Model()}, ev);
    }

    /** @param {MouseEvent} ev */
    showNewChatModal (ev) {
        api.modal.show('converse-new-chat-modal', {'model': new Model()}, ev);
    }

    /** @param {MouseEvent} [ev] */
    async syncContacts (ev) {
        ev?.preventDefault();
        const { roster } = _converse.state;
        this.syncing_contacts = true;
        this.requestUpdate();

        roster.data.save('version', null);
        await roster.fetchFromServer();
        api.user.presence.send();

        this.syncing_contacts = false;
        this.requestUpdate();
    }

    /** @param {MouseEvent} [ev] */
    toggleRoster (ev) {
        ev?.preventDefault?.();
        const list_el = /** @type {HTMLElement} */(this.querySelector('.list-container.roster-contacts'));
        if (this.model.get('toggle_state') === CLOSED) {
            slideOut(list_el).then(() => this.model.save({'toggle_state': OPENED}));
        } else {
            slideIn(list_el).then(() => this.model.save({'toggle_state': CLOSED}));
        }
    }

    /** @param {MouseEvent} [ev] */
    toggleFilter (ev) {
        ev?.preventDefault?.();
        this.model.save({ filter_visible: !this.model.get('filter_visible') });
    }
}

api.elements.define('converse-roster', RosterView);
