// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2013-2018, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)

import "converse-chatview";
import converse from "@converse/headless/converse-core";
import tpl_chatbox_minimize from "templates/chatbox_minimize.html";
import tpl_chats_panel from "templates/chats_panel.html";
import tpl_toggle_chats from "templates/toggle_chats.html";
import tpl_trimmed_chat from "templates/trimmed_chat.html";


const { _ , Backbone, Promise, Strophe, moment } = converse.env;
const u = converse.env.utils;

converse.plugins.add('converse-minimize', {
    /* Optional dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin. They are called "optional" because they might not be
     * available, in which case any overrides applicable to them will be
     * ignored.
     *
     * It's possible however to make optional dependencies non-optional.
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found.
     *
     * NB: These plugins need to have already been loaded via require.js.
     */
    dependencies: ["converse-chatview", "converse-controlbox", "converse-muc", "converse-muc-views", "converse-headline"],

    enabled (_converse) {
        return _converse.view_mode === 'overlayed';
    },

    overrides: {
        // Overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        //
        // New functions which don't exist yet can also be added.

        ChatBox: {
            initialize () {
                this.__super__.initialize.apply(this, arguments);
                this.on('show', this.maximize, this);

                if (this.get('id') === 'controlbox') {
                    return;
                }
                this.save({
                    'minimized': this.get('minimized') || false,
                    'time_minimized': this.get('time_minimized') || moment(),
                }, {'patch': true});
            },

            maximize () {
                u.safeSave(this, {
                    'minimized': false,
                    'time_opened': moment().valueOf()
                }, {'patch': true});
            },

            minimize () {
                u.safeSave(this, {
                    'minimized': true,
                    'time_minimized': moment().format()
                }, {'patch': true});
            },
        },

        ChatBoxView: {
            events: {
                'click .toggle-chatbox-button': 'minimize',
            },

            initialize () {
                this.model.on('change:minimized', this.onMinimizedChanged, this);
                return this.__super__.initialize.apply(this, arguments);
            },

            _show () {
                const { _converse } = this.__super__;
                if (_converse.view_mode !== 'overlayed') {
                    return this.__super__._show.apply(this, arguments);
                } else if (!this.model.get('minimized')) {
                    this.__super__._show.apply(this, arguments);
                    _converse.chatboxviews.trimChats(this);
                } else {
                    this.minimize();
                }
            },

            isNewMessageHidden () {
                return this.model.get('minimized') ||
                    this.__super__.isNewMessageHidden.apply(this, arguments);
            },

            shouldShowOnTextMessage () {
                return !this.model.get('minimized') &&
                    this.__super__.shouldShowOnTextMessage.apply(this, arguments);
            },

            setChatBoxHeight (height) {
                if (!this.model.get('minimized')) {
                    return this.__super__.setChatBoxHeight.apply(this, arguments);
                }
            },

            setChatBoxWidth (width) {
                if (!this.model.get('minimized')) {
                    return this.__super__.setChatBoxWidth.apply(this, arguments);
                }
            },

            onMinimizedChanged (item) {
                if (item.get('minimized')) {
                    this.minimize();
                } else {
                    this.maximize();
                }
            },

            maximize () {
                // Restores a minimized chat box
                const { _converse } = this.__super__;
                this.insertIntoDOM();

                if (!this.model.isScrolledUp()) {
                    this.model.clearUnreadMsgCounter();
                }
                this.show();
                this.__super__._converse.emit('chatBoxMaximized', this);
                return this;
            },

            minimize (ev) {
                const { _converse } = this.__super__;
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                // save the scroll position to restore it on maximize
                if (this.model.collection && this.model.collection.browserStorage) {
                    this.model.save({'scroll': this.content.scrollTop}, {'patch': true});
                } else {
                    this.model.set({'scroll': this.content.scrollTop});
                }
                this.setChatState(_converse.INACTIVE).model.minimize();
                this.hide();
                _converse.emit('chatBoxMinimized', this);
            },
        },

        ChatBoxHeading: {

            render () {
                const { _converse } = this.__super__,
                    { __ } = _converse;
                const result = this.__super__.render.apply(this, arguments);
                const new_html = tpl_chatbox_minimize(
                    {info_minimize: __('Minimize this chat box')}
                );
                const el = this.el.querySelector('.toggle-chatbox-button');
                if (el) {
                    el.outerHTML = new_html;
                } else {
                    const button = this.el.querySelector('.close-chatbox-button');
                    button.insertAdjacentHTML('afterEnd', new_html);
                }
            }
        },

        ChatRoomView: {
            events: {
                'click .toggle-chatbox-button': 'minimize',
            },

            initialize () {
                this.model.on('change:minimized', function (item) {
                    if (item.get('minimized')) {
                        this.hide();
                    } else {
                        this.maximize();
                    }
                }, this);
                const result = this.__super__.initialize.apply(this, arguments);
                if (this.model.get('minimized')) {
                    this.hide();
                }
                return result;
            },

            generateHeadingHTML () {
                const { _converse } = this.__super__,
                    { __ } = _converse;
                const html = this.__super__.generateHeadingHTML.apply(this, arguments);
                const div = document.createElement('div');
                div.innerHTML = html;
                const button = div.querySelector('.close-chatbox-button');
                button.insertAdjacentHTML('afterend',
                    tpl_chatbox_minimize({
                        'info_minimize': __('Minimize this chat box')
                    })
                );
                return div.innerHTML;
            }
        },

        ChatBoxes: {
            chatBoxMayBeShown (chatbox) {
                return this.__super__.chatBoxMayBeShown.apply(this, arguments) &&
                       !chatbox.get('minimized');
            },
        },

        ChatBoxViews: {
            getChatBoxWidth (view) {
                if (!view.model.get('minimized') && u.isVisible(view.el)) {
                    return u.getOuterWidth(view.el, true);
                }
                return 0;
            },

            getShownChats () {
                return this.filter((view) =>
                    // The controlbox can take a while to close,
                    // so we need to check its state. That's why we checked
                    // the 'closed' state.
                    !view.model.get('minimized') &&
                        !view.model.get('closed') &&
                        u.isVisible(view.el)
                );
            },

            async trimChats (newchat) {
                /* This method is called when a newly created chat box will
                 * be shown.
                 *
                 * It checks whether there is enough space on the page to show
                 * another chat box. Otherwise it minimizes the oldest chat box
                 * to create space.
                 */
                const { _converse } = this.__super__,
                      shown_chats = this.getShownChats(),
                      body_width = u.getOuterWidth(document.querySelector('body'), true);

                if (_converse.no_trimming || shown_chats.length <= 1) {
                    return;
                }
                if (this.getChatBoxWidth(shown_chats[0]) === body_width) {
                    // If the chats shown are the same width as the body,
                    // then we're in responsive mode and the chats are
                    // fullscreen. In this case we don't trim.
                    return;
                }
                await _converse.api.waitUntil('minimizedChatsInitialized');
                const minimized_el = _.get(_converse.minimized_chats, 'el'),
                      new_id = newchat ? newchat.model.get('id') : null;

                if (minimized_el) {
                    const minimized_width = _.includes(this.model.pluck('minimized'), true) ?
                        u.getOuterWidth(minimized_el, true) : 0;

                    const boxes_width = _.reduce(
                        this.xget(new_id),
                        (memo, view) => memo + this.getChatBoxWidth(view),
                        newchat ? u.getOuterWidth(newchat.el, true) : 0
                    );
                    if ((minimized_width + boxes_width) > body_width) {
                        const oldest_chat = this.getOldestMaximizedChat([new_id]);
                        if (oldest_chat) {
                            // We hide the chat immediately, because waiting
                            // for the event to fire (and letting the
                            // ChatBoxView hide it then) causes race
                            // conditions.
                            const view = this.get(oldest_chat.get('id'));
                            if (view) {
                                view.hide();
                            }
                            oldest_chat.minimize();
                        }
                    }
                }
            },

            getOldestMaximizedChat (exclude_ids) {
                // Get oldest view (if its id is not excluded)
                exclude_ids.push('controlbox');
                let i = 0;
                let model = this.model.sort().at(i);
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


    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by Converse.js's plugin machinery.
         */
        const { _converse } = this,
              { __ } = _converse;

        // Add new HTML templates.
        _converse.templates.chatbox_minimize = tpl_chatbox_minimize;
        _converse.templates.toggle_chats = tpl_toggle_chats;
        _converse.templates.trimmed_chat = tpl_trimmed_chat;
        _converse.templates.chats_panel = tpl_chats_panel;

        _converse.api.settings.update({
            no_trimming: false, // Set to true for phantomjs tests (where browser apparently has no width)
        });

        _converse.api.promises.add('minimizedChatsInitialized');

        _converse.MinimizedChatBoxView = Backbone.NativeView.extend({
            tagName: 'div',
            className: 'chat-head row no-gutters',
            events: {
                'click .close-chatbox-button': 'close',
                'click .restore-chat': 'restore'
            },

            initialize () {
                this.model.on('change:num_unread', this.render, this);
            },

            render () {
                const data = _.extend(
                    this.model.toJSON(),
                    { 'tooltip': __('Click to restore this chat') }
                );
                if (this.model.get('type') === 'chatroom') {
                    data.title = this.model.get('name');
                    u.addClass('chat-head-chatroom', this.el);
                } else {
                    data.title = this.model.get('fullname');
                    u.addClass('chat-head-chatbox', this.el);
                }
                this.el.innerHTML = tpl_trimmed_chat(data);
                return this.el;
            },

            close (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                this.remove();
                const view = _converse.chatboxviews.get(this.model.get('id'));
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

            initialize () {
                this.render();
                this.initToggle();
                this.addMultipleChats(this.model.where({'minimized': true}));
                this.model.on("add", this.onChanged, this);
                this.model.on("destroy", this.removeChat, this);
                this.model.on("change:minimized", this.onChanged, this);
                this.model.on('change:num_unread', this.updateUnreadMessagesCounter, this);
            },

            render () {
                if (!this.el.parentElement) {
                    this.el.innerHTML = tpl_chats_panel();
                    _converse.chatboxviews.insertRowColumn(this.el);
                }
                if (this.keys().length === 0) {
                    this.el.classList.add('hidden');
                } else if (this.keys().length > 0 && !u.isVisible(this.el)) {
                    this.el.classList.remove('hidden');
                    _converse.chatboxviews.trimChats();
                }
                return this.el;
            },

            tearDown () {
                this.model.off("add", this.onChanged);
                this.model.off("destroy", this.removeChat);
                this.model.off("change:minimized", this.onChanged);
                this.model.off('change:num_unread', this.updateUnreadMessagesCounter);
                return this;
            },

            initToggle () {
                const storage = _converse.config.get('storage'),
                      id = `converse.minchatstoggle-${_converse.bare_jid}`;
                this.toggleview = new _converse.MinimizedChatsToggleView({
                    'model': new _converse.MinimizedChatsToggle({'id': id})
                });
                this.toggleview.model.browserStorage = new _converse.BrowserStorage(id);
                this.toggleview.model.fetch();
            },

            toggle (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                this.toggleview.model.save(
                    {'collapsed': !this.toggleview.model.get('collapsed')},
                    {'patch': true}
                );
                u.slideToggleElement(this.el.querySelector('.minimized-chats-flyout'), 200);
            },

            onChanged (item) {
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

            addChatView (item) {
                const existing = this.get(item.get('id'));
                if (existing && existing.el.parentNode) {
                    return;
                }
                const view = new _converse.MinimizedChatBoxView({model: item});
                this.el.querySelector('.minimized-chats-flyout').insertAdjacentElement('beforeEnd', view.render());
                this.add(item.get('id'), view);
            },

            addMultipleChats (items) {
                _.each(items, this.addChatView.bind(this));
                this.toggleview.model.set({'num_minimized': this.keys().length});
                this.render();
            },

            addChat (item) {
                this.addChatView(item);
                this.toggleview.model.set({'num_minimized': this.keys().length});
                this.render();
            },

            removeChat (item) {
                this.remove(item.get('id'));
                this.toggleview.model.set({'num_minimized': this.keys().length});
                this.render();
            },

            updateUnreadMessagesCounter () {
                this.toggleview.model.save({'num_unread': _.sum(this.model.pluck('num_unread'))}, {'patch': true});
                this.render();
            }
        });


        _converse.MinimizedChatsToggle = Backbone.Model.extend({
            defaults: {
                'collapsed': false,
                'num_minimized': 0,
                'num_unread':  0
            }
        });


        _converse.MinimizedChatsToggleView = Backbone.NativeView.extend({
            el: '#toggle-minimized-chats',

            initialize () {
                this.model.on('change:num_minimized', this.render, this);
                this.model.on('change:num_unread', this.render, this);
                this.flyout = this.el.parentElement.querySelector('.minimized-chats-flyout');
            },

            render () {
                this.el.innerHTML = tpl_toggle_chats(
                    _.extend(this.model.toJSON(), {
                        'Minimized': __('Minimized')
                    })
                );
                if (this.model.get('collapsed')) {
                    u.hideElement(this.flyout);
                } else {
                    u.showElement(this.flyout);
                }
                return this.el;
            }
        });

        Promise.all([
            _converse.api.waitUntil('connectionInitialized'),
            _converse.api.waitUntil('chatBoxViewsInitialized')
        ]).then(() => {
            _converse.minimized_chats = new _converse.MinimizedChats({
                model: _converse.chatboxes
            });
            _converse.emit('minimizedChatsInitialized');
        }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));


        const debouncedTrim = _.debounce(ev => {
            if (_converse.view_mode !== 'overlayed' || !_converse.chatboxviews.trimChats) {
                return;
            }
            if (_converse.connection.connected) {
                _converse.chatboxviews.trimChats();
            }
        }, 200);
        _converse.api.listen.on('registeredGlobalEventHandlers', () => window.addEventListener("resize", debouncedTrim));
        _converse.api.listen.on('unregisteredGlobalEventHandlers', () => window.removeEventListener("resize", debouncedTrim));

        _converse.api.listen.on('controlBoxOpened', function (chatbox) {
            // Wrapped in anon method because at scan time, chatboxviews
            // attr not set yet.
            if (_converse.connection.connected) {
                _converse.chatboxviews.trimChats(chatbox);
            }
        });
    }
});
