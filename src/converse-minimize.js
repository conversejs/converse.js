/**
 * @module converse-minimize
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import './components/minimized_chat.js';
import 'converse-chatview';
import tpl_chats_panel from 'templates/chats_panel.js';
import { Model } from '@converse/skeletor/src/model.js';
import { View } from '@converse/skeletor/src/view';
import { __ } from './i18n';
import { _converse, api, converse } from '@converse/headless/converse-core';
import { debounce } from 'lodash-es';
import { render } from 'lit-html';

const { dayjs } = converse.env;
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
    dependencies: [
        "converse-chatview",
        "converse-controlbox",
        "converse-muc-views",
        "converse-headlines-view",
        "converse-dragresize"
    ],

    enabled (_converse) {
        return _converse.api.settings.get("view_mode") === 'overlayed';
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
                    'time_minimized': this.get('time_minimized') || dayjs(),
                });
            },

            maybeShow (force) {
                if (!force && this.get('minimized')) {
                    // Must return the chatbox
                    return this;
                }
                return this.__super__.maybeShow.apply(this, arguments);
            },

            isHidden () {
                return this.__super__.isHidden.call(this) || this.get('minimized');
            }
        },

        ChatBoxView: {
            show () {
                const { _converse } = this.__super__;
                if (_converse.api.settings.get("view_mode") === 'overlayed' && this.model.get('minimized')) {
                    this.model.minimize();
                    return this;
                } else {
                    return this.__super__.show.apply(this, arguments);
                }
            },

            isNewMessageHidden () {
                return this.model.get('minimized') ||
                    this.__super__.isNewMessageHidden.apply(this, arguments);
            },

            setChatBoxHeight (height) {
                if (!this.model.get('minimized')) {
                    return this.__super__.setChatBoxHeight.call(this, height);
                }
            },

            setChatBoxWidth (width) {
                if (!this.model.get('minimized')) {
                    return this.__super__.setChatBoxWidth.call(this, width);
                }
            }
        }
    },


    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by Converse.js's plugin machinery.
         */

        api.settings.extend({'no_trimming': false});

        const minimizableChatBox = {
            maximize () {
                u.safeSave(this, {
                    'minimized': false,
                    'time_opened': (new Date()).getTime()
                });
            },

            minimize () {
                u.safeSave(this, {
                    'minimized': true,
                    'time_minimized': (new Date()).toISOString()
                });
            }
        }
        Object.assign(_converse.ChatBox.prototype, minimizableChatBox);


        const minimizableChatBoxView = {
            /**
             * Handler which gets called when a {@link _converse#ChatBox} has it's
             * `minimized` property set to false.
             *
             * Will trigger {@link _converse#chatBoxMaximized}
             * @private
             * @returns {_converse.ChatBoxView|_converse.ChatRoomView}
             */
            onMaximized () {
                const { _converse } = this.__super__;
                this.insertIntoDOM();

                if (!this.model.isScrolledUp()) {
                    this.model.clearUnreadMsgCounter();
                }
                this.model.setChatState(_converse.ACTIVE);
                this.show();
                /**
                 * Triggered when a previously minimized chat gets maximized
                 * @event _converse#chatBoxMaximized
                 * @type { _converse.ChatBoxView }
                 * @example _converse.api.listen.on('chatBoxMaximized', view => { ... });
                 */
                api.trigger('chatBoxMaximized', this);
                return this;
            },

            /**
             * Handler which gets called when a {@link _converse#ChatBox} has it's
             * `minimized` property set to true.
             *
             * Will trigger {@link _converse#chatBoxMinimized}
             * @private
             * @returns {_converse.ChatBoxView|_converse.ChatRoomView}
             */
            onMinimized (ev) {
                const { _converse } = this.__super__;
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                // save the scroll position to restore it on maximize
                if (this.model.collection && this.model.collection.browserStorage) {
                    this.model.save({'scroll': this.content.scrollTop});
                } else {
                    this.model.set({'scroll': this.content.scrollTop});
                }
                this.model.setChatState(_converse.INACTIVE);
                this.hide();
                /**
                 * Triggered when a previously maximized chat gets Minimized
                 * @event _converse#chatBoxMinimized
                 * @type { _converse.ChatBoxView }
                 * @example _converse.api.listen.on('chatBoxMinimized', view => { ... });
                 */
                api.trigger('chatBoxMinimized', this);
                return this;
            },

            /**
             * Minimizes a chat box.
             * @returns {_converse.ChatBoxView|_converse.ChatRoomView}
             */
            minimize (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                this.model.minimize();
                return this;
            },

            onMinimizedChanged (item) {
                if (item.get('minimized')) {
                    this.onMinimized();
                } else {
                    this.onMaximized();
                }
            }
        }
        Object.assign(_converse.ChatBoxView.prototype, minimizableChatBoxView);


        const chatTrimmer = {
            getChatBoxWidth (view) {
                if (view.model.get('id') === 'controlbox') {
                    const controlbox = this.get('controlbox');
                    // We return the width of the controlbox or its toggle,
                    // depending on which is visible.
                    if (!controlbox || !u.isVisible(controlbox.el)) {
                        return u.getOuterWidth(_converse.controlboxtoggle.el, true);
                    } else {
                        return u.getOuterWidth(controlbox.el, true);
                    }
                } else if (!view.model.get('minimized') && u.isVisible(view.el)) {
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

            getMinimizedWidth () {
                const minimized_el = _converse.minimized_chats?.el;
                return this.model.pluck('minimized').includes(true) ? u.getOuterWidth(minimized_el, true) : 0;
            },

            getBoxesWidth (newchat) {
                const new_id = newchat ? newchat.model.get('id') : null;
                const newchat_width = newchat ? u.getOuterWidth(newchat.el, true) : 0;
                return Object.values(this.xget(new_id))
                    .reduce((memo, view) => memo + this.getChatBoxWidth(view), newchat_width);
            },

            /**
             * This method is called when a newly created chat box will be shown.
             * It checks whether there is enough space on the page to show
             * another chat box. Otherwise it minimizes the oldest chat box
             * to create space.
             * @private
             * @method _converse.ChatBoxViews#trimChats
             * @param { _converse.ChatBoxView|_converse.ChatRoomView|_converse.ControlBoxView|_converse.HeadlinesBoxView } [newchat]
             */
            async trimChats (newchat) {
                if (api.settings.get('no_trimming') || !api.connection.connected() || api.settings.get("view_mode") !== 'overlayed') {
                    return;
                }
                const shown_chats = this.getShownChats();
                if (shown_chats.length <= 1) {
                    return;
                }
                const body_width = u.getOuterWidth(document.querySelector('body'), true);
                if (this.getChatBoxWidth(shown_chats[0]) === body_width) {
                    // If the chats shown are the same width as the body,
                    // then we're in responsive mode and the chats are
                    // fullscreen. In this case we don't trim.
                    return;
                }
                await api.waitUntil('minimizedChatsInitialized');
                const minimized_el = _converse.minimized_chats?.el;
                if (minimized_el) {
                    while ((this.getMinimizedWidth() + this.getBoxesWidth(newchat)) > body_width) {
                        const new_id = newchat ? newchat.model.get('id') : null;
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
                        } else {
                            break;
                        }
                    }
                }
            },

            getOldestMaximizedChat (exclude_ids) {
                // Get oldest view (if its id is not excluded)
                exclude_ids.push('controlbox');
                let i = 0;
                let model = this.model.sort().at(i);
                while (exclude_ids.includes(model.get('id')) || model.get('minimized') === true) {
                    i++;
                    model = this.model.at(i);
                    if (!model) {
                        return null;
                    }
                }
                return model;
            }
        }
        Object.assign(_converse.ChatBoxViews.prototype, chatTrimmer);


        api.promises.add('minimizedChatsInitialized');


        _converse.MinimizedChatsToggle = Model.extend({
            defaults: {
                'collapsed': false
            }
        });


        _converse.MinimizedChats = View.extend({
            tagName: 'span',

            async initialize () {
                await this.initToggle();
                this.render();
                this.listenTo(this.minchats, 'change:collapsed', this.render)
                this.listenTo(this.model, 'add', this.render)
                this.listenTo(this.model, 'change:fullname', this.render)
                this.listenTo(this.model, 'change:jid', this.render)
                this.listenTo(this.model, 'change:minimized', this.render)
                this.listenTo(this.model, 'change:name', this.render)
                this.listenTo(this.model, 'change:num_unread', this.render)
                this.listenTo(this.model, 'remove', this.render)
            },

            render () {
                const chats = this.model.where({'minimized': true});
                const num_unread = chats.reduce((acc, chat) => (acc + chat.get('num_unread')), 0);
                const num_minimized = chats.reduce((acc, chat) => (acc + (chat.get('minimized') ? 1 : 0)), 0);
                const collapsed = this.minchats.get('collapsed');
                const data = { chats, num_unread, num_minimized, collapsed };
                data.toggle = ev => this.toggle(ev);
                render(tpl_chats_panel(data), this.el);

                if (!this.el.parentElement) {
                    _converse.chatboxviews.insertRowColumn(this.el);
                }
            },

            async initToggle () {
                const id = `converse.minchatstoggle-${_converse.bare_jid}`;
                this.minchats = new _converse.MinimizedChatsToggle({id});
                this.minchats.browserStorage = _converse.createStore(id);
                await new Promise(resolve => this.minchats.fetch({'success': resolve, 'error': resolve}));
            },

            toggle (ev) {
                ev?.preventDefault();
                this.minchats.save({'collapsed': !this.minchats.get('collapsed')});
            }
        });


        function initMinimizedChats () {
            _converse.minimized_chats?.remove();
            _converse.minimized_chats = new _converse.MinimizedChats({model: _converse.chatboxes});
            /**
             * Triggered once the _converse.MinimizedChats instance has been initialized
             * @event _converse#minimizedChatsInitialized
             * @example _converse.api.listen.on('minimizedChatsInitialized', () => { ... });
             */
            api.trigger('minimizedChatsInitialized');
        }

        function addMinimizeButtonToChat (view, buttons) {
            const data = {
                'a_class': 'toggle-chatbox-button',
                'handler': ev => view.minimize(ev),
                'i18n_text': __('Minimize'),
                'i18n_title': __('Minimize this chat'),
                'icon_class': "fa-minus",
                'name': 'minimize',
                'standalone': _converse.api.settings.get("view_mode") === 'overlayed'
            }
            const names = buttons.map(t => t.name);
            const idx = names.indexOf('close');
            return idx > -1 ? [...buttons.slice(0, idx), data, ...buttons.slice(idx)] : [data, ...buttons];
        }

        function addMinimizeButtonToMUC (view, buttons) {
            const data = {
                'a_class': 'toggle-chatbox-button',
                'handler': ev => view.minimize(ev),
                'i18n_text': __('Minimize'),
                'i18n_title': __('Minimize this groupchat'),
                'icon_class': "fa-minus",
                'name': 'minimize',
                'standalone': _converse.api.settings.get("view_mode") === 'overlayed'
            }
            const names = buttons.map(t => t.name);
            const idx = names.indexOf('signout');
            return idx > -1 ? [...buttons.slice(0, idx), data, ...buttons.slice(idx)] : [data, ...buttons];
        }

        /************************ BEGIN Event Handlers ************************/
        api.listen.on('chatBoxInsertedIntoDOM', view => _converse.chatboxviews.trimChats(view));
        api.listen.on('connected', () => initMinimizedChats());
        api.listen.on('controlBoxOpened', view => _converse.chatboxviews.trimChats(view));
        api.listen.on('chatBoxViewInitialized', v => v.listenTo(v.model, 'change:minimized', v.onMinimizedChanged));

        api.listen.on('chatRoomViewInitialized', view => {
            view.listenTo(view.model, 'change:minimized', view.onMinimizedChanged)
            view.model.get('minimized') && view.hide();
        });

        api.listen.on('getHeadingButtons', (view, buttons) => {
            if (view.model.get('type') === _converse.CHATROOMS_TYPE) {
                return addMinimizeButtonToMUC(view, buttons);
            } else {
                return addMinimizeButtonToChat(view, buttons);
            }
        });

        const debouncedTrimChats = debounce(() => _converse.chatboxviews.trimChats(), 250);
        api.listen.on('registeredGlobalEventHandlers', () => window.addEventListener("resize", debouncedTrimChats));
        api.listen.on('unregisteredGlobalEventHandlers', () => window.removeEventListener("resize", debouncedTrimChats));
        /************************ END Event Handlers ************************/
    }
});
