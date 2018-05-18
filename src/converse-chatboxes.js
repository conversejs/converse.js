// Converse.js
// http://conversejs.org
//
// Copyright (c) 2012-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

(function (root, factory) {
    define([
        "converse-core",
        "emojione",
        "filesize",
        "tpl!chatboxes",
        "backbone.overview",
        "form-utils"
    ], factory);
}(this, function (converse, emojione, filesize, tpl_chatboxes) {
    "use strict";

    const { $msg, Backbone, Promise, Strophe, b64_sha1, moment, sizzle, utils, _ } = converse.env;
    const u = converse.env.utils;


    converse.plugins.add('converse-chatboxes', {

        dependencies: ["converse-roster", "converse-vcard"],

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

            // Configuration values for this plugin
            // ====================================
            // Refer to docs/source/configuration.rst for explanations of these
            // configuration settings.
            _converse.api.settings.update({
                auto_join_private_chats: [],
            });
            _converse.api.promises.add([
                'chatBoxesFetched',
                'chatBoxesInitialized',
                'privateChatsAutoJoined'
            ]);

            function openChat (jid) {
                if (!utils.isValidJID(jid)) {
                    return _converse.log(
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

                defaults () {
                    return {
                        'msgid': _converse.connection.getUniqueId(),
                        'time': moment().format()
                    };
                },

                initialize () {
                    this.setVCard();
                    if (this.get('file')) {
                        this.on('change:put', this.uploadFile, this);

                        if (!_.includes([_converse.SUCCESS, _converse.FAILURE], this.get('upload'))) {
                            this.getRequestSlotURL();
                        }
                    }
                    if (this.isOnlyChatStateNotification()) {
                        window.setTimeout(this.destroy.bind(this), 20000);
                    }
                },

                setVCard () {
                    if (this.get('type') === 'groupchat') {
                        const chatbox = this.collection.chatbox,
                              nick = Strophe.getResourceFromJid(this.get('from'));
                        if (chatbox.get('nick') === nick) {
                            this.vcard = _converse.xmppstatus.vcard;
                        } else {
                            const occupant = chatbox.occupants.findWhere({'nick': nick});
                            const jid = (occupant && occupant.get('jid')) ? occupant.get('jid') : this.get('from');
                            this.vcard = _converse.vcards.findWhere({'jid': jid}) || _converse.vcards.create({'jid': jid});
                        }
                    } else {
                        const jid = this.get('from');
                        this.vcard = _converse.vcards.findWhere({'jid': jid}) || _converse.vcards.create({'jid': jid});
                    }
                },

                isOnlyChatStateNotification () {
                    return u.isOnlyChatStateNotification(this);
                },

                getDisplayName () {
                    if (this.get('type') === 'groupchat') {
                        return this.get('nick');
                    } else {
                        return this.vcard.get('fullname') || this.get('from');
                    }
                },

                sendSlotRequestStanza () {
                    /* Send out an IQ stanza to request a file upload slot.
                     *
                     * https://xmpp.org/extensions/xep-0363.html#request
                     */
                    const file = this.get('file');
                    return new Promise((resolve, reject) => {
                        const iq = converse.env.$iq({
                            'from': _converse.jid,
                            'to': this.get('slot_request_url'),
                            'type': 'get'
                        }).c('request', {
                            'xmlns': Strophe.NS.HTTPUPLOAD,
                            'filename': file.name,
                            'size': file.size,
                            'content-type': file.type
                        })
                        _converse.connection.sendIQ(iq, resolve, reject);
                    });
                },

                getRequestSlotURL () {
                    this.sendSlotRequestStanza().then((stanza) => {
                        const slot = stanza.querySelector('slot');
                        if (slot) {
                            this.save({
                                'get':  slot.querySelector('get').getAttribute('url'),
                                'put': slot.querySelector('put').getAttribute('url'),
                            });
                        } else {
                            return this.save({
                                'type': 'error',
                                'message': __("Sorry, could not determine file upload URL.")
                            });
                        }
                    }).catch((e) => {
                        _converse.log(e, Strophe.LogLevel.ERROR);
                        return this.save({
                            'type': 'error',
                            'message': __("Sorry, could not determine upload URL.")
                        });
                    });
                },

                uploadFile () {
                    const xhr = new XMLHttpRequest();
                    xhr.onreadystatechange = () => {
                        if (xhr.readyState === XMLHttpRequest.DONE) {
                            _converse.log("Status: " + xhr.status, Strophe.LogLevel.INFO);
                            if (xhr.status === 200 || xhr.status === 201) {
                                this.save({
                                    'upload': _converse.SUCCESS,
                                    'oob_url': this.get('get'),
                                    'message': this.get('get')
                                });
                            } else {
                                xhr.onerror();
                            }
                        }
                    };

                    xhr.upload.addEventListener("progress", (evt) => {
                        if (evt.lengthComputable) {
                            this.set('progress', evt.loaded / evt.total);
                        }
                    }, false);

                    xhr.onerror = () => {
                        let  message = __('Sorry, could not succesfully upload your file.');
                        if (xhr.responseText) {
                            message += ' ' + __('Your server\'s response: "%1$s"', xhr.responseText)
                        }
                        this.save({
                            'type': 'error',
                            'upload': _converse.FAILURE,
                            'message': message
                        });
                    };
                    xhr.open('PUT', this.get('put'), true);
                    xhr.setRequestHeader("Content-type", 'application/octet-stream');
                    xhr.send(this.get('file'));
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
                    'num_unread': 0,
                    'type': 'chatbox',
                    'message_type': 'chat',
                    'url': ''
                },

                initialize () {
                    this.vcard = _converse.vcards.findWhere({'jid': this.get('jid')});
                    if (_.isNil(this.vcard)) {
                        this.vcard = _converse.vcards.create({'jid': this.get('jid')});
                    }
                    _converse.api.waitUntil('rosterContactsFetched').then(() => {
                        this.addRelatedContact(_converse.roster.findWhere({'jid': this.get('jid')}));
                    });
                    this.messages = new _converse.Messages();
                    this.messages.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                        b64_sha1(`converse.messages${this.get('jid')}${_converse.bare_jid}`));
                    this.messages.chatbox = this;

                    this.messages.on('change:upload', (message) => {
                        if (message.get('upload') === _converse.SUCCESS) {
                            this.sendMessageStanza(message);
                        }
                    });

                    this.on('change:chat_state', this.sendChatState, this);

                    this.save({
                        // The chat_state will be set to ACTIVE once the chat box is opened
                        // and we listen for change:chat_state, so shouldn't set it to ACTIVE here.
                        'box_id' : b64_sha1(this.get('jid')),
                        'time_opened': this.get('time_opened') || moment().valueOf(),
                        'user_id' : Strophe.getNodeFromJid(this.get('jid'))
                    });
                },

                addRelatedContact (contact) {
                    if (!_.isUndefined(contact)) {
                        this.contact = contact;
                        this.trigger('contactAdded', contact);
                    }
                },

                getDisplayName () {
                    return this.vcard.get('fullname') || this.get('jid');
                },

                createMessageStanza (message) {
                    /* Given a _converse.Message Backbone.Model, return the XML
                     * stanza that represents it.
                     *
                     *  Parameters:
                     *    (Object) message - The Backbone.Model representing the message
                     */
                    const stanza = $msg({
                            'from': _converse.connection.jid,
                            'to': this.get('jid'),
                            'type': this.get('message_type'),
                            'id': message.get('msgid')
                        }).c('body').t(message.get('message')).up()
                          .c(_converse.ACTIVE, {'xmlns': Strophe.NS.CHATSTATES}).up();

                    if (message.get('is_spoiler')) {
                        if (message.get('spoiler_hint')) {
                            stanza.c('spoiler', {'xmlns': Strophe.NS.SPOILER }, message.get('spoiler_hint')).up();
                        } else {
                            stanza.c('spoiler', {'xmlns': Strophe.NS.SPOILER }).up();
                        }
                    }
                    if (message.get('file')) {
                        stanza.c('x', {'xmlns': Strophe.NS.OUTOFBAND}).c('url').t(message.get('message')).up();
                    }
                    return stanza;
                },

                sendMessageStanza (message) {
                    const messageStanza = this.createMessageStanza(message);
                    _converse.connection.send(messageStanza);
                    if (_converse.forward_messages) {
                        // Forward the message, so that other connected resources are also aware of it.
                        _converse.connection.send(
                            $msg({
                                'to': _converse.bare_jid,
                                'type': this.get('message_type'),
                                'id': message.get('msgid')
                            }).c('forwarded', {'xmlns': Strophe.NS.FORWARD})
                                .c('delay', {
                                        'xmns': Strophe.NS.DELAY,
                                        'stamp': moment().format()
                                }).up()
                              .cnode(messageStanza.tree())
                        );
                    }
                },

                getOutgoingMessageAttributes (text, spoiler_hint) {
                    const fullname = _converse.xmppstatus.get('fullname'),
                        is_spoiler = this.get('composing_spoiler');

                    return {
                        'fullname': fullname,
                        'from': _converse.bare_jid,
                        'sender': 'me',
                        'time': moment().format(),
                        'message': text ? u.httpToGeoUri(emojione.shortnameToUnicode(text), _converse) : undefined,
                        'is_spoiler': is_spoiler,
                        'spoiler_hint': is_spoiler ? spoiler_hint : undefined
                    };
                },

                sendMessage (attrs) {
                    /* Responsible for sending off a text message.
                     *
                     *  Parameters:
                     *    (Message) message - The chat message
                     */
                    this.sendMessageStanza(this.messages.create(attrs));
                },

                sendChatState () {
                    /* Sends a message with the status of the user in this chat session
                     * as taken from the 'chat_state' attribute of the chat box.
                     * See XEP-0085 Chat State Notifications.
                     */
                    _converse.connection.send(
                        $msg({'to':this.get('jid'), 'type': 'chat'})
                            .c(this.get('chat_state'), {'xmlns': Strophe.NS.CHATSTATES}).up()
                            .c('no-store', {'xmlns': Strophe.NS.HINTS}).up()
                            .c('no-permanent-store', {'xmlns': Strophe.NS.HINTS})
                    );
                },


                sendFiles (files) {
                    _converse.api.disco.supports(Strophe.NS.HTTPUPLOAD, _converse.domain).then((result) => {
                        const item = result.pop(),
                              data = item.dataforms.where({'FORM_TYPE': {'value': Strophe.NS.HTTPUPLOAD, 'type': "hidden"}}).pop(),
                              max_file_size = window.parseInt(_.get(data, 'attributes.max-file-size.value')),
                              slot_request_url = _.get(item, 'id');

                        if (!slot_request_url) {
                            this.messages.create({
                                'message': __("Sorry, looks like file upload is not supported by your server."),
                                'type': 'error',
                            });
                            return;
                        }
                        _.each(files, (file) => {
                            if (!window.isNaN(max_file_size) && window.parseInt(file.size) > max_file_size) {
                                return this.messages.create({
                                    'message': __('The size of your file, %1$s, exceeds the maximum allowed by your server, which is %2$s.',
                                        file.name, filesize(max_file_size)),
                                    'type': 'error',
                                });
                            } else {
                                this.messages.create(
                                    _.extend(
                                        this.getOutgoingMessageAttributes(), {
                                        'file': file,
                                        'progress': 0,
                                        'slot_request_url': slot_request_url,
                                        'type': this.get('message_type'),
                                    })
                                );
                            }
                        });
                    }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                },

                getMessageBody (message) {
                    const type = message.getAttribute('type');
                    return (type === 'error') ?
                        _.propertyOf(message.querySelector('error text'))('textContent') :
                            _.propertyOf(message.querySelector('body'))('textContent');
                },

                getMessageAttributesFromStanza (message, delay, original_stanza) {
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
                    delay = delay || message.querySelector('delay');

                    const { _converse } = this.__super__,
                          { __ } = _converse,
                          spoiler = message.querySelector(`spoiler[xmlns="${Strophe.NS.SPOILER}"]`),
                          chat_state = message.getElementsByTagName(_converse.COMPOSING).length && _converse.COMPOSING ||
                                message.getElementsByTagName(_converse.PAUSED).length && _converse.PAUSED ||
                                message.getElementsByTagName(_converse.INACTIVE).length && _converse.INACTIVE ||
                                message.getElementsByTagName(_converse.ACTIVE).length && _converse.ACTIVE ||
                                message.getElementsByTagName(_converse.GONE).length && _converse.GONE;

                    const attrs = {
                        'type': message.getAttribute('type'),
                        'chat_state': chat_state,
                        'delayed': !_.isNull(delay),
                        'message': this.getMessageBody(message) || undefined,
                        'msgid': message.getAttribute('id'),
                        'time': delay ? delay.getAttribute('stamp') : moment().format(),
                        'is_spoiler': !_.isNull(spoiler)
                    };
                    if (attrs.type === 'groupchat') {
                        attrs.from = message.getAttribute('from');
                        attrs.nick = Strophe.unescapeNode(Strophe.getResourceFromJid(attrs.from));
                        if (attrs.from === this.get('nick')) {
                            attrs.sender = 'me';
                        } else {
                            attrs.sender = 'them';
                        }
                    } else {
                        attrs.from = Strophe.getBareJidFromJid(message.getAttribute('from'));
                        if (attrs.from === _converse.bare_jid) {
                            attrs.sender = 'me';
                            attrs.fullname = _converse.xmppstatus.get('fullname');
                        } else {
                            attrs.sender = 'them';
                            attrs.fullname = this.get('fullname');
                        }
                    }
                    _.each(sizzle(`x[xmlns="${Strophe.NS.OUTOFBAND}"]`, message), (xform) => {
                        attrs['oob_url'] = xform.querySelector('url').textContent;
                        attrs['oob_desc'] = xform.querySelector('url').textContent;
                    });
                    if (spoiler) {
                        attrs.spoiler_hint = spoiler.textContent.length > 0 ? spoiler.textContent : '';
                    }
                    return attrs;
                },

                createMessage (message, delay, original_stanza) {
                    /* Create a Backbone.Message object inside this chat box
                     * based on the identified message stanza.
                     */
                    const attrs = this.getMessageAttributesFromStanza.apply(this, arguments)
                    const is_csn = u.isOnlyChatStateNotification(attrs);
                    if (is_csn && attrs.delayed) {
                        // No need showing old CSNs
                        return;
                    } else if (!is_csn && !attrs.file && !attrs.message && !attrs.oob_url && attrs.type !== 'error') {
                        // TODO: handle <subject> messages (currently being done by ChatRoom)
                        return;
                    } else {
                        return this.messages.create(attrs);
                    }
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

                clearUnreadMsgCounter () {
                    u.safeSave(this, {'num_unread': 0});
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
                    this.el.classList.add(`converse-${_converse.view_mode}`);
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

            function autoJoinChats () {
                /* Automatically join private chats, based on the
                 * "auto_join_private_chats" configuration setting.
                 */
                _.each(_converse.auto_join_private_chats, function (jid) {
                    if (_converse.chatboxes.where({'jid': jid}).length) {
                        return;
                    }
                    if (_.isString(jid)) {
                        _converse.api.chats.open(jid);
                    } else {
                        _converse.log(
                            'Invalid jid criteria specified for "auto_join_private_chats"',
                            Strophe.LogLevel.ERROR);
                    }
                });
                _converse.emit('privateChatsAutoJoined');
            }


            /************************ BEGIN Event Handlers ************************/
            _converse.on('chatBoxesFetched', autoJoinChats);


            _converse.api.waitUntil('rosterContactsFetched').then(() => {
                _converse.roster.on('add', (contact) => {
                    /* When a new contact is added, check if we already have a
                     * chatbox open for it, and if so attach it to the chatbox.
                     */
                    const chatbox = _converse.chatboxes.findWhere({'jid': contact.get('jid')});
                    if (chatbox) {
                        chatbox.addRelatedContact(contact);
                    }
                });
            });


            _converse.on('addClientFeatures', () => {
                _converse.api.disco.own.features.add(Strophe.NS.HTTPUPLOAD);
                _converse.api.disco.own.features.add(Strophe.NS.OUTOFBAND);
            });

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
