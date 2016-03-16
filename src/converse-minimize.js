// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define, window */

(function (root, factory) {
    define("converse-minimize", [
            "converse-core",
            "converse-api",
    ], factory);
}(this, function (converse, converse_api) {
    "use strict";
    var $ = converse_api.env.jQuery,
        _ = converse_api.env._,
        b64_sha1 = converse_api.env.b64_sha1,
        moment = converse_api.env.moment,
        utils = converse_api.env.utils,
        __ = utils.__.bind(converse);

    converse_api.plugins.add('minimize', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            _tearDown: function () {
                this._super._tearDown.apply(this, arguments);
                if (this.minimized_chats) {
                    this.minimized_chats.undelegateEvents().model.reset();
                    this.minimized_chats.removeAll(); // Remove sub-views
                    this.minimized_chats.tearDown().remove(); // Remove overview
                    delete this.minimized_chats;
                }
                return this;
            },

            onConnected: function () {
                converse.minimized_chats = new converse.MinimizedChats({
                    model: converse.chatboxes
                });
                return this._super.onConnected.apply(this, arguments);
            },

            registerGlobalEventHandlers: function () {
                this._super.registerGlobalEventHandlers.apply(this, arguments);

                $(window).on("resize", _.debounce(function (ev) {
                    converse.chatboxviews.trimChats();
                }, 200));
            },

            wrappedChatBox: function (chatbox) {
                /* Wrap a chatbox for outside consumption (i.e. so that it can be
                * returned via the API.
                */
                if (!chatbox) { return; }
                var box = this._super.wrappedChatBox.apply(this, arguments);
                box.maximize = chatbox.maximize.bind(chatbox);
                box.minimize = chatbox.minimize.bind(chatbox);
                return box;
            },

            ChatBox: {
                initialize: function () {
                    this._super.initialize.apply(this, arguments);
                    if (this.get('id') === 'controlbox') {
                        return;
                    }
                    this.save({
                        'minimized': this.get('minimized') || false,
                        'time_minimized': this.get('time_minimized') || moment(),
                    });
                },

                maximize: function () {
                    this.save({
                        'minimized': false,
                        'time_opened': moment().valueOf()
                    });
                },

                minimize: function () {
                    this.save({
                        'minimized': true,
                        'time_minimized': moment().format()
                    });
                },
            },

            ChatBoxes: {
                chatBoxShouldBeShown: function (chatbox) {
                    return this._super.chatBoxShouldBeShown.apply(this, arguments) && 
                           !chatbox.get('minimized');
                },
            },

            ChatBoxViews: {

                showChat: function (attrs) {
                    /* Find the chat box and show it. If it doesn't exist, create it.
                     */
                    var chatbox = this._super.showChat.apply(this, arguments);
                    if (chatbox.get('minimized')) {
                        chatbox.maximize();
                    }
                    return chatbox;
                },

                onChatBoxAdded: function (item) {
                    this.trimChats(this._super.onChatBoxAdded.apply(this, arguments));
                },

                getChatBoxWidth: function (view) {
                    if (!view.model.get('minimized') && view.$el.is(':visible')) {
                        return view.$el.outerWidth(true);
                    }
                    return 0;
                },

                trimChats: function (newchat) {
                    /* This method is called when a newly created chat box will
                    * be shown.
                    *
                    * It checks whether there is enough space on the page to show
                    * another chat box. Otherwise it minimizes the oldest chat box
                    * to create space.
                    */
                    if (converse.no_trimming || (this.model.length <= 1)) {
                        return;
                    }
                    var oldest_chat, boxes_width,
                        $minimized = converse.minimized_chats.$el,
                        minimized_width = _.contains(this.model.pluck('minimized'), true) ? $minimized.outerWidth(true) : 0,
                        new_id = newchat ? newchat.model.get('id') : null;

                    boxes_width = _.reduce(this.xget(new_id), function (memo, view) {
                        return memo + this.getChatBoxWidth(view);
                    }.bind(this), newchat ? newchat.$el.outerWidth(true) : 0);

                    if ((minimized_width + boxes_width) > $('body').outerWidth(true)) {
                        oldest_chat = this.getOldestMaximizedChat([new_id]);
                        if (oldest_chat) {
                            oldest_chat.minimize();
                        }
                    }
                },

                getOldestMaximizedChat: function (exclude_ids) {
                    // Get oldest view (if its id is not excluded)
                    var i = 0;
                    var model = this.model.sort().at(i);
                    while (_.contains(exclude_ids, model.get('id')) ||
                        model.get('minimized') === true) {
                        i++;
                        model = this.model.at(i);
                        if (!model) {
                            return null;
                        }
                    }
                    return model;
                }
            }
        },


        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */

            this.updateSettings({
                no_trimming: false, // Set to true for phantomjs tests (where browser apparently has no width)
            });

            converse.MinimizedChatBoxView = Backbone.View.extend({
                tagName: 'div',
                className: 'chat-head',
                events: {
                    'click .close-chatbox-button': 'close',
                    'click .restore-chat': 'restore'
                },

                initialize: function () {
                    this.model.messages.on('add', function (m) {
                        if (m.get('message')) {
                            this.updateUnreadMessagesCounter();
                        }
                    }, this);
                    this.model.on('change:minimized', this.clearUnreadMessagesCounter, this);
                },

                render: function () {
                    var data = _.extend(
                        this.model.toJSON(),
                        { 'tooltip': __('Click to restore this chat') }
                    );
                    if (this.model.get('chatroom')) {
                        data.title = this.model.get('name');
                        this.$el.addClass('chat-head-chatroom');
                    } else {
                        data.title = this.model.get('fullname');
                        this.$el.addClass('chat-head-chatbox');
                    }
                    return this.$el.html(converse.templates.trimmed_chat(data));
                },

                clearUnreadMessagesCounter: function () {
                    this.model.set({'num_unread': 0});
                    this.render();
                },

                updateUnreadMessagesCounter: function () {
                    this.model.set({'num_unread': this.model.get('num_unread') + 1});
                    this.render();
                },

                close: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.remove();
                    this.model.destroy();
                    converse.emit('chatBoxClosed', this);
                    return this;
                },

                restore: _.debounce(function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.model.messages.off('add',null,this);
                    this.remove();
                    this.model.maximize();
                }, 200, true)
            });


            converse.MinimizedChats = Backbone.Overview.extend({
                el: "#minimized-chats",
                events: {
                    "click #toggle-minimized-chats": "toggle"
                },

                initialize: function () {
                    this.initToggle();
                    this.model.on("add", this.onChanged, this);
                    this.model.on("destroy", this.removeChat, this);
                    this.model.on("change:minimized", this.onChanged, this);
                    this.model.on('change:num_unread', this.updateUnreadMessagesCounter, this);
                },

                tearDown: function () {
                    this.model.off("add", this.onChanged);
                    this.model.off("destroy", this.removeChat);
                    this.model.off("change:minimized", this.onChanged);
                    this.model.off('change:num_unread', this.updateUnreadMessagesCounter);
                    return this;
                },

                initToggle: function () {
                    this.toggleview = new converse.MinimizedChatsToggleView({
                        model: new converse.MinimizedChatsToggle()
                    });
                    var id = b64_sha1('converse.minchatstoggle'+converse.bare_jid);
                    this.toggleview.model.id = id; // Appears to be necessary for backbone.browserStorage
                    this.toggleview.model.browserStorage = new Backbone.BrowserStorage[converse.storage](id);
                    this.toggleview.model.fetch();
                },

                render: function () {
                    if (this.keys().length === 0) {
                        this.$el.hide('fast', converse.chatboxviews.trimChats.bind(converse.chatboxviews));
                    } else if (this.keys().length === 1) {
                        this.$el.show('fast', converse.chatboxviews.trimChats.bind(converse.chatboxviews));
                    }
                    return this.$el;
                },

                toggle: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.toggleview.model.save({'collapsed': !this.toggleview.model.get('collapsed')});
                    this.$('.minimized-chats-flyout').toggle();
                },

                onChanged: function (item) {
                    if (item.get('id') === 'controlbox')  {
                        // The ControlBox has it's own minimize toggle
                        return;
                    }
                    if (item.get('minimized')) {
                        this.addChat(item);
                    } else if (this.get(item.get('id'))) {
                        this.removeChat(item);
                    }
                },

                addChat: function (item) {
                    var existing = this.get(item.get('id'));
                    if (existing && existing.$el.parent().length !== 0) {
                        return;
                    }
                    var view = new converse.MinimizedChatBoxView({model: item});
                    this.$('.minimized-chats-flyout').append(view.render());
                    this.add(item.get('id'), view);
                    this.toggleview.model.set({'num_minimized': this.keys().length});
                    this.render();
                },

                removeChat: function (item) {
                    this.remove(item.get('id'));
                    this.toggleview.model.set({'num_minimized': this.keys().length});
                    this.render();
                },

                updateUnreadMessagesCounter: function () {
                    var ls = this.model.pluck('num_unread'),
                        count = 0, i;
                    for (i=0; i<ls.length; i++) { count += ls[i]; }
                    this.toggleview.model.set({'num_unread': count});
                    this.render();
                }
            });


            converse.MinimizedChatsToggle = Backbone.Model.extend({
                initialize: function () {
                    this.set({
                        'collapsed': this.get('collapsed') || false,
                        'num_minimized': this.get('num_minimized') || 0,
                        'num_unread':  this.get('num_unread') || 0
                    });
                }
            });


            converse.MinimizedChatsToggleView = Backbone.View.extend({
                el: '#toggle-minimized-chats',

                initialize: function () {
                    this.model.on('change:num_minimized', this.render, this);
                    this.model.on('change:num_unread', this.render, this);
                    this.$flyout = this.$el.siblings('.minimized-chats-flyout');
                },

                render: function () {
                    this.$el.html(converse.templates.toggle_chats(
                        _.extend(this.model.toJSON(), {
                            'Minimized': __('Minimized')
                        })
                    ));
                    if (this.model.get('collapsed')) {
                        this.$flyout.hide();
                    } else {
                        this.$flyout.show();
                    }
                    return this.$el;
                }
            });

            converse.on('controlBoxOpened', function (evt, chatbox) {
                // Wrapped in anon method because at scan time, chatboxviews
                // attr not set yet.
                converse.chatboxviews.trimChats(chatbox);
            });
        }
    });
}));
