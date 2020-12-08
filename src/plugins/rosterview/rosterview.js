import RosterGroupView from './groupview.js';
import log from "@converse/headless/log";
import tpl_roster from "./templates/roster.js";
import { Model } from '@converse/skeletor/src/model.js';
import { OrderedListView } from "@converse/skeletor/src/overview";
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";
import { debounce, has } from "lodash-es";
import { render } from 'lit-html';

const u = converse.env.utils;


/**
 * @class
 * @namespace _converse.RosterView
 * @memberOf _converse
 */
const RosterView = OrderedListView.extend({
    tagName: 'div',
    id: 'converse-roster',
    className: 'controlbox-section',

    ItemView: RosterGroupView,
    listItems: 'model',
    listSelector: '.roster-contacts',
    sortEvent: null, // Groups are immutable, so they don't get re-sorted
    subviewIndex: 'name',
    sortImmediatelyOnAdd: true,

    events: {
        'click a.controlbox-heading__btn.add-contact': 'showAddContactModal',
        'click a.controlbox-heading__btn.sync-contacts': 'syncContacts'
    },

    initialize () {
        OrderedListView.prototype.initialize.apply(this, arguments);

        this.listenTo(_converse.roster, "add", this.onContactAdded);
        this.listenTo(_converse.roster, 'change:groups', this.onContactAdded);
        this.listenTo(_converse.roster, 'change', this.onContactChange);
        this.listenTo(_converse.roster, "destroy", this.update);
        this.listenTo(_converse.roster, "remove", this.update);
        _converse.presences.on('change:show', () => {
            this.update();
            this.updateFilter();
        });

        this.listenTo(this.model, "reset", this.reset);

        // This event gets triggered once *all* contacts (i.e. not
        // just this group's) have been fetched from browser
        // storage or the XMPP server and once they've been
        // assigned to their various groups.
        api.listen.on('rosterGroupsFetched', this.sortAndPositionAllItems.bind(this));

        api.listen.on('rosterContactsFetched', () => {
            _converse.roster.each(contact => this.addRosterContact(contact, {'silent': true}));
            this.update();
            this.updateFilter();
            api.trigger('rosterContactsFetchedAndProcessed');
        });
        this.render();
        this.listenToRosterFilter();
    },

    render () {
        render(tpl_roster({
            'heading_contacts': __('Contacts'),
            'title_add_contact': __('Add a contact'),
            'title_sync_contacts': __('Re-sync your contacts')
        }), this.el);
        this.roster_el = this.el.querySelector('.roster-contacts');
        return this;
    },

    showAddContactModal (ev) {
        api.modal.show(_converse.AddContactModal, {'model': new Model()}, ev);
    },

    listenToRosterFilter () {
        this.filter_view = this.el.querySelector('converse-roster-filter');
        this.filter_view.addEventListener('update', () => this.updateFilter());
    },

    /**
     * Called whenever the filter settings have been changed or
     * when contacts have been added, removed or changed.
     *
     * Debounced for 100ms so that it doesn't get called for every
     * contact fetched from browser storage.
     */
    updateFilter: debounce(function () {
        const filter = new _converse.RosterFilter();
        const type = filter.get('filter_type');
        if (type === 'state') {
            this.filter(filter.get('chat_state'), type);
        } else {
            this.filter(filter.get('filter_text'), type);
        }
    }, 100),

    update () {
        if (!u.isVisible(this.roster_el)) {
            u.showElement(this.roster_el);
        }
        return this;
    },

    filter (query, type) {
        const views = Object.values(this.getAll());
        // First ensure the filter is restored to its original state
        views.forEach(v => (v.model.contacts.length > 0) && v.show().filter(''));
        // Now we can filter
        query = query.toLowerCase();
        if (type === 'groups') {
            views.forEach(view => {
                if (!view.model.get('name').toLowerCase().includes(query)) {
                    u.slideIn(view.el);
                } else if (view.model.contacts.length > 0) {
                    u.slideOut(view.el);
                }
            });
        } else {
            views.forEach(v => v.filter(query, type));
        }
    },

    async syncContacts (ev) {
        ev.preventDefault();
        u.addClass('fa-spin', ev.target);
        _converse.roster.data.save('version', null);
        await _converse.roster.fetchFromServer();
        api.user.presence.send();
        u.removeClass('fa-spin', ev.target);
    },

    reset () {
        this.removeAll();
        this.render().update();
        return this;
    },

    onContactAdded (contact) {
        this.addRosterContact(contact)
        this.update();
        this.updateFilter();
    },

    onContactChange (contact) {
        this.update();
        if (has(contact.changed, 'subscription')) {
            if (contact.changed.subscription === 'from') {
                this.addContactToGroup(contact, _converse.HEADER_PENDING_CONTACTS);
            } else if (['both', 'to'].includes(contact.get('subscription'))) {
                this.addExistingContact(contact);
            }
        }
        if (has(contact.changed, 'num_unread') && contact.get('num_unread')) {
            this.addContactToGroup(contact, _converse.HEADER_UNREAD);
        }
        if (has(contact.changed, 'ask') && contact.changed.ask === 'subscribe') {
            this.addContactToGroup(contact, _converse.HEADER_PENDING_CONTACTS);
        }
        if (has(contact.changed, 'subscription') && contact.changed.requesting === 'true') {
            this.addContactToGroup(contact, _converse.HEADER_REQUESTING_CONTACTS);
        }
        this.updateFilter();
    },

    /**
     * Returns the group as specified by name.
     * Creates the group if it doesn't exist.
     * @method _converse.RosterView#getGroup
     * @private
     * @param {string} name
     */
    getGroup (name) {
        const view =  this.get(name);
        if (view) {
            return view.model;
        }
        return this.model.create({name});
    },

    addContactToGroup (contact, name, options) {
        this.getGroup(name).contacts.add(contact, options);
        this.sortAndPositionAllItems();
    },

    addExistingContact (contact, options) {
        let groups;
        if (api.settings.get('roster_groups')) {
            groups = contact.get('groups');
            groups = (groups.length === 0) ? [_converse.HEADER_UNGROUPED] : groups;
        } else {
            groups = [_converse.HEADER_CURRENT_CONTACTS];
        }
        if (contact.get('num_unread')) {
            groups.push(_converse.HEADER_UNREAD);
        }
        groups.forEach(g => this.addContactToGroup(contact, g, options));
    },

    isSelf (jid) {
        return u.isSameBareJID(jid, _converse.connection.jid);
    },

    addRosterContact (contact, options) {
        const jid = contact.get('jid');
        if (contact.get('subscription') === 'both' || contact.get('subscription') === 'to' || this.isSelf(jid)) {
            this.addExistingContact(contact, options);
        } else {
            if (!api.settings.get('allow_contact_requests')) {
                log.debug(
                    `Not adding requesting or pending contact ${jid} `+
                    `because allow_contact_requests is false`
                );
                return;
            }
            if ((contact.get('ask') === 'subscribe') || (contact.get('subscription') === 'from')) {
                this.addContactToGroup(contact, _converse.HEADER_PENDING_CONTACTS, options);
            } else if (contact.get('requesting') === true) {
                this.addContactToGroup(contact, _converse.HEADER_REQUESTING_CONTACTS, options);
            }
        }
        return this;
    }
});


export default RosterView;
