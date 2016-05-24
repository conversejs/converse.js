// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

(function (root, factory) {
    define("converse-rosterview", ["converse-core", "converse-api"], factory);
}(this, function (converse, converse_api) {
    "use strict";
    var $ = converse_api.env.jQuery,
        utils = converse_api.env.utils,
        Strophe = converse_api.env.Strophe,
        $iq = converse_api.env.$iq,
        b64_sha1 = converse_api.env.b64_sha1,
        _ = converse_api.env._,
        __ = utils.__.bind(converse);


    converse_api.plugins.add('rosterview', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            afterReconnected: function () {
                this.rosterview.registerRosterXHandler();
                this.rosterview.registerPresenceHandler();
                this._super.afterReconnected.apply(this, arguments);
            }
        },


        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            this.updateSettings({
                allow_chat_pending_contacts: false,
                allow_contact_removal: true,
                show_toolbar: true,
            });

            var STATUSES = {
                'dnd': __('This contact is busy'),
                'online': __('This contact is online'),
                'offline': __('This contact is offline'),
                'unavailable': __('This contact is unavailable'),
                'xa': __('This contact is away for an extended period'),
                'away': __('This contact is away')
            };
            var DESC_GROUP_TOGGLE = __('Click to hide these contacts');
            var LABEL_CONTACTS = __('Contacts');
            var LABEL_GROUPS = __('Groups');
            var HEADER_CURRENT_CONTACTS =  __('My contacts');
            var HEADER_PENDING_CONTACTS = __('Pending contacts');
            var HEADER_REQUESTING_CONTACTS = __('Contact requests');
            var HEADER_UNGROUPED = __('Ungrouped');
            var HEADER_WEIGHTS = {};
            HEADER_WEIGHTS[HEADER_CURRENT_CONTACTS]    = 0;
            HEADER_WEIGHTS[HEADER_UNGROUPED]           = 1;
            HEADER_WEIGHTS[HEADER_REQUESTING_CONTACTS] = 2;
            HEADER_WEIGHTS[HEADER_PENDING_CONTACTS]    = 3;

            converse.RosterFilter = Backbone.Model.extend({
                initialize: function () {
                    this.set({
                        'filter_text': '',
                        'filter_type': 'contacts',
                        'chat_state': ''
                    });
                },
            });

            converse.RosterFilterView = Backbone.View.extend({
                tagName: 'span',
                events: {
                    "keydown .roster-filter": "liveFilter",
                    "click .onX": "clearFilter",
                    "mousemove .x": "toggleX",
                    "change .filter-type": "changeTypeFilter",
                    "change .state-type": "changeChatStateFilter"
                },

                initialize: function () {
                    this.model.on('change', this.render, this);
                },

                render: function () {
                    this.$el.html(converse.templates.roster(
                        _.extend(this.model.toJSON(), {
                            placeholder: __('Filter'),
                            label_contacts: LABEL_CONTACTS,
                            label_groups: LABEL_GROUPS,
                            label_state: __('State'),
                            label_any: __('Any'),
                            label_online: __('Online'),
                            label_chatty: __('Chatty'),
                            label_busy: __('Busy'),
                            label_away: __('Away'),
                            label_xa: __('Extended Away'),
                            label_offline: __('Offline')
                        })
                    ));
                    var $roster_filter = this.$('.roster-filter');
                    $roster_filter[this.tog($roster_filter.val())]('x');
                    return this.$el;
                },

                tog: function (v) {
                    return v?'addClass':'removeClass';
                },

                toggleX: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var el = ev.target;
                    $(el)[this.tog(el.offsetWidth-18 < ev.clientX-el.getBoundingClientRect().left)]('onX');
                },

                changeChatStateFilter: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.model.save({
                        'chat_state': this.$('.state-type').val()
                    });
                },

                changeTypeFilter: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var type = ev.target.value;
                    if (type === 'state') {
                        this.model.save({
                            'filter_type': type,
                            'chat_state': this.$('.state-type').val()
                        });
                    } else {
                        this.model.save({
                            'filter_type': type,
                            'filter_text': this.$('.roster-filter').val(),
                        });
                    }
                },

                liveFilter: _.debounce(function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.model.save({
                        'filter_type': this.$('.filter-type').val(),
                        'filter_text': this.$('.roster-filter').val()
                    });
                }, 250),

                isActive: function () {
                    /* Returns true if the filter is enabled (i.e. if the user
                     * has added values to the filter).
                     */
                    if (this.model.get('filter_type') === 'state' ||
                        this.model.get('filter_text')) {
                        return true;
                    }
                    return false;
                },

                show: function () {
                    if (this.$el.is(':visible')) { return this; }
                    this.$el.show();
                    return this;
                },

                hide: function () {
                    if (!this.$el.is(':visible')) { return this; }
                    if (this.$('.roster-filter').val().length > 0) {
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

                clearFilter: function (ev) {
                    if (ev && ev.preventDefault) {
                        ev.preventDefault();
                        $(ev.target).removeClass('x onX').val('');
                    }
                    this.model.save({
                        'filter_text': ''
                    });
                }
            });

            converse.RosterView = Backbone.Overview.extend({
                tagName: 'div',
                id: 'converse-roster',

                initialize: function () {
                    this.roster_handler_ref = this.registerRosterHandler();
                    this.rosterx_handler_ref = this.registerRosterXHandler();
                    this.presence_ref = this.registerPresenceHandler();
                    converse.roster.on("add", this.onContactAdd, this);
                    converse.roster.on('change', this.onContactChange, this);
                    converse.roster.on("destroy", this.update, this);
                    converse.roster.on("remove", this.update, this);
                    this.model.on("add", this.onGroupAdd, this);
                    this.model.on("reset", this.reset, this);
                    this.$roster = $('<dl class="roster-contacts" style="display: none;"></dl>');
                    // Create a model on which we can store filter properties
                    var model = new converse.RosterFilter();
                    model.id = b64_sha1('converse.rosterfilter'+converse.bare_jid);
                    model.browserStorage = new Backbone.BrowserStorage.local(this.filter.id);
                    this.filter_view = new converse.RosterFilterView({'model': model});
                    this.filter_view.model.on('change', this.updateFilter, this);
                    this.filter_view.model.fetch();
                },

                render: function () {
                    this.$el.html(this.filter_view.render());
                    if (!converse.allow_contact_requests) {
                        // XXX: if we ever support live editing of config then
                        // we'll need to be able to remove this class on the fly.
                        this.$el.addClass('no-contact-requests');
                    }
                    return this;
                },

                updateFilter: _.debounce(function () {
                    /* Filter the roster again.
                     * Called whenever the filter settings have been changed or
                     * when contacts have been added, removed or changed.
                     *
                     * Debounced so that it doesn't get called for every
                     * contact fetched from browser storage.
                     */
                    var type = this.filter_view.model.get('filter_type');
                    if (type === 'state') {
                        this.filter(this.filter_view.model.get('chat_state'), type);
                    } else {
                        this.filter(this.filter_view.model.get('filter_text'), type);
                    }
                }, 100),

                unregisterHandlers: function () {
                    converse.connection.deleteHandler(this.roster_handler_ref);
                    delete this.roster_handler_ref;
                    converse.connection.deleteHandler(this.rosterx_handler_ref);
                    delete this.rosterx_handler_ref;
                    converse.connection.deleteHandler(this.presence_ref);
                    delete this.presence_ref;
                },

                update: _.debounce(function () {
                    if (this.$roster.parent().length === 0) {
                        this.$el.append(this.$roster.show());
                    }
                    return this.showHideFilter();
                }, converse.animate ? 100 : 0),

                showHideFilter: function () {
                    if (!this.$el.is(':visible')) {
                        return;
                    }
                    if (this.$roster.hasScrollBar()) {
                        this.filter_view.show();
                    } else if (!this.filter_view.isActive()) {
                        this.filter_view.hide();
                    }
                    return this;
                },

                fetch: function () {
                    this.model.fetch({
                        silent: true, // We use the success handler to handle groups that were added,
                                    // we need to first have all groups before positionFetchedGroups
                                    // will work properly.
                        success: function (collection, resp, options) {
                            if (collection.length !== 0) {
                                this.positionFetchedGroups(collection, resp, options);
                            }
                            converse.roster.fetch({
                                add: true,
                                success: function (collection) {
                                    if (collection.length === 0) {
                                        /* We don't have any roster contacts stored in sessionStorage,
                                         * so lets fetch the roster from the XMPP server. We pass in
                                         * 'sendPresence' as callback method, because after initially
                                         * fetching the roster we are ready to receive presence
                                         * updates from our contacts.
                                         */
                                        converse.roster.fetchFromServer(
                                                converse.xmppstatus.sendPresence.bind(converse.xmppstatus));
                                    } else if (converse.send_initial_presence) {
                                        /* We're not going to fetch the roster again because we have
                                         * it already cached in sessionStorage, but we still need to
                                         * send out a presence stanza because this is a new session.
                                         * See: https://github.com/jcbrand/converse.js/issues/536
                                         */
                                        converse.xmppstatus.sendPresence();
                                    }
                                }
                            });
                        }.bind(this)
                    });
                    return this;
                },

                filter: function (query, type) {
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
                            if (view.model.get('name').toLowerCase().indexOf(query.toLowerCase()) === -1) {
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

                reset: function () {
                    converse.roster.reset();
                    this.removeAll();
                    this.$roster = $('<dl class="roster-contacts" style="display: none;"></dl>');
                    this.render().update();
                    return this;
                },

                registerRosterHandler: function () {
                    converse.connection.addHandler(
                        converse.roster.onRosterPush.bind(converse.roster),
                        Strophe.NS.ROSTER, 'iq', "set"
                    );
                },

                registerRosterXHandler: function () {
                    var t = 0;
                    converse.connection.addHandler(
                        function (msg) {
                            window.setTimeout(
                                function () {
                                    converse.connection.flush();
                                    converse.roster.subscribeToSuggestedItems.bind(converse.roster)(msg);
                                },
                                t
                            );
                            t += $(msg).find('item').length*250;
                            return true;
                        },
                        Strophe.NS.ROSTERX, 'message', null
                    );
                },

                registerPresenceHandler: function () {
                    converse.connection.addHandler(
                        function (presence) {
                            converse.roster.presenceHandler(presence);
                            return true;
                        }.bind(this), null, 'presence', null);
                },

                onGroupAdd: function (group) {
                    var view = new converse.RosterGroupView({model: group});
                    this.add(group.get('name'), view.render());
                    this.positionGroup(view);
                },

                onContactAdd: function (contact) {
                    this.addRosterContact(contact).update();
                    this.updateFilter();
                },

                onContactChange: function (contact) {
                    this.updateChatBox(contact).update();
                    if (_.has(contact.changed, 'subscription')) {
                        if (contact.changed.subscription === 'from') {
                            this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                        } else if (_.contains(['both', 'to'], contact.get('subscription'))) {
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

                updateChatBox: function (contact) {
                    var chatbox = converse.chatboxes.get(contact.get('jid')),
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

                positionFetchedGroups: function (model, resp, options) {
                    /* Instead of throwing an add event for each group
                     * fetched, we wait until they're all fetched and then
                     * we position them.
                     * Works around the problem of positionGroup not
                     * working when all groups besides the one being
                     * positioned aren't already in inserted into the
                     * roster DOM element.
                     */
                    model.sort();
                    model.each(function (group, idx) {
                        var view = this.get(group.get('name'));
                        if (!view) {
                            view = new converse.RosterGroupView({model: group});
                            this.add(group.get('name'), view.render());
                        }
                        if (idx === 0) {
                            this.$roster.append(view.$el);
                        } else {
                            this.appendGroup(view);
                        }
                    }.bind(this));
                },

                positionGroup: function (view) {
                    /* Place the group's DOM element in the correct alphabetical
                     * position amongst the other groups in the roster.
                     */
                    var $groups = this.$roster.find('.roster-group'),
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

                appendGroup: function (view) {
                    /* Add the group at the bottom of the roster
                     */
                    var $last = this.$roster.find('.roster-group').last();
                    var $siblings = $last.siblings('dd');
                    if ($siblings.length > 0) {
                        $siblings.last().after(view.$el);
                    } else {
                        $last.after(view.$el);
                    }
                    return this;
                },

                getGroup: function (name) {
                    /* Returns the group as specified by name.
                     * Creates the group if it doesn't exist.
                     */
                    var view =  this.get(name);
                    if (view) {
                        return view.model;
                    }
                    return this.model.create({name: name, id: b64_sha1(name)});
                },

                addContactToGroup: function (contact, name) {
                    this.getGroup(name).contacts.add(contact);
                },

                addExistingContact: function (contact) {
                    var groups;
                    if (converse.roster_groups) {
                        groups = contact.get('groups');
                        if (groups.length === 0) {
                            groups = [HEADER_UNGROUPED];
                        }
                    } else {
                        groups = [HEADER_CURRENT_CONTACTS];
                    }
                    _.each(groups, _.bind(this.addContactToGroup, this, contact));
                },

                addRosterContact: function (contact) {
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


            converse.RosterContactView = Backbone.View.extend({
                tagName: 'dd',

                events: {
                    "click .accept-xmpp-request": "acceptRequest",
                    "click .decline-xmpp-request": "declineRequest",
                    "click .open-chat": "openChat",
                    "click .remove-xmpp-contact": "removeContact"
                },

                initialize: function () {
                    this.model.on("change", this.render, this);
                    this.model.on("remove", this.remove, this);
                    this.model.on("destroy", this.remove, this);
                    this.model.on("open", this.openChat, this);
                },

                render: function () {
                    if (!this.mayBeShown()) {
                        this.$el.hide();
                        return this;
                    }
                    var item = this.model,
                        ask = item.get('ask'),
                        chat_status = item.get('chat_status'),
                        requesting  = item.get('requesting'),
                        subscription = item.get('subscription');

                    var classes_to_remove = [
                        'current-xmpp-contact',
                        'pending-xmpp-contact',
                        'requesting-xmpp-contact'
                        ].concat(_.keys(STATUSES));

                    _.each(classes_to_remove,
                        function (cls) {
                            if (this.el.className.indexOf(cls) !== -1) {
                                this.$el.removeClass(cls);
                            }
                        }, this);
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
                        this.$el.addClass('pending-xmpp-contact');
                        this.$el.html(converse.templates.pending_contact(
                            _.extend(item.toJSON(), {
                                'desc_remove': __('Click to remove this contact'),
                                'allow_chat_pending_contacts': converse.allow_chat_pending_contacts
                            })
                        ));
                    } else if (requesting === true) {
                        this.$el.addClass('requesting-xmpp-contact');
                        this.$el.html(converse.templates.requesting_contact(
                            _.extend(item.toJSON(), {
                                'desc_accept': __("Click to accept this contact request"),
                                'desc_decline': __("Click to decline this contact request"),
                                'allow_chat_pending_contacts': converse.allow_chat_pending_contacts
                            })
                        ));
                        converse.controlboxtoggle.showControlBox();
                    } else if (subscription === 'both' || subscription === 'to') {
                        this.$el.addClass('current-xmpp-contact');
                        this.$el.removeClass(_.without(['both', 'to'], subscription)[0]).addClass(subscription);
                        this.$el.html(converse.templates.roster_item(
                            _.extend(item.toJSON(), {
                                'desc_status': STATUSES[chat_status||'offline'],
                                'desc_chat': __('Click to chat with this contact'),
                                'desc_remove': __('Click to remove this contact'),
                                'title_fullname': __('Name'),
                                'allow_contact_removal': converse.allow_contact_removal
                            })
                        ));
                    }
                    return this;
                },

                isGroupCollapsed: function () {
                    /* Check whether the group in which this contact appears is
                     * collapsed.
                     */
                    // XXX: this sucks and is fragile.
                    // It's because I tried to do the "right thing"
                    // and use definition lists to represent roster groups.
                    // If roster group items were inside the group elements, we
                    // would simplify things by not having to check whether the
                    // group is collapsed or not.
                    var name = this.$el.prevAll('dt:first').data('group');
                    var group = converse.rosterview.model.where({'name': name})[0];
                    if (group.get('state') === converse.CLOSED) {
                        return true;
                    }
                    return false;
                },

                mayBeShown: function () {
                    /* Return a boolean indicating whether this contact should
                     * generally be visible in the roster.
                     *
                     * It doesn't check for the more specific case of whether
                     * the group it's in is collapsed (see isGroupCollapsed).
                     */
                    var chatStatus = this.model.get('chat_status');
                    if ((converse.show_only_online_users && chatStatus !== 'online') ||
                        (converse.hide_offline_users && chatStatus === 'offline')) {
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

                openChat: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    return converse.chatboxviews.showChat(this.model.attributes);
                },

                removeContact: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (!converse.allow_contact_removal) { return; }
                    var result = confirm(__("Are you sure you want to remove this contact?"));
                    if (result === true) {
                        var iq = $iq({type: 'set'})
                            .c('query', {xmlns: Strophe.NS.ROSTER})
                            .c('item', {jid: this.model.get('jid'), subscription: "remove"});
                        converse.connection.sendIQ(iq,
                            function (iq) {
                                this.model.destroy();
                                this.remove();
                            }.bind(this),
                            function (err) {
                                alert(__("Sorry, there was an error while trying to remove "+name+" as a contact."));
                                converse.log(err);
                            }
                        );
                    }
                },

                acceptRequest: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    converse.roster.sendContactAddIQ(
                        this.model.get('jid'),
                        this.model.get('fullname'),
                        [],
                        function () { this.model.authorize().subscribe(); }.bind(this)
                    );
                },

                declineRequest: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var result = confirm(__("Are you sure you want to decline this contact request?"));
                    if (result === true) {
                        this.model.unauthorize().destroy();
                    }
                    return this;
                }
            });


            converse.RosterGroup = Backbone.Model.extend({
                initialize: function (attributes, options) {
                    this.set(_.extend({
                        description: DESC_GROUP_TOGGLE,
                        state: converse.OPENED
                    }, attributes));
                    // Collection of contacts belonging to this group.
                    this.contacts = new converse.RosterContacts();
                }
            });


            converse.RosterGroupView = Backbone.Overview.extend({
                tagName: 'dt',
                className: 'roster-group',
                events: {
                    "click a.group-toggle": "toggle"
                },

                initialize: function () {
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
                    converse.roster.on('change:groups', this.onContactGroupChange, this);
                },

                render: function () {
                    this.$el.attr('data-group', this.model.get('name'));
                    this.$el.html(
                        $(converse.templates.group_header({
                            label_group: this.model.get('name'),
                            desc_group_toggle: this.model.get('description'),
                            toggle_state: this.model.get('state')
                        }))
                    );
                    return this;
                },

                addContact: function (contact) {
                    var view = new converse.RosterContactView({model: contact});
                    this.add(contact.get('id'), view);
                    view = this.positionContact(contact).render();
                    if (view.mayBeShown()) {
                        if (this.model.get('state') === converse.CLOSED) {
                            if (view.$el[0].style.display !== "none") { view.$el.hide(); }
                            if (!this.$el.is(':visible')) { this.$el.show(); }
                        } else {
                            if (this.$el[0].style.display !== "block") { this.show(); }
                        }
                    }
                },

                positionContact: function (contact) {
                    /* Place the contact's DOM element in the correct alphabetical
                     * position amongst the other contacts in this group.
                     */
                    var view = this.get(contact.get('id'));
                    var index = this.model.contacts.indexOf(contact);
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

                show: function () {
                    this.$el.show();
                    _.each(this.getAll(), function (view) {
                        if (view.mayBeShown() && !view.isGroupCollapsed()) {
                            view.$el.show();
                        }
                    });
                    return this;
                },

                hide: function () {
                    this.$el.nextUntil('dt').addBack().hide();
                },

                filter: function (q, type) {
                    /* Filter the group's contacts based on the query "q".
                     * The query is matched against the contact's full name.
                     * If all contacts are filtered out (i.e. hidden), then the
                     * group must be filtered out as well.
                     */
                    var matches;
                    if (q.length === 0) {
                        if (this.model.get('state') === converse.OPENED) {
                            this.model.contacts.each(function (item) {
                                var view = this.get(item.get('id'));
                                if (view.mayBeShown() && !view.isGroupCollapsed()) {
                                    view.$el.show();
                                }
                            }.bind(this));
                        }
                        this.showIfNecessary();
                    } else {
                        q = q.toLowerCase();
                        if (type === 'state') {
                            matches = this.model.contacts.filter(
                                utils.contains.not('chat_status', q)
                            );
                        } else  {
                            matches = this.model.contacts.filter(
                                utils.contains.not('fullname', q)
                            );
                        }
                        if (matches.length === this.model.contacts.length) {
                            // hide the whole group
                            this.hide();
                        } else {
                            _.each(matches, function (item) {
                                this.get(item.get('id')).$el.hide();
                            }.bind(this));
                            _.each(this.model.contacts.reject(utils.contains.not('fullname', q)), function (item) {
                                this.get(item.get('id')).$el.show();
                            }.bind(this));
                            this.showIfNecessary();
                        }
                    }
                },

                showIfNecessary: function () {
                    if (!this.$el.is(':visible') && this.model.contacts.length > 0) {
                        this.$el.show();
                    }
                },

                toggle: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $el = $(ev.target);
                    if ($el.hasClass("icon-opened")) {
                        this.$el.nextUntil('dt').slideUp();
                        this.model.save({state: converse.CLOSED});
                        $el.removeClass("icon-opened").addClass("icon-closed");
                    } else {
                        $el.removeClass("icon-closed").addClass("icon-opened");
                        this.model.save({state: converse.OPENED});
                        this.filter(
                            converse.rosterview.$('.roster-filter').val() || '',
                            converse.rosterview.$('.filter-type').val()
                        );
                    }
                },

                onContactGroupChange: function (contact) {
                    var in_this_group = _.contains(contact.get('groups'), this.model.get('name'));
                    var cid = contact.get('id');
                    var in_this_overview = !this.get(cid);
                    if (in_this_group && !in_this_overview) {
                        this.model.contacts.remove(cid);
                    } else if (!in_this_group && in_this_overview) {
                        this.addContact(contact);
                    }
                },

                onContactSubscriptionChange: function (contact) {
                    if ((this.model.get('name') === HEADER_PENDING_CONTACTS) && contact.get('subscription') !== 'from') {
                        this.model.contacts.remove(contact.get('id'));
                    }
                },

                onContactRequestChange: function (contact) {
                    if ((this.model.get('name') === HEADER_REQUESTING_CONTACTS) && !contact.get('requesting')) {
                        this.model.contacts.remove(contact.get('id'));
                    }
                },

                onRemove: function (contact) {
                    this.remove(contact.get('id'));
                    if (this.model.contacts.length === 0) {
                        this.$el.hide();
                    }
                }
            });


            converse.RosterGroups = Backbone.Collection.extend({
                model: converse.RosterGroup,
                comparator: function (a, b) {
                    /* Groups are sorted alphabetically, ignoring case.
                     * However, Ungrouped, Requesting Contacts and Pending Contacts
                     * appear last and in that order. */
                    a = a.get('name');
                    b = b.get('name');
                    var special_groups = _.keys(HEADER_WEIGHTS);
                    var a_is_special = _.contains(special_groups, a);
                    var b_is_special = _.contains(special_groups, b);
                    if (!a_is_special && !b_is_special ) {
                        return a.toLowerCase() < b.toLowerCase() ? -1 : (a.toLowerCase() > b.toLowerCase() ? 1 : 0);
                    } else if (a_is_special && b_is_special) {
                        return HEADER_WEIGHTS[a] < HEADER_WEIGHTS[b] ? -1 : (HEADER_WEIGHTS[a] > HEADER_WEIGHTS[b] ? 1 : 0);
                    } else if (!a_is_special && b_is_special) {
                        return (b === HEADER_CURRENT_CONTACTS) ? 1 : -1;
                    } else if (a_is_special && !b_is_special) {
                        return (a === HEADER_CURRENT_CONTACTS) ? -1 : 1;
                    }
                }
            });
        }
    });
}));
