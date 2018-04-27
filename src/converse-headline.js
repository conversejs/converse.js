// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define([
            "converse-core",
            "tpl!chatbox",
            "converse-chatview",
    ], factory);
}(this, function (converse, tpl_chatbox) {
    "use strict";
    const { _, utils } = converse.env;
    const HEADLINES_TYPE = 'headline';

    converse.plugins.add('converse-headline', {
        /* Plugin dependencies are other plugins which might be
         * overridden or relied upon, and therefore need to be loaded before
         * this plugin.
         *
         * If the setting "strict_plugin_dependencies" is set to true,
         * an error will be raised if the plugin is not found. By default it's
         * false, which means these plugins are only loaded opportunistically.
         *
         * NB: These plugins need to have already been loaded via require.js.
         */
        dependencies: ["converse-chatview"],

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            ChatBoxes: {
                model (attrs, options) {
                    const { _converse } = this.__super__;
                    if (attrs.type == HEADLINES_TYPE) {
                        return new _converse.HeadlinesBox(attrs, options);
                    } else {
                        return this.__super__.model.apply(this, arguments);
                    }
                },
            },

            ChatBoxViews: {
                onChatBoxAdded (item) {
                    const { _converse } = this.__super__;
                    let view = this.get(item.get('id'));
                    if (!view && item.get('type') === 'headline') {
                        view = new _converse.HeadlinesBoxView({model: item});
                        this.add(item.get('id'), view);
                        return view;
                    } else {
                        return this.__super__.onChatBoxAdded.apply(this, arguments);
                    }
                }
            }
        },


        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this,
                { __ } = _converse;

            _converse.HeadlinesBox = _converse.ChatBox.extend({
                defaults: {
                    'type': 'headline',
                    'bookmarked': false,
                    'chat_state': undefined,
                    'num_unread': 0,
                    'url': ''
                },
            });


            _converse.HeadlinesBoxView = _converse.ChatBoxView.extend({
                className: 'chatbox headlines',

                events: {
                    'click .close-chatbox-button': 'close',
                    'click .toggle-chatbox-button': 'minimize',
                    'keypress textarea.chat-textarea': 'keyPressed'
                },

                initialize () {
                    this.initDebounced();

                    this.disable_mam = true; // Don't do MAM queries for this box
                    this.model.messages.on('add', this.onMessageAdded, this);
                    this.model.on('show', this.show, this);
                    this.model.on('destroy', this.hide, this);
                    this.model.on('change:minimized', this.onMinimizedChanged, this);

                    this.render().insertHeading().fetchMessages().insertIntoDOM().hide();
                    _converse.emit('chatBoxOpened', this);
                    _converse.emit('chatBoxInitialized', this);
                },

                render () {
                    this.el.setAttribute('id', this.model.get('box_id'))
                    this.el.innerHTML = tpl_chatbox(
                        _.extend(this.model.toJSON(), {
                                info_close: '',
                                label_personal_message: '',
                                show_send_button: false,
                                show_toolbar: false,
                                unread_msgs: ''
                            }
                        ));
                    this.content = this.el.querySelector('.chat-content');
                    return this;
                },

                // Override to avoid the methods in converse-chatview.js
                'renderMessageForm': _.noop,
                'afterShown': _.noop
            });

            function onHeadlineMessage (message) {
                /* Handler method for all incoming messages of type "headline". */
                const from_jid = message.getAttribute('from');
                if (utils.isHeadlineMessage(_converse, message)) {
                    if (_.includes(from_jid, '@') && !_converse.allow_non_roster_messaging) {
                        return;
                    }
                    const chatbox = _converse.chatboxes.create({
                        'id': from_jid,
                        'jid': from_jid,
                        'type': 'headline',
                        'from': from_jid
                    });
                    chatbox.createMessage(message, undefined, message);
                    _converse.emit('message', {'chatbox': chatbox, 'stanza': message});
                }
                return true;
            }

            function registerHeadlineHandler () {
                _converse.connection.addHandler(onHeadlineMessage, null, 'message');
            }
            _converse.on('connected', registerHeadlineHandler);
            _converse.on('reconnected', registerHeadlineHandler);
        }
    });
}));
