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
        "tpl!chatboxes",
        "backbone.overview"
    ], factory);
}(this, function (converse, tpl_chatboxes) {
    "use strict";

    const { $msg, Backbone, Promise, Strophe, b64_sha1, moment, utils, _ } = converse.env;
    Strophe.addNamespace('OUTOFBAND', 'jabber:x:oob');

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

            initStatus: function (reconnecting) {
                const { _converse } = this.__super__;
                if (!reconnecting) {
                    _converse.chatboxviews.closeAllChatBoxes();
                }
                return this.__super__.initStatus.apply(this, arguments);
            }
        },

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this,
                { __ } = _converse;

            _converse.api.promises.add([
                'chatBoxesFetched',
                'chatBoxesInitialized'
            ]);

            function openChat (jid) {
                if (!utils.isValidJID(jid)) {
                    return converse.log(
                        `Invalid JID "${jid}" provided in URL fragment`,
                        Strophe.LogLevel.WARN
                    );
                }
                Promise.all([
                    _converse.api.waitUntil('rosterContactsFetched'),
                    _converse.api.waitUntil('chatBoxesFetched')
                ]).then(() => {
                    _converse.api.chats.open(jid);
                });
            }
            _converse.router.route('converse/chat?jid=:jid', openChat);


            _converse.Message = Backbone.Model.extend({
                defaults(){
                    return {
                        msgid: _converse.connection.getUniqueId()
                    };
                }
            });


            _converse.Messages = Backbone.Collection.extend({
                model: _converse.Message,
                comparator: 'time'
            });


            _converse.ChatBox = Backbone.Model.extend({
                defaults: {
                    'bookmarked': false,
                    'chat_state': undefined,
                    'image': _converse.DEFAULT_IMAGE,
                    'image_type': _converse.DEFAULT_IMAGE_TYPE,
                    'num_unread': 0,
                    'show_avatar': true,
                    'type': 'chatbox',
                    'url': ''
                },

                initialize () {
                    this.messages = new _converse.Messages();
                    this.messages.browserStorage = new Backbone.BrowserStorage[_converse.message_storage](
                        b64_sha1(`converse.messages${this.get('jid')}${_converse.bare_jid}`));

                    this.save({
                        // The chat_state will be set to ACTIVE once the chat box is opened
                        // and we listen for change:chat_state, so shouldn't set it to ACTIVE here.
                        'box_id' : b64_sha1(this.get('jid')),
                        'time_opened': this.get('time_opened') || moment().valueOf(),
                        'user_id' : Strophe.getNodeFromJid(this.get('jid'))
                    });
                },

                createFileMessageStanza (message, to) {
                    const stanza = $msg({
                        'from': _converse.connection.jid,
                        'to': to,
                        'type': 'chat',
                        'id': message.get('msgid')
                    }).c('body').t(message.get('message')).up()
                      .c(_converse.ACTIVE, {'xmlns': Strophe.NS.CHATSTATES}).up()
                      .c('x', {'xmlns': Strophe.NS.OUTOFBAND}).c('url').t(message.get('message')).up();

                    return stanza;
                },

                sendFile (file, chatbox) {
                    const self = this;
                    const request_slot_url = 'upload.' + _converse.domain;
                    _converse.api.disco.supports(Strophe.NS.HTTPUPLOAD, request_slot_url)
                        .then((result) => { 
                            chatbox.showHelpMessages([__('The file upload starts now')],'info');
                            self.requestSlot(file, request_slot_url, function(data) {
                                if (!data) {
                                    alert(__('File upload failed. Please check the log.'));
                                } else if (data.error) {
                                    alert(__('File upload failed. Please check the log.'));
                                } else if (data.get && data.put) {
                                    self.uploadFile(data.put, file, function() {
                                        console.log(data.put);
                                        chatbox.onMessageSubmitted(data.put, null, file);
                                    });
                                }
                            });
                        });
                },

                requestSlot (file, request_slot_url, cb) {
                    const self = this;
                    console.log("try sending file to: " + request_slot_url);
                    const iq = converse.env.$iq({
                        to: request_slot_url,
                        type: 'get'
                    }).c('request', {
                        xmlns: Strophe.NS.HTTPUPLOAD
                    }).c('filename').t(file.name)
                    .up()
                    .c('size').t(file.size);
                
                    _converse.connection.sendIQ(iq, function(stanza) {
                        self.successfulRequestSlotCB(stanza, cb);
                    }, function(stanza) {
                        self.failedRequestSlotCB(stanza, cb);
                    });
                },
                
                uploadFile (url, file, callback) {
                    console.log("uploadFile start");
                    const xmlhttp = new XMLHttpRequest();
                    const contentType = 'application/octet-stream';
                    xmlhttp.onreadystatechange = function() {
                        if (xmlhttp.readyState === XMLHttpRequest.DONE) {   
                            console.log("Status: " + xmlhttp.status);
                            if (xmlhttp.status === 200 || xmlhttp.status === 201) {
                                if (callback) {
                                    callback();
                                }    
                            }
                            else {
                                alert(__('Could not upload File please try again.'));
                            }
                        }
                    };
                
                    xmlhttp.open('PUT', url, true);
                    xmlhttp.setRequestHeader("Content-type", contentType);
                    xmlhttp.send(file);
                },

                successfulRequestSlotCB (stanza, cb) {
                    const slot = stanza.getElementsByTagName('slot')[0];
                
                    if (slot != undefined) {
                        var put = slot.getElementsByTagName('put')[0].textContent;
                        var get = slot.getElementsByTagName('get')[0].textContent;
                        cb({
                            put: put,
                            get: get
                        });
                    } else {
                        this.failedRequestSlotCB(stanza, cb);
                    }
                },
                
                failedRequestSlotCB (stanza, cb) {
                    alert(__('Could not upload File please try again.'));
                },

                getMessageBody (message) {
                    const type = message.getAttribute('type');
                    return (type === 'error') ?
                        _.propertyOf(message.querySelector('error text'))('textContent') :
                            _.propertyOf(message.querySelector('body'))('textContent');
                },

                getMessageAttributes (message, delay, original_stanza) {
                    /* Parses a passed in message stanza and returns an object
                     * of attributes.
                     *
                     * Parameters:
                     *    (XMLElement) message - The message stanza
                     *    (XMLElement) delay - The <delay> node from the
                     *      stanza, if there was one.
                     *    (XMLElement) original_stanza - The original stanza,
                     *      that contains the message stanza, if it was
                     *      contained, otherwise it's the message stanza itself.
                     */
                    const { _converse } = this.__super__,
                          { __ } = _converse;

                    delay = delay || message.querySelector('delay');
                    const type = message.getAttribute('type'),
                        body = this.getMessageBody(message);

                    const delayed = !_.isNull(delay),
                        is_groupchat = type === 'groupchat',
                        chat_state = message.getElementsByTagName(_converse.COMPOSING).length && _converse.COMPOSING ||
                            message.getElementsByTagName(_converse.PAUSED).length && _converse.PAUSED ||
                            message.getElementsByTagName(_converse.INACTIVE).length && _converse.INACTIVE ||
                            message.getElementsByTagName(_converse.ACTIVE).length && _converse.ACTIVE ||
                            message.getElementsByTagName(_converse.GONE).length && _converse.GONE;

                    let from;
                    if (is_groupchat) {
                        from = Strophe.unescapeNode(Strophe.getResourceFromJid(message.getAttribute('from')));
                    } else {
                        from = Strophe.getBareJidFromJid(message.getAttribute('from'));
                    }
                    const time = delayed ? delay.getAttribute('stamp') : moment().format();
                    let sender, fullname;
                    if ((is_groupchat && from === this.get('nick')) || (!is_groupchat && from === _converse.bare_jid)) {
                        sender = 'me';
                        fullname = _converse.xmppstatus.get('fullname') || from;
                    } else {
                        sender = 'them';
                        fullname = this.get('fullname') || from;
                    }
                    const spoiler = message.querySelector(`spoiler[xmlns="${Strophe.NS.SPOILER}"]`);
                    const attrs = {
                        'type': type,
                        'from': from,
                        'chat_state': chat_state,
                        'delayed': delayed,
                        'fullname': fullname,
                        'message': body || undefined,
                        'msgid': message.getAttribute('id'),
                        'sender': sender,
                        'time': time,
                        'is_spoiler': !_.isNull(spoiler)
                    };
                    if (spoiler) {
                        attrs.spoiler_hint = spoiler.textContent.length > 0 ? spoiler.textContent : '';
                    }
                    return attrs;
                },

                createMessage (message, delay, original_stanza) {
                    /* Create a Backbone.Message object inside this chat box
                     * based on the identified message stanza.
                     */
                    return this.messages.create(this.getMessageAttributes.apply(this, arguments));
                },

                newMessageWillBeHidden () {
                    /* Returns a boolean to indicate whether a newly received
                     * message will be visible to the user or not.
                     */
                    return this.get('hidden') ||
                        this.get('minimized') ||
                        this.isScrolledUp() ||
                        _converse.windowState === 'hidden';
                },

                incrementUnreadMsgCounter (stanza) {
                    /* Given a newly received message, update the unread counter if
                     * necessary.
                     */
                    if (_.isNull(stanza.querySelector('body'))) {
                        return; // The message has no text
                    }
                    if (utils.isNewMessage(stanza) && this.newMessageWillBeHidden()) {
                        this.save({'num_unread': this.get('num_unread') + 1});
                        _converse.incrementMsgCounter();
                    }
                },

                clearUnreadMsgCounter() {
                    this.save({'num_unread': 0});
                },

                isScrolledUp () {
                    return this.get('scrolled', true);
                }
            });


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
                    /* Show chat boxes upon receiving them from sessionStorage */
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
                     *
                     * Parameters:
                     *    (XMLElement) message - The incoming message stanza
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
                    } else if (utils.isHeadlineMessage(_converse, message)) {
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
                    const attrs = {
                        'fullname': _.get(_converse.api.contacts.get(contact_jid), 'attributes.fullname')
                    }
                    const chatbox = this.getChatBox(contact_jid, attrs, !_.isNull(message.querySelector('body'))),
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

                getChatBox (jid, attrs={}, create) {
                    /* Returns a chat box or optionally return a newly
                     * created one if one doesn't exist.
                     *
                     * Parameters:
                     *    (String) jid - The JID of the user whose chat box we want
                     *    (Boolean) create - Should a new chat box be created if none exists?
                     *    (Object) attrs - Optional chat box atributes.
                     */
                    if (_.isObject(jid)) {
                        create = attrs;
                        attrs = jid;
                        jid = attrs.jid;
                    }
                    jid = Strophe.getBareJidFromJid(jid.toLowerCase());

                    let  chatbox = this.get(Strophe.getBareJidFromJid(jid));
                    if (!chatbox && create) {
                        _.extend(attrs, {'jid': jid, 'id': jid});
                        chatbox = this.create(attrs, {
                            'error' (model, response) {
                                _converse.log(response.responseText);
                            }
                        });
                    }
                    return chatbox;
                }
            });

            _converse.ChatBoxViews = Backbone.Overview.extend({

                _ensureElement () {
                    /* Override method from backbone.js
                     * If the #conversejs element doesn't exist, create it.
                     */
                    if (!this.el) {
                        let el = _converse.root.querySelector('#conversejs');
                        if (_.isNull(el)) {
                            el = document.createElement('div');
                            el.setAttribute('id', 'conversejs');
                            const body = _converse.root.querySelector('body');
                            if (body) {
                                body.appendChild(el);
                            } else {
                                // Perhaps inside a web component?
                                _converse.root.appendChild(el);
                            }
                        }
                        if (_.includes(['mobile', 'fullscreen'], _converse.view_mode)) {
                            el.classList.add('fullscreen');
                        }
                        el.innerHTML = '';
                        this.setElement(el, false);
                    } else {
                        this.setElement(_.result(this, 'el'), false);
                    }
                },

                initialize () {
                    this.model.on("add", this.onChatBoxAdded, this);
                    this.model.on("destroy", this.removeChat, this);
                    this.render();
                },

                render () {
                    try {
                        this.el.innerHTML = tpl_chatboxes();
                    } catch (e) {
                        this._ensureElement();
                        this.el.innerHTML = tpl_chatboxes();
                    }
                    this.row_el = this.el.querySelector('.row');
                },

                insertRowColumn (el) {
                    /* Add a new DOM element (likely a chat box) into the
                     * the row managed by this overview.
                     */
                    this.row_el.insertAdjacentElement('afterBegin', el);
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
                }
            });

            // TODO: move to converse-chatboxviews.js and use there in the API
            _converse.getViewForChatBox = function (chatbox) {
                if (!chatbox) { return; }
                return _converse.chatboxviews.get(chatbox.get('id'));
            };

            /************************ BEGIN Event Handlers ************************/
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

            _converse.api.listen.on('statusInitialized', () => _converse.chatboxes.onConnected());
            /************************ END Event Handlers ************************/


            /************************ BEGIN API ************************/
            _.extend(_converse.api, {
                'chats': {
                    'create' (jids, attrs) {
                        if (_.isUndefined(jids)) {
                            _converse.log(
                                "chats.create: You need to provide at least one JID",
                                Strophe.LogLevel.ERROR
                            );
                            return null;
                        }

                        if (_.isString(jids)) {
                            if (attrs && !_.get(attrs, 'fullname')) {
                                attrs.fullname = _.get(_converse.api.contacts.get(jids), 'attributes.fullname');
                            }
                            const chatbox = _converse.chatboxes.getChatBox(jids, attrs, true);
                            if (_.isNil(chatbox)) {
                                _converse.log("Could not open chatbox for JID: "+jids, Strophe.LogLevel.ERROR);
                                return;
                            }
                            return chatbox;
                        }
                        return _.map(jids, (jid) => {
                            attrs.fullname = _.get(_converse.api.contacts.get(jid), 'attributes.fullname');
                            return _converse.chatboxes.getChatBox(jid, attrs, true).trigger('show');
                        });
                    },
                    'open' (jids, attrs) {
                        if (_.isUndefined(jids)) {
                            _converse.log("chats.open: You need to provide at least one JID", Strophe.LogLevel.ERROR);
                            return null;
                        } else if (_.isString(jids)) {
                            const chatbox = _converse.api.chats.create(jids, attrs);
                            chatbox.trigger('show');
                            return chatbox;
                        }
                        return _.map(jids, (jid) => _converse.api.chats.create(jid, attrs).trigger('show'));
                    },
                    'get' (jids) {
                        if (_.isUndefined(jids)) {
                            const result = [];
                            _converse.chatboxes.each(function (chatbox) {
                                // FIXME: Leaky abstraction from MUC. We need to add a
                                // base type for chat boxes, and check for that.
                                if (chatbox.get('type') !== 'chatroom') {
                                    result.push(chatbox);
                                }
                            });
                            return result;
                        } else if (_.isString(jids)) {
                            return _converse.chatboxes.getChatBox(jids);
                        }
                        return _.map(jids, _.partial(_converse.chatboxes.getChatBox.bind(_converse.chatboxes), _, {}, true));
                    }
                }
            });
            /************************ END API ************************/
        }
    });
    return converse;
}));
