// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define(["jquery.noconflict",
            "converse-core",
            "tpl!group_header",
            "tpl!pending_contact",
            "tpl!requesting_contact",
            "tpl!roster",
            "tpl!roster_filter",
            "tpl!roster_item",
            "converse-chatboxes"
    ], factory);
}(this, function (
            $,
            converse, 
            tpl_group_header,
            tpl_pending_contact,
            tpl_requesting_contact,
            tpl_roster,
            tpl_roster_filter,
            tpl_roster_item) {
    "use strict";
    const { Backbone, utils, Strophe, $iq, b64_sha1, sizzle, _ } = converse.env;


    converse.plugins.add('converse-rosterview', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.
            afterReconnected () {
                this.__super__.afterReconnected.apply(this, arguments);
            },

            _tearDown () {
                /* Remove the rosterview when tearing down. It gets created
                 * anew when reconnecting or logging in.
                 */
                this.__super__._tearDown.apply(this, arguments);
                if (!_.isUndefined(this.rosterview)) {
                    this.rosterview.remove();
                }
            },

            RosterGroups: {
                comparator () {
                    // RosterGroupsComparator only gets set later (once i18n is
                    // set up), so we need to wrap it in this nameless function.
                    const { _converse } = this.__super__;
                    return _converse.RosterGroupsComparator.apply(this, arguments);
                }
            }
        },


        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this,
                { __,
                ___ } = _converse;

            _converse.api.settings.update({
                allow_chat_pending_contacts: true,
                allow_contact_removal: true,
                show_toolbar: true,
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
            const LABEL_CONTACTS = __('Contacts');
            const LABEL_GROUPS = __('Groups');
            const HEADER_CURRENT_CONTACTS =  __('My contacts');
            const HEADER_PENDING_CONTACTS = __('Pending contacts');
            const HEADER_REQUESTING_CONTACTS = __('Contact requests');
            const HEADER_UNGROUPED = __('Ungrouped');
            const HEADER_WEIGHTS = {};
            HEADER_WEIGHTS[HEADER_REQUESTING_CONTACTS] = 0;
            HEADER_WEIGHTS[HEADER_CURRENT_CONTACTS]    = 1;
            HEADER_WEIGHTS[HEADER_UNGROUPED]           = 2;
            HEADER_WEIGHTS[HEADER_PENDING_CONTACTS]    = 3;

            _converse.RosterGroupsComparator = function (a, b) {
                /* Groups are sorted alphabetically, ignoring case.
                 * However, Ungrouped, Requesting Contacts and Pending Contacts
                 * appear last and in that order.
                 */
                a = a.get('name');
                b = b.get('name');
                const special_groups = _.keys(HEADER_WEIGHTS);
                const a_is_special = _.includes(special_groups, a);
                const b_is_special = _.includes(special_groups, b);
                if (!a_is_special && !b_is_special ) {
                    return a.toLowerCase() < b.toLowerCase() ? -1 : (a.toLowerCase() > b.toLowerCase() ? 1 : 0);
                } else if (a_is_special && b_is_special) {
                    return HEADER_WEIGHTS[a] < HEADER_WEIGHTS[b] ? -1 : (HEADER_WEIGHTS[a] > HEADER_WEIGHTS[b] ? 1 : 0);
                } else if (!a_is_special && b_is_special) {
                    return (b === HEADER_REQUESTING_CONTACTS) ? 1 : -1;
                } else if (a_is_special && !b_is_special) {
                    return (a === HEADER_REQUESTING_CONTACTS) ? -1 : 1;
                }
            };


            _converse.RosterFilter = Backbone.Model.extend({
                initialize () {
                    this.set({
                        'filter_text': '',
                        'filter_type': 'contacts',
                        'chat_state': ''
                    });
                },
            });

            _converse.RosterFilterView = Backbone.View.extend({
                tagName: 'span',
                events: {
                    "keydown .roster-filter": "liveFilter",
                    "submit form.roster-filter-form": "submitFilter",
                    "click .onX": "clearFilter",
                    "mousemove .x": "toggleX",
                    "change .filter-type": "changeTypeFilter",
                    "change .state-type": "changeChatStateFilter"
                },

                initialize () {
                    this.model.on('change:filter_type', this.render, this);
                    this.model.on('change:filter_text', this.renderClearButton, this);
                },

                render () {
                    this.el.innerHTML = tpl_roster_filter(
                        _.extend(this.model.toJSON(), {
                            placeholder: __('Filter'),
                            label_contacts: LABEL_CONTACTS,
                            label_groups: LABEL_GROUPS,
                            label_state: __('State'),
                            label_any: __('Any'),
                            label_unread_messages: __('Unread'),
                            label_online: __('Online'),
                            label_chatty: __('Chatty'),
                            label_busy: __('Busy'),
                            label_away: __('Away'),
                            label_xa: __('Extended Away'),
                            label_offline: __('Offline')
                        }));
                    this.renderClearButton();
                    return this.$el;
                },

                renderClearButton () {
                    const roster_filter = this.el.querySelector('.roster-filter');
                    if (_.isNull(roster_filter)) {
                        return;
                    }
                    roster_filter.classList[this.tog(roster_filter.value)]('x');
                },

                tog (v) {
                    return v?'add':'remove';
                },

                toggleX (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    const el = ev.target;
                    el.classList[this.tog(el.offsetWidth-18 < ev.clientX-el.getBoundingClientRect().left)]('onX');
                },

                changeChatStateFilter (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.model.save({
                        'chat_state': this.el.querySelector('.state-type').value
                    });
                },

                changeTypeFilter (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    const type = ev.target.value;
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

                liveFilter: _.debounce(function (ev) {
                    this.model.save({
                        'filter_type': this.el.querySelector('.filter-type').value,
                        'filter_text': this.el.querySelector('.roster-filter').value
                    });
                }, 250),

                submitFilter (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.liveFilter();
                    this.render();
                },

                isActive () {
                    /* Returns true if the filter is enabled (i.e. if the user
                     * has added values to the filter).
                     */
                    if (this.model.get('filter_type') === 'state' ||
                        this.model.get('filter_text')) {
                        return true;
                    }
                    return false;
                },

                show () {
                    if (this.$el.is(':visible')) { return this; }
                    this.$el.show();
                    return this;
                },

                hide () {
                    if (!this.$el.is(':visible')) { return this; }
                    if (this.el.querySelector('.roster-filter').value.length > 0) {
                        // Don't hide if user is currently filtering.
                        return;
                    }
                    this.model.save({
                        'filter_text': '',
                        'chat_state': ''
                    });
                    this.$el.hide();
                    return this;
                },

                clearFilter (ev) {
                    if (ev && ev.preventDefault) {
                        ev.preventDefault();
                        $(ev.target).removeClass('x onX').val('');
                    }
                    this.model.save({
                        'filter_text': ''
                    });
                }
            });

            _converse.RosterView = Backbone.Overview.extend({
                tagName: 'div',
                id: 'converse-roster',

                initialize () {
                    _converse.roster.on("add", this.onContactAdd, this);
                    _converse.roster.on('change', this.onContactChange, this);
                    _converse.roster.on("destroy", this.update, this);
                    _converse.roster.on("remove", this.update, this);
                    this.model.on("add", this.onGroupAdd, this);
                    this.model.on("reset", this.reset, this);
                    _converse.on('rosterGroupsFetched', this.positionFetchedGroups, this);
                    _converse.on('rosterContactsFetched', this.update, this);
                    this.createRosterFilter();
                },

                render () {
                    this.renderRoster();
                    this.$el.html(this.filter_view.render());
                    if (!_converse.allow_contact_requests) {
                        // XXX: if we ever support live editing of config then
                        // we'll need to be able to remove this class on the fly.
                        this.el.classList.add('no-contact-requests');
                    }
                    return this;
                },

                renderRoster () {
                    this.$roster = $(tpl_roster());
                    this.roster = this.$roster[0];
                },

                createRosterFilter () {
                    // Create a model on which we can store filter properties
                    const model = new _converse.RosterFilter();
                    model.id = b64_sha1(`_converse.rosterfilter${_converse.bare_jid}`);
                    model.browserStorage = new Backbone.BrowserStorage.local(this.filter.id);
                    this.filter_view = new _converse.RosterFilterView({'model': model});
                    this.filter_view.model.on('change', this.updateFilter, this);
                    this.filter_view.model.fetch();
                },

                updateFilter: _.debounce(function () {
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

                update: _.debounce(function () {
                    if (_.isNull(this.roster.parentElement)) {
                        this.$el.append(this.$roster.show());
                    }
                    return this.showHideFilter();
                }, _converse.animate ? 100 : 0),

                showHideFilter () {
                    if (!this.$el.is(':visible')) {
                        return;
                    }
                    if (_converse.roster.length >= 10) {
                        this.filter_view.show();
                    } else if (!this.filter_view.isActive()) {
                        this.filter_view.hide();
                    }
                    return this;
                },

                filter (query, type) {
                    // First we make sure the filter is restored to its
                    // original state
                    _.each(this.getAll(), function (view) {
                        if (view.model.contacts.length > 0) {
                            view.show().filter('');
                        }
                    });
                    // Now we can filter
                    query = query.toLowerCase();
                    if (type === 'groups') {
                        _.each(this.getAll(), function (view, idx) {
                            if (!_.includes(view.model.get('name').toLowerCase(), query.toLowerCase())) {
                                view.hide();
                            } else if (view.model.contacts.length > 0) {
                                view.show();
                            }
                        });
                    } else {
                        _.each(this.getAll(), function (view) {
                            view.filter(query, type);
                        });
                    }
                },

                reset () {
                    _converse.roster.reset();
                    this.removeAll();
                    this.renderRoster();
                    this.render().update();
                    return this;
                },

                onGroupAdd (group) {
                    const view = new _converse.RosterGroupView({model: group});
                    this.add(group.get('name'), view.render());
                    this.positionGroup(view);
                },

                onContactAdd (contact) {
                    this.addRosterContact(contact).update();
                    this.updateFilter();
                },

                onContactChange (contact) {
                    this.updateChatBox(contact).update();
                    if (_.has(contact.changed, 'subscription')) {
                        if (contact.changed.subscription === 'from') {
                            this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                        } else if (_.includes(['both', 'to'], contact.get('subscription'))) {
                            this.addExistingContact(contact);
                        }
                    }
                    if (_.has(contact.changed, 'ask') && contact.changed.ask === 'subscribe') {
                        this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                    }
                    if (_.has(contact.changed, 'subscription') && contact.changed.requesting === 'true') {
                        this.addContactToGroup(contact, HEADER_REQUESTING_CONTACTS);
                    }
                    this.updateFilter();
                },

                updateChatBox (contact) {
                    const chatbox = _converse.chatboxes.get(contact.get('jid')),
                        changes = {};
                    if (!chatbox) {
                        return this;
                    }
                    if (_.has(contact.changed, 'chat_status')) {
                        changes.chat_status = contact.get('chat_status');
                    }
                    if (_.has(contact.changed, 'status')) {
                        changes.status = contact.get('status');
                    }
                    chatbox.save(changes);
                    return this;
                },

                positionFetchedGroups () {
                    /* Instead of throwing an add event for each group
                     * fetched, we wait until they're all fetched and then
                     * we position them.
                     * Works around the problem of positionGroup not
                     * working when all groups besides the one being
                     * positioned aren't already in inserted into the
                     * roster DOM element.
                     */
                    const that = this;
                    this.model.sort();
                    this.model.each(function (group, idx) {
                        let view = that.get(group.get('name'));
                        if (!view) {
                            view = new _converse.RosterGroupView({model: group});
                            that.add(group.get('name'), view.render());
                        }
                        if (idx === 0) {
                            that.$roster.append(view.$el);
                        } else {
                            that.appendGroup(view);
                        }
                    });
                },

                positionGroup (view) {
                    /* Place the group's DOM element in the correct alphabetical
                     * position amongst the other groups in the roster.
                     */
                    const $groups = this.$roster.find('.roster-group'),
                        index = $groups.length ? this.model.indexOf(view.model) : 0;
                    if (index === 0) {
                        this.$roster.prepend(view.$el);
                    } else if (index === (this.model.length-1)) {
                        this.appendGroup(view);
                    } else {
                        $($groups.eq(index)).before(view.$el);
                    }
                    return this;
                },

                appendGroup (view) {
                    /* Add the group at the bottom of the roster
                     */
                    const $last = this.$roster.find('.roster-group').last();
                    const $siblings = $last.siblings('dd');
                    if ($siblings.length > 0) {
                        $siblings.last().after(view.$el);
                    } else {
                        $last.after(view.$el);
                    }
                    return this;
                },

                getGroup (name) {
                    /* Returns the group as specified by name.
                     * Creates the group if it doesn't exist.
                     */
                    const view =  this.get(name);
                    if (view) {
                        return view.model;
                    }
                    return this.model.create({name, id: b64_sha1(name)});
                },

                addContactToGroup (contact, name) {
                    this.getGroup(name).contacts.add(contact);
                },

                addExistingContact (contact) {
                    let groups;
                    if (_converse.roster_groups) {
                        groups = contact.get('groups');
                        if (groups.length === 0) {
                            groups = [HEADER_UNGROUPED];
                        }
                    } else {
                        groups = [HEADER_CURRENT_CONTACTS];
                    }
                    _.each(groups, _.bind(this.addContactToGroup, this, contact));
                },

                addRosterContact (contact) {
                    if (contact.get('subscription') === 'both' || contact.get('subscription') === 'to') {
                        this.addExistingContact(contact);
                    } else {
                        if ((contact.get('ask') === 'subscribe') || (contact.get('subscription') === 'from')) {
                            this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                        } else if (contact.get('requesting') === true) {
                            this.addContactToGroup(contact, HEADER_REQUESTING_CONTACTS);
                        }
                    }
                    return this;
                }
            });


            _converse.RosterContactView = Backbone.View.extend({
                tagName: 'dd',

                events: {
                    "click .accept-xmpp-request": "acceptRequest",
                    "click .decline-xmpp-request": "declineRequest",
                    "click .open-chat": "openChat",
                    "click .remove-xmpp-contact": "removeContact"
                },

                initialize () {
                    this.model.on("change", this.render, this);
                    this.model.on("remove", this.remove, this);
                    this.model.on("destroy", this.remove, this);
                    this.model.on("open", this.openChat, this);
                },

                render () {
                    const that = this;
                    if (!this.mayBeShown()) {
                        this.$el.hide();
                        return this;
                    }
                    const item = this.model,
                        ask = item.get('ask'),
                        chat_status = item.get('chat_status'),
                        requesting  = item.get('requesting'),
                        subscription = item.get('subscription');

                    const classes_to_remove = [
                        'current-xmpp-contact',
                        'pending-xmpp-contact',
                        'requesting-xmpp-contact'
                        ].concat(_.keys(STATUSES));

                    _.each(classes_to_remove,
                        function (cls) {
                            if (_.includes(that.el.className, cls)) {
                                that.el.classList.remove(cls);
                            }
                        });
                    this.$el.addClass(chat_status).data('status', chat_status);

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
                        this.el.classList.add('pending-xmpp-contact');
                        this.$el.html(tpl_pending_contact(
                            _.extend(item.toJSON(), {
                                'desc_remove': __(___('Click to remove %1$s as a contact'), item.get('fullname')),
                                'allow_chat_pending_contacts': _converse.allow_chat_pending_contacts
                            })
                        ));
                    } else if (requesting === true) {
                        this.el.classList.add('requesting-xmpp-contact');
                        this.$el.html(tpl_requesting_contact(
                            _.extend(item.toJSON(), {
                                'desc_accept': __(___("Click to accept the contact request from %1$s"), item.get('fullname')),
                                'desc_decline': __(___("Click to decline the contact request from %1$s"), item.get('fullname')),
                                'allow_chat_pending_contacts': _converse.allow_chat_pending_contacts
                            })
                        ));
                    } else if (subscription === 'both' || subscription === 'to') {
                        this.el.classList.add('current-xmpp-contact');
                        this.el.classList.remove(_.without(['both', 'to'], subscription)[0]);
                        this.el.classList.add(subscription);
                        this.renderRosterItem(item);
                    }
                    return this;
                },

                renderRosterItem (item) {
                    const chat_status = item.get('chat_status');
                    this.$el.html(tpl_roster_item(
                        _.extend(item.toJSON(), {
                            'desc_status': STATUSES[chat_status||'offline'],
                            'desc_chat': __('Click to chat with this contact'),
                            'desc_remove': __(___('Click to remove %1$s as a contact'), item.get('fullname')),
                            'title_fullname': __('Name'),
                            'allow_contact_removal': _converse.allow_contact_removal,
                            'num_unread': item.get('num_unread') || 0
                        })
                    ));
                    return this;
                },

                isGroupCollapsed () {
                    /* Check whether the group in which this contact appears is
                     * collapsed.
                     */
                    // XXX: this sucks and is fragile.
                    // It's because I tried to do the "right thing"
                    // and use definition lists to represent roster groups.
                    // If roster group items were inside the group elements, we
                    // would simplify things by not having to check whether the
                    // group is collapsed or not.
                    const name = this.$el.prevAll('dt:first').data('group');
                    const group = _.head(_converse.rosterview.model.where({'name': name.toString()}));
                    if (group.get('state') === _converse.CLOSED) {
                        return true;
                    }
                    return false;
                },

                mayBeShown () {
                    /* Return a boolean indicating whether this contact should
                     * generally be visible in the roster.
                     *
                     * It doesn't check for the more specific case of whether
                     * the group it's in is collapsed (see isGroupCollapsed).
                     */
                    const chatStatus = this.model.get('chat_status');
                    if ((_converse.show_only_online_users && chatStatus !== 'online') ||
                        (_converse.hide_offline_users && chatStatus === 'offline')) {
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
                    return _converse.chatboxviews.showChat(this.model.attributes, true);
                },

                removeContact (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (!_converse.allow_contact_removal) { return; }
                    const result = confirm(__("Are you sure you want to remove this contact?"));
                    if (result === true) {
                        const iq = $iq({type: 'set'})
                            .c('query', {xmlns: Strophe.NS.ROSTER})
                            .c('item', {jid: this.model.get('jid'), subscription: "remove"});
                        _converse.connection.sendIQ(iq,
                            (iq) => {
                                this.model.destroy();
                                this.remove();
                            },
                            function (err) {
                                alert(__('Sorry, there was an error while trying to remove %1$s as a contact.', name));
                                _converse.log(err, Strophe.LogLevel.ERROR);
                            }
                        );
                    }
                },

                acceptRequest (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    _converse.roster.sendContactAddIQ(
                        this.model.get('jid'),
                        this.model.get('fullname'),
                        [],
                        () => { this.model.authorize().subscribe(); }
                    );
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


            _converse.RosterGroupView = Backbone.Overview.extend({
                tagName: 'dt',
                className: 'roster-group',
                events: {
                    "click a.group-toggle": "toggle"
                },

                initialize () {
                    this.model.contacts.on("add", this.addContact, this);
                    this.model.contacts.on("change:subscription", this.onContactSubscriptionChange, this);
                    this.model.contacts.on("change:requesting", this.onContactRequestChange, this);
                    this.model.contacts.on("change:chat_status", function (contact) {
                        // This might be optimized by instead of first sorting,
                        // finding the correct position in positionContact
                        this.model.contacts.sort();
                        this.positionContact(contact).render();
                    }, this);
                    this.model.contacts.on("destroy", this.onRemove, this);
                    this.model.contacts.on("remove", this.onRemove, this);
                    _converse.roster.on('change:groups', this.onContactGroupChange, this);
                },

                render () {
                    this.el.setAttribute('data-group', this.model.get('name'));
                    const html = tpl_group_header({
                        label_group: this.model.get('name'),
                        desc_group_toggle: this.model.get('description'),
                        toggle_state: this.model.get('state')
                    });
                    this.el.innerHTML = html;
                    return this;
                },

                addContact (contact) {
                    let view = new _converse.RosterContactView({model: contact});
                    this.add(contact.get('id'), view);
                    view = this.positionContact(contact).render();
                    if (view.mayBeShown()) {
                        if (this.model.get('state') === _converse.CLOSED) {
                            if (view.$el[0].style.display !== "none") { view.$el.hide(); }
                            if (!this.$el.is(':visible')) { this.$el.show(); }
                        } else {
                            if (this.$el[0].style.display !== "block") { this.show(); }
                        }
                    }
                },

                positionContact (contact) {
                    /* Place the contact's DOM element in the correct alphabetical
                     * position amongst the other contacts in this group.
                     */
                    const view = this.get(contact.get('id'));
                    const index = this.model.contacts.indexOf(contact);
                    view.$el.detach();
                    if (index === 0) {
                        this.$el.after(view.$el);
                    } else if (index === (this.model.contacts.length-1)) {
                        this.$el.nextUntil('dt').last().after(view.$el);
                    } else {
                        this.$el.nextUntil('dt').eq(index).before(view.$el);
                    }
                    return view;
                },

                show () {
                    this.$el.show();
                    _.each(this.getAll(), function (view) {
                        if (view.mayBeShown() && !view.isGroupCollapsed()) {
                            view.$el.show();
                        }
                    });
                    return this;
                },

                hide () {
                    this.$el.nextUntil('dt').addBack().hide();
                },

                filter (q, type) {
                    /* Filter the group's contacts based on the query "q".
                     * The query is matched against the contact's full name.
                     * If all contacts are filtered out (i.e. hidden), then the
                     * group must be filtered out as well.
                     */
                    let matches;
                    if (q.length === 0) {
                        if (this.model.get('state') === _converse.OPENED) {
                            this.model.contacts.each(
                                (item) => {
                                    const view = this.get(item.get('id'));
                                    if (view.mayBeShown() && !view.isGroupCollapsed()) {
                                        view.$el.show();
                                    }
                                }
                            );
                        }
                        this.showIfNecessary();
                    } else {
                        q = q.toLowerCase();
                        if (type === 'state') {
                            if (this.model.get('name') === HEADER_REQUESTING_CONTACTS) {
                                // When filtering by chat state, we still want to
                                // show requesting contacts, even though they don't
                                // have the state in question.
                                matches = this.model.contacts.filter(
                                    (contact) => utils.contains.not('chat_status', q)(contact) && !contact.get('requesting')
                                );
                            } else if (q === 'unread_messages') {
                                matches = this.model.contacts.filter({'num_unread': 0});
                            } else {
                                matches = this.model.contacts.filter(
                                    utils.contains.not('chat_status', q)
                                );
                            }
                        } else  {
                            matches = this.model.contacts.filter(
                                utils.contains.not('fullname', q)
                            );
                        }
                        if (matches.length === this.model.contacts.length) {
                            // hide the whole group
                            this.hide();
                        } else {
                            _.each(matches, (item) => {
                                this.get(item.get('id')).$el.hide();
                            });
                            if (this.model.get('state') === _converse.OPENED) {
                                _.each(this.model.contacts.reject(
                                    utils.contains.not('fullname', q)),
                                    (item) => {
                                        this.get(item.get('id')).$el.show();
                                    });
                            }
                            this.showIfNecessary();
                        }
                    }
                },

                showIfNecessary () {
                    if (!this.$el.is(':visible') && this.model.contacts.length > 0) {
                        this.$el.show();
                    }
                },

                toggle (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    const $el = $(ev.target);
                    if ($el.hasClass("icon-opened")) {
                        this.$el.nextUntil('dt').slideUp();
                        this.model.save({state: _converse.CLOSED});
                        $el.removeClass("icon-opened").addClass("icon-closed");
                    } else {
                        $el.removeClass("icon-closed").addClass("icon-opened");
                        this.model.save({state: _converse.OPENED});
                        this.filter(
                            _converse.rosterview.$('.roster-filter').val() || '',
                            _converse.rosterview.$('.filter-type').val()
                        );
                    }
                },

                onContactGroupChange (contact) {
                    const in_this_group = _.includes(contact.get('groups'), this.model.get('name'));
                    const cid = contact.get('id');
                    const in_this_overview = !this.get(cid);
                    if (in_this_group && !in_this_overview) {
                        this.model.contacts.remove(cid);
                    } else if (!in_this_group && in_this_overview) {
                        this.addContact(contact);
                    }
                },

                onContactSubscriptionChange (contact) {
                    if ((this.model.get('name') === HEADER_PENDING_CONTACTS) && contact.get('subscription') !== 'from') {
                        this.model.contacts.remove(contact.get('id'));
                    }
                },

                onContactRequestChange (contact) {
                    if ((this.model.get('name') === HEADER_REQUESTING_CONTACTS) && !contact.get('requesting')) {
                        /* We suppress events, otherwise the remove event will
                         * also cause the contact's view to be removed from the
                         * "Pending Contacts" group.
                         */
                        this.model.contacts.remove(contact.get('id'), {'silent': true});
                        // Since we suppress events, we make sure the view and
                        // contact are removed from this group.
                        this.get(contact.get('id')).remove();
                        this.onRemove(contact);
                    }
                },

                onRemove (contact) {
                    this.remove(contact.get('id'));
                    if (this.model.contacts.length === 0) {
                        this.$el.hide();
                    }
                }
            });

            /* -------- Event Handlers ----------- */

            const onChatBoxMaximized = function (chatboxview) {
                /* When a chat box gets maximized, the num_unread counter needs
                 * to be cleared, but if chatbox is scrolled up, then num_unread should not be cleared.
                 */
                const chatbox = chatboxview.model;
                if (chatbox.get('type') !== 'chatroom') {
                    const contact = _.head(_converse.roster.where({'jid': chatbox.get('jid')}));
                    if (!_.isUndefined(contact) && !chatbox.isScrolledUp()) {
                        contact.save({'num_unread': 0});
                    }
                }
            };

            const onMessageReceived = function (data) {
                /* Given a newly received message, update the unread counter on
                 * the relevant roster contact.
                 */
                const { chatbox } = data;
                if (_.isUndefined(chatbox)) {
                    return;
                }
                if (_.isNull(data.stanza.querySelector('body'))) {
                    return; // The message has no text
                }
                if (chatbox.get('type') !== 'chatroom' &&
                    utils.isNewMessage(data.stanza) &&
                    chatbox.newMessageWillBeHidden()) {

                    const contact = _.head(_converse.roster.where({'jid': chatbox.get('jid')}));
                    if (!_.isUndefined(contact)) {
                        contact.save({'num_unread': contact.get('num_unread') + 1});
                    }
                }
            };

            const onChatBoxScrolledDown = function (data) {
                const { chatbox } = data;
                if (_.isUndefined(chatbox)) {
                    return;
                }
                const contact = _.head(_converse.roster.where({'jid': chatbox.get('jid')}));
                if (!_.isUndefined(contact)) {
                    contact.save({'num_unread': 0});
                }
            };

            const initRoster = function () {
                /* Create an instance of RosterView once the RosterGroups
                 * collection has been created (in converse-core.js)
                 */
                _converse.rosterview = new _converse.RosterView({
                    'model': _converse.rostergroups
                });
                _converse.rosterview.render();
                _converse.emit('rosterViewInitialized');
            };
            _converse.api.listen.on('rosterInitialized', initRoster);
            _converse.api.listen.on('rosterReadyAfterReconnection', initRoster);
            _converse.api.listen.on('message', onMessageReceived);
            _converse.api.listen.on('chatBoxMaximized', onChatBoxMaximized);
            _converse.api.listen.on('chatBoxScrolledDown', onChatBoxScrolledDown);
        }
    });
}));
