/**
 * @module converse-rosterview
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "@converse/headless/converse-chatboxes";
import "@converse/headless/converse-roster";
import "converse-modal";
import { compact, debounce, has, isString, uniq, without } from "lodash";
import { BootstrapModal } from "./converse-modal.js";
import { View } from 'skeletor.js/src/view.js';
import { Model } from 'skeletor.js/src/model.js';
import { OrderedListView } from "skeletor.js/src/overview";
import converse from "@converse/headless/converse-core";
import log from "@converse/headless/log";
import tpl_add_contact_modal from "templates/add_contact_modal.js";
import tpl_group_header from "templates/group_header.html";
import tpl_pending_contact from "templates/pending_contact.html";
import tpl_requesting_contact from "templates/requesting_contact.html";
import tpl_roster from "templates/roster.html";
import tpl_roster_filter from "templates/roster_filter.js";
import tpl_roster_item from "templates/roster_item.html";

const { Strophe } = converse.env;
const u = converse.env.utils;


converse.plugins.add('converse-rosterview', {

    dependencies: ["converse-roster", "converse-modal", "converse-chatboxviews"],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this,
              { __ } = _converse;

        _converse.api.settings.update({
            'autocomplete_add_contact': true,
            'allow_chat_pending_contacts': true,
            'allow_contact_removal': true,
            'hide_offline_users': false,
            'roster_groups': true,
            'show_toolbar': true,
            'xhr_user_search_url': null,
        });
        _converse.api.promises.add('rosterViewInitialized');

        const STATUSES = {
            'dnd': __('This contact is busy'),
            'online': __('This contact is online'),
            'offline': __('This contact is offline'),
            'unavailable': __('This contact is unavailable'),
            'xa': __('This contact is away for an extended period'),
            'away': __('This contact is away')
        };


        _converse.AddContactModal = BootstrapModal.extend({
            id: "add-contact-modal",
            events: {
                'submit form': 'addContactFromForm'
            },

            initialize () {
                BootstrapModal.prototype.initialize.apply(this, arguments);
                this.listenTo(this.model, 'change', this.render);
            },

            toHTML () {
                const label_nickname = _converse.xhr_user_search_url ? __('Contact name') : __('Optional nickname');
                return tpl_add_contact_modal(Object.assign(this.model.toJSON(), {
                    '_converse': _converse,
                    'label_nickname': label_nickname,
                }));
            },

            afterRender () {
                if (_converse.xhr_user_search_url && isString(_converse.xhr_user_search_url)) {
                    this.initXHRAutoComplete();
                } else {
                    this.initJIDAutoComplete();
                }
                const jid_input = this.el.querySelector('input[name="jid"]');
                this.el.addEventListener('shown.bs.modal', () => jid_input.focus(), false);
            },

            initJIDAutoComplete () {
                if (!_converse.autocomplete_add_contact) {
                    return;
                }
                const el = this.el.querySelector('.suggestion-box__jid').parentElement;
                this.jid_auto_complete = new _converse.AutoComplete(el, {
                    'data': (text, input) => `${input.slice(0, input.indexOf("@"))}@${text}`,
                    'filter': _converse.FILTER_STARTSWITH,
                    'list': uniq(_converse.roster.map(item => Strophe.getDomainFromJid(item.get('jid'))))
                });
            },

            initXHRAutoComplete () {
                if (!_converse.autocomplete_add_contact) {
                    return this.initXHRFetch();
                }
                const el = this.el.querySelector('.suggestion-box__name').parentElement;
                this.name_auto_complete = new _converse.AutoComplete(el, {
                    'auto_evaluate': false,
                    'filter': _converse.FILTER_STARTSWITH,
                    'list': []
                });
                const xhr = new window.XMLHttpRequest();
                // `open` must be called after `onload` for mock/testing purposes.
                xhr.onload = () => {
                    if (xhr.responseText) {
                        const r = xhr.responseText;
                        this.name_auto_complete.list = JSON.parse(r).map(i => ({'label': i.fullname || i.jid, 'value': i.jid}));
                        this.name_auto_complete.auto_completing = true;
                        this.name_auto_complete.evaluate();
                    }
                };
                const input_el = this.el.querySelector('input[name="name"]');
                input_el.addEventListener('input', debounce(() => {
                    xhr.open("GET", `${_converse.xhr_user_search_url}q=${encodeURIComponent(input_el.value)}`, true);
                    xhr.send()
                } , 300));
                this.name_auto_complete.on('suggestion-box-selectcomplete', ev => {
                    this.el.querySelector('input[name="name"]').value = ev.text.label;
                    this.el.querySelector('input[name="jid"]').value = ev.text.value;
                });
            },

            initXHRFetch () {
                this.xhr = new window.XMLHttpRequest();
                this.xhr.onload = () => {
                    if (this.xhr.responseText) {
                        const r = this.xhr.responseText;
                        const list = JSON.parse(r).map(i => ({'label': i.fullname || i.jid, 'value': i.jid}));
                        if (list.length !== 1) {
                            const el = this.el.querySelector('.invalid-feedback');
                            el.textContent = __('Sorry, could not find a contact with that name')
                            u.addClass('d-block', el);
                            return;
                        }
                        const jid = list[0].value;
                        if (this.validateSubmission(jid)) {
                            const form = this.el.querySelector('form');
                                const name = list[0].label;
                            this.afterSubmission(form, jid, name);
                        }
                    }
                };
            },

            validateSubmission (jid) {
                const el = this.el.querySelector('.invalid-feedback');
                if (!jid || compact(jid.split('@')).length < 2) {
                    u.addClass('is-invalid', this.el.querySelector('input[name="jid"]'));
                    u.addClass('d-block', el);
                    return false;
                } else if (_converse.roster.get(Strophe.getBareJidFromJid(jid))) {
                    el.textContent = __('This contact has already been added')
                    u.addClass('d-block', el);
                    return false;
                }
                u.removeClass('d-block', el);
                return true;
            },

            afterSubmission (form, jid, name) {
                _converse.roster.addAndSubscribe(jid, name);
                this.model.clear();
                this.modal.hide();
            },

            addContactFromForm (ev) {
                ev.preventDefault();
                const data = new FormData(ev.target),
                      jid = (data.get('jid') || '').trim();

                if (!jid && _converse.xhr_user_search_url && isString(_converse.xhr_user_search_url)) {
                    const input_el = this.el.querySelector('input[name="name"]');
                    this.xhr.open("GET", `${_converse.xhr_user_search_url}q=${encodeURIComponent(input_el.value)}`, true);
                    this.xhr.send()
                    return;
                }
                if (this.validateSubmission(jid)) {
                    this.afterSubmission(ev.target, jid, data.get('name'));
                }
            }
        });


        _converse.RosterFilter = Model.extend({
            initialize () {
                this.set({
                    'filter_text': '',
                    'filter_type': 'contacts',
                    'chat_state': 'online'
                });
            },
        });

        _converse.RosterFilterView = View.extend({
            tagName: 'span',

            initialize () {
                this.listenTo(this.model, 'change:filter_type', this.render);
                this.listenTo(this.model, 'change:filter_text', this.render);
            },

            toHTML () {
                return tpl_roster_filter(
                    Object.assign(this.model.toJSON(), {
                        visible: this.shouldBeVisible(),
                        placeholder: __('Filter'),
                        title_contact_filter: __('Filter by contact name'),
                        title_group_filter: __('Filter by group name'),
                        title_status_filter: __('Filter by status'),
                        label_any: __('Any'),
                        label_unread_messages: __('Unread'),
                        label_online: __('Online'),
                        label_chatty: __('Chatty'),
                        label_busy: __('Busy'),
                        label_away: __('Away'),
                        label_xa: __('Extended Away'),
                        label_offline: __('Offline'),
                        changeChatStateFilter: ev => this.changeChatStateFilter(ev),
                        changeTypeFilter: ev => this.changeTypeFilter(ev),
                        clearFilter: ev => this.clearFilter(ev),
                        liveFilter: ev => this.liveFilter(ev),
                        submitFilter: ev => this.submitFilter(ev),
                    }));
            },

            changeChatStateFilter (ev) {
                ev && ev.preventDefault();
                this.model.save({'chat_state': this.el.querySelector('.state-type').value});
            },

            changeTypeFilter (ev) {
                ev && ev.preventDefault();
                const type = ev.target.dataset.type;
                if (type === 'state') {
                    this.model.save({
                        'filter_type': type,
                        'chat_state': this.el.querySelector('.state-type').value
                    });
                } else {
                    this.model.save({
                        'filter_type': type,
                        'filter_text': this.el.querySelector('.roster-filter').value
                    });
                }
            },

            liveFilter: debounce(function () {
                this.model.save({'filter_text': this.el.querySelector('.roster-filter').value});
            }, 250),

            submitFilter (ev) {
                ev && ev.preventDefault();
                this.liveFilter();
            },

            /**
             * Returns true if the filter is enabled (i.e. if the user
             * has added values to the filter).
             * @private
             * @method _converse.RosterFilterView#isActive
             */
            isActive () {
                return (this.model.get('filter_type') === 'state' || this.model.get('filter_text'));
            },

            shouldBeVisible () {
                return _converse.roster && _converse.roster.length >= 5 || this.isActive();
            },

            clearFilter (ev) {
                ev && ev.preventDefault();
                this.model.save({'filter_text': ''});
            }
        });


        _converse.RosterContactView = _converse.ViewWithAvatar.extend({
            tagName: 'li',
            className: 'list-item d-flex hidden controlbox-padded',

            events: {
                "click .accept-xmpp-request": "acceptRequest",
                "click .decline-xmpp-request": "declineRequest",
                "click .open-chat": "openChat",
                "click .remove-xmpp-contact": "removeContact"
            },

            async initialize () {
                await this.model.initialized;
                this.debouncedRender = debounce(this.render, 50);
                this.listenTo(this.model, "change", this.debouncedRender);
                this.listenTo(this.model, "destroy", this.remove);
                this.listenTo(this.model, "highlight", this.highlight);
                this.listenTo(this.model, "open", this.openChat);
                this.listenTo(this.model, "remove", this.remove);
                this.listenTo(this.model, 'vcard:change', this.debouncedRender);
                this.listenTo(this.model.presence, "change:show", this.debouncedRender);
                this.render();
            },

            render () {
                if (!this.mayBeShown()) {
                    u.hideElement(this.el);
                    return this;
                }
                const ask = this.model.get('ask'),
                    show = this.model.presence.get('show'),
                    requesting  = this.model.get('requesting'),
                    subscription = this.model.get('subscription'),
                    jid = this.model.get('jid');

                const classes_to_remove = [
                    'current-xmpp-contact',
                    'pending-xmpp-contact',
                    'requesting-xmpp-contact'
                    ].concat(Object.keys(STATUSES));
                classes_to_remove.forEach(c => u.removeClass(c, this.el));

                this.el.classList.add(show);
                this.el.setAttribute('data-status', show);
                this.highlight();

                if (_converse.isUniView()) {
                    const chatbox = _converse.chatboxes.get(this.model.get('jid'));
                    if (chatbox) {
                        if (chatbox.get('hidden')) {
                            this.el.classList.remove('open');
                        } else {
                            this.el.classList.add('open');
                        }
                    }
                }

                if ((ask === 'subscribe') || (subscription === 'from')) {
                    /* ask === 'subscribe'
                     *      Means we have asked to subscribe to them.
                     *
                     * subscription === 'from'
                     *      They are subscribed to use, but not vice versa.
                     *      We assume that there is a pending subscription
                     *      from us to them (otherwise we're in a state not
                     *      supported by converse.js).
                     *
                     *  So in both cases the user is a "pending" contact.
                     */
                    const display_name = this.model.getDisplayName();
                    this.el.classList.add('pending-xmpp-contact');
                    this.el.innerHTML = tpl_pending_contact(
                        Object.assign(this.model.toJSON(), {
                            display_name,
                            'desc_remove': __('Click to remove %1$s as a contact', display_name),
                            'allow_chat_pending_contacts': _converse.allow_chat_pending_contacts
                        })
                    );
                } else if (requesting === true) {
                    const display_name = this.model.getDisplayName();
                    this.el.classList.add('requesting-xmpp-contact');
                    this.el.innerHTML = tpl_requesting_contact(
                        Object.assign(this.model.toJSON(), {
                            display_name,
                            'desc_accept': __("Click to accept the contact request from %1$s", display_name),
                            'desc_decline': __("Click to decline the contact request from %1$s", display_name),
                            'allow_chat_pending_contacts': _converse.allow_chat_pending_contacts
                        })
                    );
                } else if (subscription === 'both' || subscription === 'to' || _converse.rosterview.isSelf(jid)) {
                    this.el.classList.add('current-xmpp-contact');
                    this.el.classList.remove(without(['both', 'to'], subscription)[0]);
                    this.el.classList.add(subscription);
                    this.renderRosterItem(this.model);
                }
                return this;
            },

            /**
             * If appropriate, highlight the contact (by adding the 'open' class).
             * @private
             * @method _converse.RosterContactView#highlight
             */
            highlight () {
                if (_converse.isUniView()) {
                    const chatbox = _converse.chatboxes.get(this.model.get('jid'));
                    if ((chatbox && chatbox.get('hidden')) || !chatbox) {
                        this.el.classList.remove('open');
                    } else {
                        this.el.classList.add('open');
                    }
                }
            },

            renderRosterItem (item) {
                const show = item.presence.get('show') || 'offline';
                let status_icon;
                if (show === 'online') {
                    status_icon = 'fa fa-circle chat-status chat-status--online';
                } else if (show === 'away') {
                    status_icon = 'fa fa-circle chat-status chat-status--away';
                } else if (show === 'xa') {
                    status_icon = 'far fa-circle chat-status chat-status-xa';
                } else if (show === 'dnd') {
                    status_icon = 'fa fa-minus-circle chat-status chat-status--busy';
                } else {
                    status_icon = 'fa fa-times-circle chat-status chat-status--offline';
                }
                const display_name = item.getDisplayName();
                this.el.innerHTML = tpl_roster_item(
                    Object.assign(item.toJSON(), {
                        show,
                        display_name,
                        status_icon,
                        'desc_status': STATUSES[show],
                        'desc_chat': __('Click to chat with %1$s (JID: %2$s)', display_name, item.get('jid')),
                        'desc_remove': __('Click to remove %1$s as a contact', display_name),
                        'allow_contact_removal': _converse.allow_contact_removal,
                        'num_unread': item.get('num_unread') || 0,
                        classes: ''
                    })
                );
                this.renderAvatar();
                return this;
            },

            /**
             * Returns a boolean indicating whether this contact should
             * generally be visible in the roster.
             * It doesn't check for the more specific case of whether
             * the group it's in is collapsed.
             * @private
             * @method _converse.RosterContactView#mayBeShown
             */
            mayBeShown () {
                const chatStatus = this.model.presence.get('show');
                if (_converse.hide_offline_users && chatStatus === 'offline') {
                    // If pending or requesting, show
                    if ((this.model.get('ask') === 'subscribe') ||
                            (this.model.get('subscription') === 'from') ||
                            (this.model.get('requesting') === true)) {
                        return true;
                    }
                    return false;
                }
                return true;
            },

            openChat (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                const attrs = this.model.attributes;
                _converse.api.chats.open(attrs.jid, attrs, true);
            },

            async removeContact (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                if (!_converse.allow_contact_removal) { return; }
                if (!confirm(__("Are you sure you want to remove this contact?"))) { return; }

                try {
                    await this.model.removeFromRoster();
                    this.remove();
                    if (this.model.collection) {
                        // The model might have already been removed as
                        // result of a roster push.
                        this.model.destroy();
                    }
                } catch (e) {
                    log.error(e);
                    _converse.api.alert('error', __('Error'),
                        [__('Sorry, there was an error while trying to remove %1$s as a contact.', this.model.getDisplayName())]
                    );
                }
            },

            async acceptRequest (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }

                await _converse.roster.sendContactAddIQ(
                    this.model.get('jid'),
                    this.model.getFullname(),
                    []
                );
                this.model.authorize().subscribe();
            },

            declineRequest (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                const result = confirm(__("Are you sure you want to decline this contact request?"));
                if (result === true) {
                    this.model.unauthorize().destroy();
                }
                return this;
            }
        });

        /**
         * @class
         * @namespace _converse.RosterGroupView
         * @memberOf _converse
         */
        _converse.RosterGroupView = OrderedListView.extend({
            tagName: 'div',
            className: 'roster-group hidden',
            events: {
                "click a.group-toggle": "toggle"
            },

            sortImmediatelyOnAdd: true,
            ItemView: _converse.RosterContactView,
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
                _converse.rosterview.on(
                    'rosterContactsFetchedAndProcessed',
                    () => this.sortAndPositionAllItems()
                );
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
                let matches;
                q = q.toLowerCase();
                if (type === 'state') {
                    const sticky_groups = [_converse.HEADER_REQUESTING_CONTACTS, _converse.HEADER_UNREAD];
                    if (sticky_groups.includes(this.model.get('name'))) {
                        // When filtering by chat state, we still want to
                        // show sticky groups, even though they don't
                        // match the state in question.
                        return [];
                    } else if (q === 'unread_messages') {
                        matches = this.model.contacts.filter({'num_unread': 0});
                    } else if (q === 'online') {
                        matches = this.model.contacts.filter(c => ["offline", "unavailable"].includes(c.presence.get('show')));
                    } else {
                        matches = this.model.contacts.filter(c => !c.presence.get('show').includes(q));
                    }
                } else  {
                    matches = this.model.contacts.filter((contact) => {
                        return !contact.getDisplayName().toLowerCase().includes(q.toLowerCase());
                    });
                }
                return matches;
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


        /**
         * @class
         * @namespace _converse.RosterView
         * @memberOf _converse
         */
        _converse.RosterView = OrderedListView.extend({
            tagName: 'div',
            id: 'converse-roster',
            className: 'controlbox-section',

            ItemView: _converse.RosterGroupView,
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
                _converse.api.listen.on('rosterGroupsFetched', this.sortAndPositionAllItems.bind(this));

                _converse.api.listen.on('rosterContactsFetched', () => {
                    _converse.roster.each(contact => this.addRosterContact(contact, {'silent': true}));
                    this.update();
                    this.updateFilter();
                    this.trigger('rosterContactsFetchedAndProcessed');
                });
                this.createRosterFilter();
            },

            render () {
                this.el.innerHTML = tpl_roster({
                    'allow_contact_requests': _converse.allow_contact_requests,
                    'heading_contacts': __('Contacts'),
                    'title_add_contact': __('Add a contact'),
                    'title_sync_contacts': __('Re-sync your contacts')
                });
                const form = this.el.querySelector('.roster-filter-form');
                this.el.replaceChild(this.filter_view.render().el, form);
                this.roster_el = this.el.querySelector('.roster-contacts');
                return this;
            },

            showAddContactModal (ev) {
                if (this.add_contact_modal === undefined) {
                    this.add_contact_modal = new _converse.AddContactModal({'model': new Model()});
                }
                this.add_contact_modal.show(ev);
            },

            createRosterFilter () {
                // Create a model on which we can store filter properties
                const model = new _converse.RosterFilter();
                model.id = `_converse.rosterfilter-${_converse.bare_jid}`;
                model.browserStorage = _converse.createStore(model.id);
                this.filter_view = new _converse.RosterFilterView({model});
                this.listenTo(this.filter_view.model, 'change', this.updateFilter);
                this.filter_view.model.fetch();
            },

            updateFilter: debounce(function () {
                /* Filter the roster again.
                 * Called whenever the filter settings have been changed or
                 * when contacts have been added, removed or changed.
                 *
                 * Debounced so that it doesn't get called for every
                 * contact fetched from browser storage.
                 */
                const type = this.filter_view.model.get('filter_type');
                if (type === 'state') {
                    this.filter(this.filter_view.model.get('chat_state'), type);
                } else {
                    this.filter(this.filter_view.model.get('filter_text'), type);
                }
            }, 100),

            update () {
                if (!u.isVisible(this.roster_el)) {
                    u.showElement(this.roster_el);
                }
                this.filter_view.render();
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
                _converse.xmppstatus.sendPresence();
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
                if (_converse.roster_groups) {
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
                    if (!_converse.allow_contact_requests) {
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

        /* -------- Event Handlers ----------- */
        _converse.api.listen.on('chatBoxesInitialized', () => {
            function highlightRosterItem (chatbox) {
                const contact = _converse.roster && _converse.roster.findWhere({'jid': chatbox.get('jid')});
                if (contact !== undefined) {
                    contact.trigger('highlight');
                }
            }
            _converse.chatboxes.on('destroy', chatbox => highlightRosterItem(chatbox));
            _converse.chatboxes.on('change:hidden', chatbox => highlightRosterItem(chatbox));
        });


        _converse.api.listen.on('controlBoxInitialized', (view) => {
            function insertRoster () {
                if (!view.model.get('connected') || _converse.authentication === _converse.ANONYMOUS) {
                    return;
                }
                /* Place the rosterview inside the "Contacts" panel. */
                _converse.api.waitUntil('rosterViewInitialized')
                    .then(() => view.controlbox_pane.el.insertAdjacentElement('beforeEnd', _converse.rosterview.el))
                    .catch(e => log.fatal(e));
            }
            insertRoster();
            view.model.on('change:connected', insertRoster);
        });


        function initRosterView () {
            /* Create an instance of RosterView once the RosterGroups
             * collection has been created (in @converse/headless/converse-core.js)
             */
            if (_converse.authentication === _converse.ANONYMOUS) {
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
            _converse.api.trigger('rosterViewInitialized');
        }
        _converse.api.listen.on('rosterInitialized', initRosterView);
        _converse.api.listen.on('rosterReadyAfterReconnection', initRosterView);

        _converse.api.listen.on('afterTearDown', () => {
            if (converse.rosterview) {
                converse.rosterview.model.off().reset();
                converse.rosterview.each(groupview => groupview.removeAll().remove());
                converse.rosterview.removeAll().remove();
                delete converse.rosterview;
            }
        });
    }
});

