// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define(["converse-core"], factory);
}(this, function (converse) {
    "use strict";
    const { Backbone, Strophe, b64_sha1, utils, _ } = converse.env;

    converse.plugins.add('converse-chatboxes', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.

            disconnect: function () {
                const { _converse } = this.__super__;
                _converse.chatboxviews.closeAllChatBoxes();
                return this.__super__.disconnect.apply(this, arguments);
            },

            logOut: function () {
                const { _converse } = this.__super__;
                _converse.chatboxviews.closeAllChatBoxes();
                return this.__super__.logOut.apply(this, arguments);
            },

            initStatus: function () {
                const { _converse } = this.__super__;
                _converse.chatboxviews.closeAllChatBoxes();
                return this.__super__.initStatus.apply(this, arguments);
            },

            onStatusInitialized: function () {
                const { _converse } = this.__super__;
                _converse.chatboxes.onConnected();
                return this.__super__.onStatusInitialized.apply(this, arguments);
            }
        },

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this;

            _converse.api.promises.add([
                'chatBoxesFetched',
                'chatBoxesInitialized'
            ]);

            _converse.ChatBoxes = Backbone.Collection.extend({
                comparator: 'time_opened',

                model (attrs, options) {
                    return new _converse.ChatBox(attrs, options);
                },

                registerMessageHandler () {
                    _converse.connection.addHandler(
                        this.onMessage.bind(this), null, 'message', 'chat'
                    );
                    _converse.connection.addHandler(
                        this.onErrorMessage.bind(this), null, 'message', 'error'
                    );
                },

                chatBoxMayBeShown (chatbox) {
                    return true;
                },

                onChatBoxesFetched (collection) {
                    /* Show chat boxes upon receiving them from sessionStorage
                    *
                    * This method gets overridden entirely in src/converse-controlbox.js
                    * if the controlbox plugin is active.
                    */
                    collection.each((chatbox) => {
                        if (this.chatBoxMayBeShown(chatbox)) {
                            chatbox.trigger('show');
                        }
                    });
                    _converse.emit('chatBoxesFetched');
                },

                onConnected () {
                    this.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                        b64_sha1(`converse.chatboxes-${_converse.bare_jid}`));
                    this.registerMessageHandler();
                    this.fetch({
                        add: true,
                        success: this.onChatBoxesFetched.bind(this)
                    });
                },

                onErrorMessage (message) {
                    /* Handler method for all incoming error message stanzas
                    */
                    // TODO: we can likely just reuse "onMessage" below
                    const from_jid =  Strophe.getBareJidFromJid(message.getAttribute('from'));
                    if (utils.isSameBareJID(from_jid, _converse.bare_jid)) {
                        return true;
                    }
                    // Get chat box, but only create a new one when the message has a body.
                    const chatbox = this.getChatBox(from_jid);
                    if (!chatbox) {
                        return true;
                    }
                    chatbox.createMessage(message, null, message);
                    return true;
                },

                onMessage (message) {
                    /* Handler method for all incoming single-user chat "message"
                    * stanzas.
                    */
                    let contact_jid, delay, resource,
                        from_jid = message.getAttribute('from'),
                        to_jid = message.getAttribute('to');

                    const original_stanza = message,
                        to_resource = Strophe.getResourceFromJid(to_jid),
                        is_carbon = !_.isNull(message.querySelector(`received[xmlns="${Strophe.NS.CARBONS}"]`));

                    if (_converse.filter_by_resource && (to_resource && to_resource !== _converse.resource)) {
                        _converse.log(
                            `onMessage: Ignoring incoming message intended for a different resource: ${to_jid}`,
                            Strophe.LogLevel.INFO
                        );
                        return true;
                    } else if (utils.isHeadlineMessage(message)) {
                        // XXX: Ideally we wouldn't have to check for headline
                        // messages, but Prosody sends headline messages with the
                        // wrong type ('chat'), so we need to filter them out here.
                        _converse.log(
                            `onMessage: Ignoring incoming headline message sent with type 'chat' from JID: ${from_jid}`,
                            Strophe.LogLevel.INFO
                        );
                        return true;
                    }
                    const forwarded = message.querySelector('forwarded');
                    if (!_.isNull(forwarded)) {
                        const forwarded_message = forwarded.querySelector('message');
                        const forwarded_from = forwarded_message.getAttribute('from');
                        if (is_carbon && Strophe.getBareJidFromJid(forwarded_from) !== from_jid) {
                            // Prevent message forging via carbons
                            //
                            // https://xmpp.org/extensions/xep-0280.html#security
                            return true;
                        }
                        message = forwarded_message;
                        delay = forwarded.querySelector('delay');
                        from_jid = message.getAttribute('from');
                        to_jid = message.getAttribute('to');
                    }

                    const from_bare_jid = Strophe.getBareJidFromJid(from_jid),
                        from_resource = Strophe.getResourceFromJid(from_jid),
                        is_me = from_bare_jid === _converse.bare_jid;

                    if (is_me) {
                        // I am the sender, so this must be a forwarded message...
                        contact_jid = Strophe.getBareJidFromJid(to_jid);
                        resource = Strophe.getResourceFromJid(to_jid);
                    } else {
                        contact_jid = from_bare_jid;
                        resource = from_resource;
                    }
                    // Get chat box, but only create a new one when the message has a body.
                    const chatbox = this.getChatBox(contact_jid, !_.isNull(message.querySelector('body'))),
                        msgid = message.getAttribute('id');

                    if (chatbox) {
                        const messages = msgid && chatbox.messages.findWhere({msgid}) || [];
                        if (_.isEmpty(messages)) {
                            // Only create the message when we're sure it's not a
                            // duplicate
                            chatbox.incrementUnreadMsgCounter(original_stanza);
                            chatbox.createMessage(message, delay, original_stanza);
                        }
                    }
                    _converse.emit('message', {'stanza': original_stanza, 'chatbox': chatbox});
                    return true;
                },

                createChatBox (jid, attrs) {
                    /* Creates a chat box
                    *
                    * Parameters:
                    *    (String) jid - The JID of the user for whom a chat box
                    *      gets created.
                    *    (Object) attrs - Optional chat box atributes.
                    */
                    const bare_jid = Strophe.getBareJidFromJid(jid),
                        roster_item = _converse.roster.get(bare_jid);
                    let roster_info = {};

                    if (! _.isUndefined(roster_item)) {
                        roster_info = {
                            'fullname': _.isEmpty(roster_item.get('fullname'))? jid: roster_item.get('fullname'),
                            'image_type': roster_item.get('image_type'),
                            'image': roster_item.get('image'),
                            'url': roster_item.get('url'),
                        };
                    } else if (!_converse.allow_non_roster_messaging) {
                        _converse.log(`Could not get roster item for JID ${bare_jid}`+
                            ' and allow_non_roster_messaging is set to false',
                            Strophe.LogLevel.ERROR);
                        return;
                    }
                    return this.create(_.assignIn({
                            'id': bare_jid,
                            'jid': bare_jid,
                            'fullname': jid,
                            'image_type': _converse.DEFAULT_IMAGE_TYPE,
                            'image': _converse.DEFAULT_IMAGE,
                            'url': '',
                        }, roster_info, attrs || {}));
                },

                getChatBox (jid, create, attrs) {
                    /* Returns a chat box or optionally return a newly
                    * created one if one doesn't exist.
                    *
                    * Parameters:
                    *    (String) jid - The JID of the user whose chat box we want
                    *    (Boolean) create - Should a new chat box be created if none exists?
                    *    (Object) attrs - Optional chat box atributes.
                    */
                    jid = jid.toLowerCase();
                    let  chatbox = this.get(Strophe.getBareJidFromJid(jid));
                    if (!chatbox && create) {
                        chatbox = this.createChatBox(jid, attrs);
                    }
                    return chatbox;
                }
            });

            _converse.ChatBoxViews = Backbone.Overview.extend({

                initialize () {
                    this.model.on("add", this.onChatBoxAdded, this);
                    this.model.on("destroy", this.removeChat, this);
                },

                _ensureElement () {
                    /* Override method from backbone.js
                    * If the #conversejs element doesn't exist, create it.
                    */
                    if (!this.el) {
                        let el = document.querySelector('#conversejs');
                        if (_.isNull(el)) {
                            el = document.createElement('div');
                            el.setAttribute('id', 'conversejs');
                            // Converse.js expects a <body> tag to be present.
                            document.querySelector('body').appendChild(el);
                        }
                        el.innerHTML = '';
                        this.setElement(el, false);
                    } else {
                        this.setElement(_.result(this, 'el'), false);
                    }
                },

                onChatBoxAdded (item) {
                    // Views aren't created here, since the core code doesn't
                    // contain any views. Instead, they're created in overrides in
                    // plugins, such as in converse-chatview.js and converse-muc.js
                    return this.get(item.get('id'));
                },

                removeChat (item) {
                    this.remove(item.get('id'));
                },

                closeAllChatBoxes () {
                    /* This method gets overridden in src/converse-controlbox.js if
                    * the controlbox plugin is active.
                    */
                    this.each(function (view) { view.close(); });
                    return this;
                },

                chatBoxMayBeShown (chatbox) {
                    return this.model.chatBoxMayBeShown(chatbox);
                },

                getChatBox (attrs, create) {
                    let chatbox  = this.model.get(attrs.jid);
                    if (!chatbox && create) {
                        chatbox = this.model.create(attrs, {
                            'error' (model, response) {
                                _converse.log(response.responseText);
                            }
                        });
                    }
                    return chatbox;
                },

                showChat (attrs) {
                    /* Find the chat box and show it (if it may be shown).
                    * If it doesn't exist, create it.
                    */
                    const chatbox = this.getChatBox(attrs, true);
                    if (this.chatBoxMayBeShown(chatbox)) {
                        chatbox.trigger('show', true);
                    }
                    return chatbox;
                }
            });

            // BEGIN: Event handlers
            _converse.api.listen.on('pluginsInitialized', () => {
                _converse.chatboxes = new _converse.ChatBoxes();
                _converse.chatboxviews = new _converse.ChatBoxViews({
                    'model': _converse.chatboxes
                });
                _converse.emit('chatBoxesInitialized');
            });

            _converse.api.listen.on('beforeTearDown', () => {
                _converse.chatboxes.remove(); // Don't call off(), events won't get re-registered upon reconnect.
                delete _converse.chatboxes.browserStorage;
            });
            // END: Event handlers

            _converse.getViewForChatBox = function (chatbox) {
                if (!chatbox) { return; }
                return _converse.chatboxviews.get(chatbox.get('id'));
            };

            /* We extend the default converse.js API */
            _.extend(_converse.api, {
                'chats': {
                    'open' (jids, attrs) {
                        if (_.isUndefined(jids)) {
                            _converse.log("chats.open: You need to provide at least one JID", Strophe.LogLevel.ERROR);
                            return null;
                        } else if (_.isString(jids)) {
                            return _converse.getViewForChatBox(
                                _converse.chatboxes.getChatBox(jids, true, attrs).trigger('show')
                            );
                        }
                        return _.map(jids, (jid) =>
                            _converse.getViewForChatBox(
                                _converse.chatboxes.getChatBox(jid, true, attrs).trigger('show')
                            )
                        );
                    },
                    'get' (jids) {
                        if (_.isUndefined(jids)) {
                            const result = [];
                            _converse.chatboxes.each(function (chatbox) {
                                // FIXME: Leaky abstraction from MUC. We need to add a
                                // base type for chat boxes, and check for that.
                                if (chatbox.get('type') !== 'chatroom') {
                                    result.push(_converse.getViewForChatBox(chatbox));
                                }
                            });
                            return result;
                        } else if (_.isString(jids)) {
                            return _converse.getViewForChatBox(_converse.chatboxes.getChatBox(jids));
                        }
                        return _.map(jids,
                            _.partial(
                                _.flow(
                                    _converse.chatboxes.getChatBox.bind(_converse.chatboxes),
                                    _converse.getViewForChatBox.bind(_converse)
                                ), _, true
                            )
                        );
                    }
                }
            });
        }
    });
    return converse;
}));
