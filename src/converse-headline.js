// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)

import "converse-chatview";
import converse from "@converse/headless/converse-core";
import tpl_chatbox from "templates/chatbox.html";

const { _, utils } = converse.env;


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
                if (attrs.type == _converse.HEADLINES_TYPE) {
                    return new _converse.HeadlinesBox(attrs, options);
                } else {
                    return this.__super__.model.apply(this, arguments);
                }
            },
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
                'type': _converse.HEADLINES_TYPE,
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

        async function onHeadlineMessage (message) {
            /* Handler method for all incoming messages of type "headline". */
            if (utils.isHeadlineMessage(_converse, message)) {
                const from_jid = message.getAttribute('from');
                if (_.includes(from_jid, '@') && 
                        !_converse.api.contacts.get(from_jid) &&
                        !_converse.allow_non_roster_messaging) {
                    return;
                }
                if (_.isNull(message.querySelector('body'))) {
                    // Avoid creating a chat box if we have nothing to show
                    // inside it.
                    return;
                }
                const chatbox = _converse.chatboxes.create({
                    'id': from_jid,
                    'jid': from_jid,
                    'type': _converse.HEADLINES_TYPE,
                    'from': from_jid
                });
                const attrs = await chatbox.getMessageAttributesFromStanza(message, message);
                await chatbox.messages.create(attrs);
                _converse.emit('message', {'chatbox': chatbox, 'stanza': message});
            }
        }

        function registerHeadlineHandler () {
            _converse.connection.addHandler(message => {
                onHeadlineMessage(message);
                return true
            }, null, 'message');
        }
        _converse.on('connected', registerHeadlineHandler);
        _converse.on('reconnected', registerHeadlineHandler);


        _converse.on('chatBoxViewsInitialized', () => {
            const that = _converse.chatboxviews;
            _converse.chatboxes.on('add', item => {
                if (!that.get(item.get('id')) && item.get('type') === _converse.HEADLINES_TYPE) {
                    that.add(item.get('id'), new _converse.HeadlinesBoxView({model: item}));
                }
            });
        });
    }
});
