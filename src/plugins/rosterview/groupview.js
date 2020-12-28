import RosterContactView from './contactview.js';
import tpl_group_header from "./templates/group_header.html";
import { OrderedListView } from "@converse/skeletor/src/overview";
import { _converse, api, converse } from "@converse/headless/core";

const u = converse.env.utils;

/**
 * @class
 * @namespace _converse.RosterGroupView
 * @memberOf _converse
 */
const RosterGroupView = OrderedListView.extend({
    tagName: 'div',
    className: 'roster-group hidden',
    events: {
        "click a.group-toggle": "toggle"
    },

    sortImmediatelyOnAdd: true,
    ItemView: RosterContactView,
    listItems: 'model.contacts',
    listSelector: '.roster-group-contacts',
    sortEvent: 'presenceChanged',

    initialize () {
        OrderedListView.prototype.initialize.apply(this, arguments);

        if (this.model.get('name') === _converse.HEADER_UNREAD) {
            this.listenTo(this.model.contacts, "change:num_unread",
                c => !this.model.get('unread_messages') && this.removeContact(c)
            );
        }
        if (this.model.get('name') === _converse.HEADER_REQUESTING_CONTACTS) {
            this.listenTo(this.model.contacts, "change:requesting",
                c => !c.get('requesting') && this.removeContact(c)
            );
        }
        if (this.model.get('name') === _converse.HEADER_PENDING_CONTACTS) {
            this.listenTo(this.model.contacts, "change:subscription",
                c => (c.get('subscription') !== 'from') && this.removeContact(c)
            );
        }

        this.listenTo(this.model.contacts, "remove", this.onRemove);
        this.listenTo(_converse.roster, 'change:groups', this.onContactGroupChange);

        // This event gets triggered once *all* contacts (i.e. not
        // just this group's) have been fetched from browser
        // storage or the XMPP server and once they've been
        // assigned to their various groups.
        api.listen.on('rosterContactsFetchedAndProcessed', () => this.sortAndPositionAllItems());
    },

    render () {
        this.el.setAttribute('data-group', this.model.get('name'));
        this.el.innerHTML = tpl_group_header({
            'label_group': this.model.get('name'),
            'desc_group_toggle': this.model.get('description'),
            'toggle_state': this.model.get('state'),
            '_converse': _converse
        });
        this.contacts_el = this.el.querySelector('.roster-group-contacts');
        return this;
    },

    show () {
        u.showElement(this.el);
        if (this.model.get('state') === _converse.OPENED) {
            Object.values(this.getAll())
                .filter(v => v.mayBeShown())
                .forEach(v => u.showElement(v.el));
        }
        return this;
    },

    collapse () {
        return u.slideIn(this.contacts_el);
    },

    /* Given a list of contacts, make sure they're filtered out
     * (aka hidden) and that all other contacts are visible.
     * If all contacts are hidden, then also hide the group title.
     * @private
     * @method _converse.RosterGroupView#filterOutContacts
     * @param { Array } contacts
     */
    filterOutContacts (contacts=[]) {
        let shown = 0;
        this.model.contacts.forEach(contact => {
            const contact_view = this.get(contact.get('id'));
            if (contacts.includes(contact)) {
                u.hideElement(contact_view.el);
            } else if (contact_view.mayBeShown()) {
                u.showElement(contact_view.el);
                shown += 1;
            }
        });
        if (shown) {
            u.showElement(this.el);
        } else {
            u.hideElement(this.el);
        }
    },

    /**
     * Given the filter query "q" and the filter type "type",
     * return a list of contacts that need to be filtered out.
     * @private
     * @method _converse.RosterGroupView#getFilterMatches
     * @param { String } q - The filter query
     * @param { String } type - The filter type
     */
    getFilterMatches (q, type) {
        if (q.length === 0) {
            return [];
        }
        q = q.toLowerCase();
        const contacts = this.model.contacts;
        if (type === 'state') {
            const sticky_groups = [_converse.HEADER_REQUESTING_CONTACTS, _converse.HEADER_UNREAD];
            if (sticky_groups.includes(this.model.get('name'))) {
                // When filtering by chat state, we still want to
                // show sticky groups, even though they don't
                // match the state in question.
                return [];
            } else if (q === 'unread_messages') {
                return contacts.filter({'num_unread': 0});
            } else if (q === 'online') {
                return contacts.filter(c => ["offline", "unavailable"].includes(c.presence.get('show')));
            } else {
                return contacts.filter(c => !c.presence.get('show').includes(q));
            }
        } else  {
            return contacts.filter(c => !c.getFilterCriteria().includes(q));
        }
    },

    /**
     * Filter the group's contacts based on the query "q".
     *
     * If all contacts are filtered out (i.e. hidden), then the
     * group must be filtered out as well.
     * @private
     * @method _converse.RosterGroupView#filter
     * @param { string } q - The query to filter against
     * @param { string } type
     */
    filter (q, type) {
        if (q === null || q === undefined) {
            type = type || _converse.rosterview.filter_view.model.get('filter_type');
            if (type === 'state') {
                q = _converse.rosterview.filter_view.model.get('chat_state');
            } else {
                q = _converse.rosterview.filter_view.model.get('filter_text');
            }
        }
        this.filterOutContacts(this.getFilterMatches(q, type));
    },

    async toggle (ev) {
        if (ev && ev.preventDefault) { ev.preventDefault(); }
        const icon_el = ev.target.matches('.fa') ? ev.target : ev.target.querySelector('.fa');
        if (u.hasClass("fa-caret-down", icon_el)) {
            this.model.save({state: _converse.CLOSED});
            await this.collapse();
            icon_el.classList.remove("fa-caret-down");
            icon_el.classList.add("fa-caret-right");
        } else {
            icon_el.classList.remove("fa-caret-right");
            icon_el.classList.add("fa-caret-down");
            this.model.save({state: _converse.OPENED});
            this.filter();
            u.showElement(this.el);
            u.slideOut(this.contacts_el);
        }
    },

    onContactGroupChange (contact) {
        const in_this_group = contact.get('groups').includes(this.model.get('name'));
        const cid = contact.get('id');
        const in_this_overview = !this.get(cid);
        if (in_this_group && !in_this_overview) {
            this.items.trigger('add', contact);
        } else if (!in_this_group) {
            this.removeContact(contact);
        }
    },

    removeContact (contact) {
        // We suppress events, otherwise the remove event will
        // also cause the contact's view to be removed from the
        // "Pending Contacts" group.
        this.model.contacts.remove(contact, {'silent': true});
        this.onRemove(contact);
    },

    onRemove (contact) {
        this.remove(contact.get('jid'));
        if (this.model.contacts.length === 0) {
            this.remove();
        }
    }
});

export default RosterGroupView;
