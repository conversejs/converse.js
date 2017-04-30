// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define, window */

(function (root, factory) {
    define(["converse-core",
            "tpl!chatbox_minimize",
            "tpl!toggle_chats",
            "tpl!trimmed_chat",
            "tpl!chats_panel",
            "converse-controlbox",
            "converse-chatview",
            "converse-muc"
    ], factory);
}(this, function (
        converse,
        tpl_chatbox_minimize,
        tpl_toggle_chats,
        tpl_trimmed_chat,
        tpl_chats_panel
    ) {
    "use strict";
    var $ = converse.env.jQuery,
        _ = converse.env._,
        Backbone = converse.env.Backbone,
        b64_sha1 = converse.env.b64_sha1,
        moment = converse.env.moment;

    converse.plugins.add('converse-minimize', {
        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            initChatBoxes: function () {
                var _converse = this.__super__._converse;
                var result = this.__super__.initChatBoxes.apply(this, arguments);
                _converse.minimized_chats = new _converse.MinimizedChats({
                    model: _converse.chatboxes
                });
                return result;
            },

            registerGlobalEventHandlers: function () {
                var _converse = this.__super__._converse;
                $(window).on("resize", _.debounce(function (ev) {
                    if (_converse.connection.connected) {
                        _converse.chatboxviews.trimChats();
                    }
                }, 200));
                return this.__super__.registerGlobalEventHandlers.apply(this, arguments);
            },

            ChatBox: {
                initialize: function () {
                    this.__super__.initialize.apply(this, arguments);
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

            ChatBoxView: {
                events: {
                    'click .toggle-chatbox-button': 'minimize',
                },

                initialize: function () {
                    this.model.on('change:minimized', this.onMinimizedChanged, this);
                    return this.__super__.initialize.apply(this, arguments);
                },

                _show: function () {
                    var _converse = this.__super__._converse;
                    if (!this.model.get('minimized')) {
                        this.__super__._show.apply(this, arguments);
                        _converse.chatboxviews.trimChats(this);
                    } else {
                        this.minimize();
                    }
                },

                isNewMessageHidden: function () {
                    return this.model.get('minimized') ||
                        this.__super__.isNewMessageHidden.apply(this, arguments);
                },

                shouldShowOnTextMessage: function () {
                    return !this.model.get('minimized') &&
                        this.__super__.shouldShowOnTextMessage.apply(this, arguments);
                },

                setChatBoxHeight: function (height) {
                    if (!this.model.get('minimized')) {
                        return this.__super__.setChatBoxHeight.apply(this, arguments);
                    }
                },

                setChatBoxWidth: function (width) {
                    if (!this.model.get('minimized')) {
                        return this.__super__.setChatBoxWidth.apply(this, arguments);
                    }
                },

                onMinimizedChanged: function (item) {
                    if (item.get('minimized')) {
                        this.minimize();
                    } else {
                        this.maximize();
                    }
                },

                maximize: function () {
                    // Restores a minimized chat box
                    var _converse = this.__super__._converse;
                    this.$el.insertAfter(_converse.chatboxviews.get("controlbox").$el);
                    if (!this.model.isScrolledUp()) {
                        this.model.clearUnreadMsgCounter();
                    }
                    this.show();
                    _converse.emit('chatBoxMaximized', this);
                    return this;
                },

                minimize: function (ev) {
                    var _converse = this.__super__._converse;
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    // save the scroll position to restore it on maximize
                    this.model.save({'scroll': this.$content.scrollTop()});
                    this.setChatState(_converse.INACTIVE).model.minimize();
                    this.hide();
                    _converse.emit('chatBoxMinimized', this);
                },
            },

            ChatRoomView: {
                events: {
                    'click .toggle-chatbox-button': 'minimize',
                },

                initialize: function () {
                    this.model.on('change:minimized', function (item) {
                        if (item.get('minimized')) {
                            this.hide();
                        } else {
                            this.maximize();
                        }
                    }, this);
                    var result = this.__super__.initialize.apply(this, arguments);
                    if (this.model.get('minimized')) {
                        this.hide();
                    }
                    return result;
                },

                generateHeadingHTML: function () {
                    var _converse = this.__super__._converse,
                        __ = _converse.__;
                    var html = this.__super__.generateHeadingHTML.apply(this, arguments);
                    var div = document.createElement('div');
                    div.innerHTML = html;
                    var el = tpl_chatbox_minimize(
                        {info_minimize: __('Minimize this chat box')}
                    );
                    var button = div.querySelector('.close-chatbox-button');
                    button.insertAdjacentHTML('afterend', el);
                    return div.innerHTML;
                }
            },

            ChatBoxes: {
                chatBoxMayBeShown: function (chatbox) {
                    return this.__super__.chatBoxMayBeShown.apply(this, arguments) &&
                           !chatbox.get('minimized');
                },
            },

            ChatBoxViews: {
                showChat: function (attrs) {
                    /* Find the chat box and show it. If it doesn't exist, create it.
                     */
                    var chatbox = this.__super__.showChat.apply(this, arguments);
                    var maximize = _.isUndefined(attrs.maximize) ? true : attrs.maximize;
                    if (chatbox.get('minimized') && maximize) {
                        chatbox.maximize();
                    }
                    return chatbox;
                },

                getChatBoxWidth: function (view) {
                    if (!view.model.get('minimized') && view.$el.is(':visible')) {
                        return view.$el.outerWidth(true);
                    }
                    return 0;
                },

                getShownChats: function () {
                    return this.filter(function (view) {
                        // The controlbox can take a while to close,
                        // so we need to check its state. That's why we checked
                        // the 'closed' state.
                        return (
                            !view.model.get('minimized') &&
                            !view.model.get('closed') &&
                            view.$el.is(':visible')
                        );
                    });
                },

                trimChats: function (newchat) {
                    /* This method is called when a newly created chat box will
                     * be shown.
                     *
                     * It checks whether there is enough space on the page to show
                     * another chat box. Otherwise it minimizes the oldest chat box
                     * to create space.
                     */
                    var _converse = this.__super__._converse;
                    var shown_chats = this.getShownChats();
                    if (_converse.no_trimming || shown_chats.length <= 1) {
                        return;
                    }
                    if (this.getChatBoxWidth(shown_chats[0]) === $('body').outerWidth(true)) {
                        // If the chats shown are the same width as the body,
                        // then we're in responsive mode and the chats are
                        // fullscreen. In this case we don't trim.
                        return;
                    }
                    var oldest_chat, boxes_width, view,
                        $minimized = _converse.minimized_chats.$el,
                        minimized_width = _.includes(this.model.pluck('minimized'), true) ? $minimized.outerWidth(true) : 0,
                        new_id = newchat ? newchat.model.get('id') : null;

                    boxes_width = _.reduce(this.xget(new_id), function (memo, view) {
                        return memo + this.getChatBoxWidth(view);
                    }.bind(this), newchat ? newchat.$el.outerWidth(true) : 0);

                    if ((minimized_width + boxes_width) > $('body').outerWidth(true)) {
                        oldest_chat = this.getOldestMaximizedChat([new_id]);
                        if (oldest_chat) {
                            // We hide the chat immediately, because waiting
                            // for the event to fire (and letting the
                            // ChatBoxView hide it then) causes race
                            // conditions.
                            view = this.get(oldest_chat.get('id'));
                            if (view) {
                                view.hide();
                            }
                            oldest_chat.minimize();
                        }
                    }
                },

                getOldestMaximizedChat: function (exclude_ids) {
                    // Get oldest view (if its id is not excluded)
                    exclude_ids.push('controlbox');
                    var i = 0;
                    var model = this.model.sort().at(i);
                    while (_.includes(exclude_ids, model.get('id')) ||
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
             * loaded by Converse.js's plugin machinery.
             */
            var _converse = this._converse,
                __ = _converse.__;

            // Add new HTML templates.
            _converse.templates.chatbox_minimize = tpl_chatbox_minimize;
            _converse.templates.toggle_chats = tpl_toggle_chats;
            _converse.templates.trimmed_chat = tpl_trimmed_chat;
            _converse.templates.chats_panel = tpl_chats_panel;

            this.updateSettings({
                no_trimming: false, // Set to true for phantomjs tests (where browser apparently has no width)
            });

            _converse.MinimizedChatBoxView = Backbone.View.extend({
                tagName: 'div',
                className: 'chat-head',
                events: {
                    'click .close-chatbox-button': 'close',
                    'click .restore-chat': 'restore'
                },

                initialize: function () {
                    this.model.on('change:num_unread', this.updateUnreadMessagesCounter, this);
                },

                render: function () {
                    var data = _.extend(
                        this.model.toJSON(),
                        { 'tooltip': __('Click to restore this chat') }
                    );
                    if (this.model.get('type') === 'chatroom') {
                        data.title = this.model.get('name');
                        this.$el.addClass('chat-head-chatroom');
                    } else {
                        data.title = this.model.get('fullname');
                        this.$el.addClass('chat-head-chatbox');
                    }
                    return this.$el.html(tpl_trimmed_chat(data));
                },

                updateUnreadMessagesCounter: function () {
                    this.render();
                },

                close: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.remove();
                    var view = _converse.chatboxviews.get(this.model.get('id'));
                    if (view) {
                        // This will call model.destroy(), removing it from the
                        // collection and will also emit 'chatBoxClosed'
                        view.close();
                    } else {
                        this.model.destroy();
                        _converse.emit('chatBoxClosed', this);
                    }
                    return this;
                },

                restore: _.debounce(function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.model.off('change:num_unread', null, this);
                    this.remove();
                    this.model.maximize();
                }, 200, {'leading': true})
            });


            _converse.MinimizedChats = Backbone.Overview.extend({
                tagName: 'div',
                id: "minimized-chats",
                className: 'hidden',
                events: {
                    "click #toggle-minimized-chats": "toggle"
                },

                initialize: function () {
                    this.render();
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
                    this.toggleview = new _converse.MinimizedChatsToggleView({
                        model: new _converse.MinimizedChatsToggle()
                    });
                    var id = b64_sha1('converse.minchatstoggle'+_converse.bare_jid);
                    this.toggleview.model.id = id; // Appears to be necessary for backbone.browserStorage
                    this.toggleview.model.browserStorage = new Backbone.BrowserStorage[_converse.storage](id);
                    this.toggleview.model.fetch();
                },

                render: function () {
                    if (!this.el.parentElement) {
                        this.el.innerHTML = tpl_chats_panel();
                        _converse.chatboxviews.el.appendChild(this.el);
                    }
                    if (this.keys().length === 0) {
                        this.el.classList.add('hidden');
                        _converse.chatboxviews.trimChats.bind(_converse.chatboxviews);
                    } else if (this.keys().length > 0 && !this.$el.is(':visible')) {
                        this.el.classList.remove('hidden');
                        _converse.chatboxviews.trimChats();
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
                    var view = new _converse.MinimizedChatBoxView({model: item});
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
                    this.toggleview.model.save({'num_unread': count});
                    this.render();
                }
            });


            _converse.MinimizedChatsToggle = Backbone.Model.extend({
                initialize: function () {
                    this.set({
                        'collapsed': this.get('collapsed') || false,
                        'num_minimized': this.get('num_minimized') || 0,
                        'num_unread':  this.get('num_unread') || 0
                    });
                }
            });


            _converse.MinimizedChatsToggleView = Backbone.View.extend({
                el: '#toggle-minimized-chats',

                initialize: function () {
                    this.model.on('change:num_minimized', this.render, this);
                    this.model.on('change:num_unread', this.render, this);
                    this.$flyout = this.$el.siblings('.minimized-chats-flyout');
                },

                render: function () {
                    this.$el.html(tpl_toggle_chats(
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

            var renderMinimizeButton = function (view) {
                // Inserts a "minimize" button in the chatview's header
                var $el = view.$el.find('.toggle-chatbox-button');
                var $new_el = tpl_chatbox_minimize(
                    {info_minimize: __('Minimize this chat box')}
                );
                if ($el.length) {
                    $el.replaceWith($new_el);
                } else {
                    view.$el.find('.close-chatbox-button').after($new_el);
                }
            };
            _converse.on('chatBoxOpened', renderMinimizeButton);

            _converse.on('controlBoxOpened', function (chatbox) {
                // Wrapped in anon method because at scan time, chatboxviews
                // attr not set yet.
                if (_converse.connection.connected) {
                    _converse.chatboxviews.trimChats(chatbox);
                }
            });

            var logOut = function () {
                _converse.minimized_chats.remove();
            };
            _converse.on('logout', logOut);
        }
    });
}));
