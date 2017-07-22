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

    converse.plugins.add('converse-headline', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

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

            _converse.HeadlinesBoxView = _converse.ChatBoxView.extend({
                className: 'chatbox headlines',

                events: {
                    'click .close-chatbox-button': 'close',
                    'click .toggle-chatbox-button': 'minimize',
                    'keypress textarea.chat-textarea': 'keyPressed'
                },

                initialize () {
                    this.disable_mam = true; // Don't do MAM queries for this box
                    this.model.messages.on('add', this.onMessageAdded, this);
                    this.model.on('show', this.show, this);
                    this.model.on('destroy', this.hide, this);
                    this.model.on('change:minimized', this.onMinimizedChanged, this);
                    this.render().fetchMessages().insertIntoDOM().hide();
                    _converse.emit('chatBoxInitialized', this);
                },

                render () {
                    this.$el.attr('id', this.model.get('box_id'))
                        .html(tpl_chatbox(
                                _.extend(this.model.toJSON(), {
                                        show_toolbar: _converse.show_toolbar,
                                        show_textarea: false,
                                        show_send_button: _converse.show_send_button,
                                        title: this.model.get('fullname'),
                                        unread_msgs: __('You have unread messages'),
                                        info_close: __('Close this box'),
                                        label_personal_message: ''
                                    }
                                )
                            )
                        );
                    this.$content = this.$el.find('.chat-content');
                    _converse.emit('chatBoxOpened', this);
                    utils.refreshWebkit();
                    return this;
                }
            });

            function onHeadlineMessage (message) {
                /* Handler method for all incoming messages of type "headline". */
                const from_jid = message.getAttribute('from');
                if (utils.isHeadlineMessage(message)) {
                    if (_.includes(from_jid, '@') && !_converse.allow_non_roster_messaging) {
                        return;
                    }
                    const chatbox = _converse.chatboxes.create({
                        'id': from_jid,
                        'jid': from_jid,
                        'fullname':  from_jid,
                        'type': 'headline'
                    });
                    chatbox.createMessage(message, undefined, message);
                    _converse.emit('message', {'chatbox': chatbox, 'stanza': message});
                }
                return true;
            }

            function registerHeadlineHandler () {
                _converse.connection.addHandler(
                        onHeadlineMessage, null, 'message');
            }
            _converse.on('connected', registerHeadlineHandler);
            _converse.on('reconnected', registerHeadlineHandler);
        }
    });
}));
