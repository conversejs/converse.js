// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

import "backbone.nativeview";
import "converse-chatboxviews";
import "converse-message-view";
import "converse-modal";
import converse from "@converse/headless/converse-core";
import tpl_forward_message_modal from "templates/forward_message_modal.html";
import tpl_forwarded_message_view from "templates/forwarded_message_view.html";

const { $msg, dayjs, _, Strophe, utils, sizzle } = converse.env;
const u = converse.env.utils;
const URL_REGEX = /\b(https?:\/\/|www\.|https?:\/\/www\.)[^\s<>]{2,200}\b\/?/g;

converse.plugins.add('converse-forward-message', {
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
    dependencies: ["converse-chatview", "converse-message-view", "converse-muc"],

    overrides: {
        MessageView: {
            initialize () {
                this.__super__.initialize.apply(this, arguments);
                this.model.collection.on('rendered', this.renderForwardedMessage, this);
            },
        },

        ChatBoxView: {
            events: {
                'click .chat-msg__action-forward': 'onMessageForwardClicked',
            },
        },

        ChatRoomView: {
            events: {
                'click .chat-msg__action-forward': 'onMessageForwardClicked',
            },
        }
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this,
            { __ } = _converse;

        const clickForwardMessage =  {
            onMessageForwardClicked (ev) {
                const { _converse } = this.__super__;
                this.add_forward_modal = new _converse.AddForwardMessageModal(this.model, ev);
                this.add_forward_modal.show(ev);
            },
        };
        Object.assign(_converse.ChatBoxView.prototype, clickForwardMessage);

        const renderForwardedMessages = {
            renderForwardedMessage (message) {
                this.renderForwardButton(message);
                
                if (!message.model.get('is_forwarded_message') || message.el.querySelector('.forwarded-message__content')) {
                    return;
                }
                
                const forwarded_message_element = this.createForwardedMessageHtmlElement(message.model);
                // add msg content as innerText to preserve line endings
                const text_content = forwarded_message_element.querySelector('.forwarded-message__content');
                text_content.innerText = message.model.get('original_message');

                // do not use await for this function call because then the forwarded message will be displayed 
                // many times in the chat-history
                this.renderImageIfPresent(forwarded_message_element);
                const msg_content = message.el.querySelector('.chat-msg__text');
                msg_content.insertAdjacentElement('beforeend', forwarded_message_element);
            },
            
            renderForwardButton (message) {
                const element = message.el.querySelector('.chat-msg__actions');
                if (!_.isNil(element) && !message.el.querySelector('.chat-msg__action-forward')) {
                    element.insertAdjacentHTML('beforeend', '<button class="chat-msg__action chat-msg__action-forward fa fa-share" title="forward this message"></button>');
                }
            },

            createForwardedMessageHtmlElement (model) {
                const time = dayjs(model.get('original_time'));
                return utils.stringToElement(tpl_forwarded_message_view(
                    Object.assign(
                        model.toJSON(), {
                            '__': __,
                            'original_form': model.get('original_from'),
                            'original_to': model.get('orginal_to'),
                            'original_time': time.format('DD.MM.YYYY hh:mm'),
                            'original_type': model.get('original_type')
                        }
                    )
                ));
            },

            async renderImageIfPresent (forwarded_message_element) {
                const forwarded_message = forwarded_message_element.querySelector('.forwarded-message__content');
                if (forwarded_message.textContent.match(URL_REGEX)) {
                    // order of the calls below is important
                    forwarded_message.innerHTML = await this.transformBodyText(forwarded_message.textContent);
                    forwarded_message.innerHTML = await this.transformOOBURL(forwarded_message.textContent);
                    await utils.renderImageURLs(_converse, forwarded_message_element);
                }
            }
        };
        Object.assign(_converse.MessageView.prototype, renderForwardedMessages);

        _converse.AddForwardMessageModal = _converse.BootstrapModal.extend({
            events: {
                'submit form.forward-message-form': 'forwardMessage'
            },

            initialize (chat_model, target_element) {
                this.message = this.getMessageTextFromTargetElement(target_element, chat_model);
                this.model = chat_model;
                _converse.BootstrapModal.prototype.initialize.apply(this, chat_model);
            },

            getMessageTextFromTargetElement (target_element, chat_model) {
                const message_action_menu_element = target_element.target.parentElement;
                const message_body_element = message_action_menu_element.parentElement;
                const message_element = message_body_element.parentElement.parentElement;
                return chat_model.messages.findWhere({'msgid': message_element.getAttribute('data-msgid')});
            },

            toHTML () {
                return tpl_forward_message_modal(Object.assign(this.model.toJSON(), {
                    '__': __
                }));
            },

            afterRender () {
                const text_element = this.el.querySelector('.forward-message');
                text_element.innerText = this.message.get('message');

                this.el.addEventListener('shown.bs.modal', () => {
                    this.el.querySelector('input[name="receiver"]').focus();
                }, false);

                this.addAutocomplete();
            },

            addAutocomplete () {
                const contacts = _converse.roster.map(i => ({'label': i.getDisplayName(), 'value': i.get('jid')}));
                let open_rooms;
                if (_converse.rooms_list_view.model) {
                    open_rooms = _converse.rooms_list_view.model.map(i => ({'label': i.get('name'), 'value': i.get('jid')}));
                }
                const suggestion_list = contacts.concat(open_rooms);

                if (this.invite_auto_complete) {
                    this.invite_auto_complete.destroy();
                }
                this.invite_auto_complete = new _converse.AutoComplete(this.el, {
                    'min_chars': 1,
                    'list': suggestion_list
                });

                // prevents suggestion-element to be displayed on load
                const suggestion_element = this.el.querySelector('.suggestion-box__results');
                suggestion_element.hidden = true;
            },

            forwardMessage (ev) {
                ev.preventDefault();
                const form_data = this.getJidFromModalForm(ev.target);

                if (!this.isJidOpenMuc(form_data.receiver) && !this.isJidExistingContact(form_data.receiver)) {
                    alert(__("You can only send a message to an existing contact or an opened room."));
                    return;
                }

                this.modal.hide();
                ev.target.reset();
                this.send(form_data);
            },

            getJidFromModalForm (form) {
                const data = new FormData(form);
                const receiver = data.get('receiver');
                const additional_message = data.get('additional_message');
                const original_message = data.get('original_message');
                return {
                    'receiver': receiver,
                    'additional_message': additional_message,
                    'original_message': original_message
                };
            },

            async isJidOpenMuc (jid) {
                const rooms = await _converse.api.rooms.get();
                const temp = rooms.find(room => {
                    return room.id === jid;
                });
                return temp !== undefined;
            },

            isJidExistingContact (jid) {
                const contact = _converse.roster.models.find(function (model) { 
                    return model.get('jid') === jid; 
                });
                return contact !== undefined;
            },

            async send (form_data) {
                const msg_id = _converse.connection.getUniqueId();
                const chat_type = await this.getChatType(form_data);
                const message = $msg({
                    'from': _converse.connection.jid,
                    'to': form_data.receiver,
                    'type': chat_type,
                    'id': msg_id
                }).c('body').t(form_data.additional_message).up();

                message.c('forwarded', {'xmlns': Strophe.NS.FORWARD})
                    .c('delay', {'xmlns': Strophe.NS.DELAY, 'stamp': this.message.get('time')}).up();

                message.c('message', {
                    'from': this.message.get('from'),
                    'to': this.model.get('jid'),
                    'id': this.message.get('id'),
                    'type': this.message.get('type'),
                    'xmlns': 'jabber:client'
                    }).c('body').t(this.message.get('message')).up().root();

                message.c('request', {'xmlns': Strophe.NS.RECEIPTS}).root();

                _converse.api.send(message);
                this.addForwardedMessageToChatHistory(form_data, msg_id);
            },

            async getChatType (form_data) {
                const chat = await _converse.api.chats.get(form_data.receiver);
                if (chat) {
                    return chat.get('message_type');
                } else {
                    return "groupchat";
                }
            },

            async addForwardedMessageToChatHistory (form_data, msg_id) {
                if (!this.isJidExistingContact(form_data.receiver)) {
                    return;
                }

                const chat = await _converse.api.chats.get(form_data.receiver);
                if (_.isNil(chat)) {
                    await _converse.api.chats.create(form_data.receiver, {'minimized': true});
                    chat.save({'num_unread': chat.get('num_unread') + 1});
                    _converse.incrementMsgCounter();
                } else {
                    const chat_type = await this.getChatType(form_data);
                    const attrs = Object.assign({
                        'is_archived': false,
                        'is_delayed': false,
                        'is_spoiler': false,
                        'is_single_emoji': false,
                        'message': form_data.additional_message,
                        'msgid': msg_id,
                        'type': chat_type,
                        'is_forwarded_message': true,
                        'original_time': this.message.get('time'),
                        'original_id': this.message.get('id'),
                        'original_message': this.message.get('message'),
                        'original_from': this.message.get('from'),
                        'original_to': this.message.get('to'),
                        'original_type': this.message.get('type'),
                    });

                    attrs.from = _converse.bare_jid;
                    if (attrs.type === 'groupchat') {
                        attrs.nick = Strophe.unescapeNode(Strophe.getResourceFromJid(attrs.from));
                        attrs.sender = attrs.nick === this.model.get('nickname') ? 'me': 'them';
                        attrs.received = (new Date()).toISOString();
                    } else {
                        if (attrs.from === _converse.bare_jid) {
                            attrs.sender = 'me';
                            attrs.fullname = _converse.xmppstatus.get('fullname');
                        } else {
                            attrs.sender = 'them';
                            attrs.fullname = this.model.get('fullname')
                        }
                    }
                    const msg = chat.messages.create(attrs);
                    chat.incrementUnreadMsgCounter(msg);    
                }
            }
        });

        function rejectMessage (stanza, text) {
            // Reject an incoming message by replying with an error message of type "cancel".
            _converse.api.send(
                $msg({
                    'to': stanza.getAttribute('from'),
                    'type': 'error',
                    'id': stanza.getAttribute('id')
                }).c('error', {'type': 'cancel'})
                    .c('not-allowed', {xmlns:"urn:ietf:params:xml:ns:xmpp-stanzas"}).up()
                    .c('text', {xmlns:"urn:ietf:params:xml:ns:xmpp-stanzas"}).t(text)
            );
            _converse.log(`Rejecting message stanza with the following reason: ${text}`, Strophe.LogLevel.WARN);
            _converse.log(stanza, Strophe.LogLevel.WARN);
        }

        // copy of the converse-muc onMessage-method with some changes to make it work
        async function onMucMessage (stanza, forwarded_attrs) {
            const room = await _converse.api.rooms.get(Strophe.getBareJidFromJid(stanza.getAttribute('from')));
            const original_stanza = stanza;

            const is_carbon = u.isCarbonMessage(stanza);
            if (is_carbon) {
                // XEP-280: groupchat messages SHOULD NOT be carbon copied, so we're discarding it.
                return _converse.log(
                    'onMessage: Ignoring XEP-0280 "groupchat" message carbon, '+
                    'according to the XEP groupchat messages SHOULD NOT be carbon copied',
                    Strophe.LogLevel.WARN
                );
            }
            const is_mam = u.isMAMMessage(stanza);
            if (is_mam) {
                if (original_stanza.getAttribute('from') === room.get('jid')) {
                    const selector = `[xmlns="${Strophe.NS.MAM}"] > forwarded[xmlns="${Strophe.NS.FORWARD}"] > message`;
                    stanza = sizzle(selector, stanza).pop();
                } else {
                    return _converse.log(
                        `onMessage: Ignoring alleged MAM groupchat message from ${stanza.getAttribute('from')}`,
                        Strophe.LogLevel.WARN
                    );
                }
            }

            room.createInfoMessages(stanza);
            room.fetchFeaturesIfConfigurationChanged(stanza);

            const message = await room.getDuplicateMessage(original_stanza);
            if (message) {
                room.updateMessage(message, original_stanza);
                return;
            }
            let attrs = await room.getMessageAttributesFromStanza(stanza, original_stanza);
            attrs = Object.assign(attrs, forwarded_attrs);
            room.setEditable(attrs, attrs.time);
            if (attrs.nick &&
                    !room.subjectChangeHandled(attrs) &&
                    !room.ignorableCSN(attrs) &&
                    (attrs['chat_state'] || !u.isEmptyMessage(attrs))) {

                const msg = room.correctMessage(attrs) ||
                    await new Promise((success, reject) => {
                        room.messages.create(
                            attrs,
                            { success, 'erorr': (m, e) => reject(e) }
                        )
                    });
                room.incrementUnreadMsgCounter(msg);
            }
            _converse.api.trigger('message', {'stanza': original_stanza, 'chatbox': this});
        }

        // "copy" from "handleMessageStanza" and "onMessage" with some small changes to make it work
        async function onChatMessage (stanza, forwarded_attrs) {
            const original_stanza = stanza;
            let to_jid = stanza.getAttribute('to');
            const to_resource = Strophe.getResourceFromJid(to_jid);

            if (_converse.filter_by_resource && (to_resource && to_resource !== _converse.resource)) {
                return _converse.log(
                    `onMessage: Ignoring incoming message intended for a different resource: ${to_jid}`,
                    Strophe.LogLevel.INFO
                );
            }

            let from_jid = stanza.getAttribute('from') || _converse.bare_jid;
            if (u.isCarbonMessage(stanza)) {
                if (from_jid === _converse.bare_jid) {
                    const selector = `[xmlns="${Strophe.NS.CARBONS}"] > forwarded[xmlns="${Strophe.NS.FORWARD}"] > message`;
                    stanza = sizzle(selector, stanza).pop();
                    to_jid = stanza.getAttribute('to');
                    from_jid = stanza.getAttribute('from');
                } else {
                    // Prevent message forging via carbons: https://xmpp.org/extensions/xep-0280.html#security
                    return rejectMessage(stanza, 'Rejecting carbon from invalid JID');
                }
            }

            if (u.isMAMMessage(stanza)) {
                if (from_jid === _converse.bare_jid) {
                    const selector = `[xmlns="${Strophe.NS.MAM}"] > forwarded[xmlns="${Strophe.NS.FORWARD}"] > message`;
                    stanza = sizzle(selector, stanza).pop();
                    to_jid = stanza.getAttribute('to');
                    from_jid = stanza.getAttribute('from');
                } else {
                    return _converse.log(
                        `onMessage: Ignoring alleged MAM message from ${stanza.getAttribute('from')}`,
                        Strophe.LogLevel.WARN
                    );
                }
            }

            const from_bare_jid = Strophe.getBareJidFromJid(from_jid);
            const is_me = from_bare_jid === _converse.bare_jid;
            if (is_me && to_jid === null) {
                return _converse.log(
                    `Don't know how to handle message stanza without 'to' attribute. ${stanza.outerHTML}`,
                    Strophe.LogLevel.ERROR
                );
            }

            const contact_jid = is_me ? Strophe.getBareJidFromJid(to_jid) : from_bare_jid;
            const contact = await _converse.api.contacts.get(contact_jid);
            if (contact === undefined && !_converse.allow_non_roster_messaging) {
                _converse.log(
                    `Blocking messaging with a JID not in our roster because allow_non_roster_messaging is false.`,
                    Strophe.LogLevel.ERROR
                );
                return _converse.log(stanza, Strophe.LogLevel.ERROR);
            }

            // Get chat box, but only create when the message has something to show to the user
            const has_body = sizzle(`body, encrypted[xmlns="${Strophe.NS.OMEMO}"]`, stanza).length > 0;
            const roster_nick = contact.get('nickname');
            const chatbox = await _converse.api.chats.get(contact_jid, {'nickname': roster_nick}, has_body);

            const message = await chatbox.getDuplicateMessage(stanza);
            if (message) {
                chatbox.updateMessage(message, original_stanza);
            } else {
                if (
                    !chatbox.handleReceipt (stanza, from_jid) &&
                    !chatbox.handleChatMarker(stanza, from_jid)
                ) {
                    let attrs = await chatbox.getMessageAttributesFromStanza(stanza, original_stanza);
                    chatbox.setEditable(attrs, attrs.time, stanza);
                    attrs = Object.assign(attrs, forwarded_attrs);
                    if (attrs['chat_state'] || !u.isEmptyMessage(attrs)) {
                        const msg = chatbox.correctMessage(attrs) || chatbox.messages.create(attrs);
                        chatbox.incrementUnreadMsgCounter(msg);
                    }
                }
            }
        }

        function getForwardedMessageAttributesFromStanza (stanza) {
            const forwarded_message = sizzle(`forwarded[xmlns="${Strophe.NS.FORWARD}"]`, stanza).pop();
            const delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, forwarded_message).pop();
            // read all the attribtues from the forwarded-message and add them to the attrs-variable
            return Object.assign({
                'is_forwarded_message': true,
                'original_time': delay ? dayjs(delay.getAttribute('stamp')).toISOString() : (new Date()).toISOString(),
                'original_id': forwarded_message.querySelector('message').getAttribute('id'),
                'original_message': forwarded_message.querySelector('body').innerHTML,
                'original_from': forwarded_message.querySelector('message').getAttribute('from'),
                'original_to': forwarded_message.querySelector('message').getAttribute('to'),
                'original_type': forwarded_message.querySelector('message').getAttribute('type')
            });
        }

        function onForwardedMessage (stanza) {
            const forwarded_attrs = getForwardedMessageAttributesFromStanza(stanza);
            
            // remove forwarded message from stanza
            // prevents reading attributes from the inner message if the attribute is missing in the outer message
            const forwarded_message = sizzle(`forwarded[xmlns="${Strophe.NS.FORWARD}"]`, stanza).pop();
            forwarded_message.parentElement.removeChild(forwarded_message);
    
            const chat_type = stanza.getAttribute('type');
            if (chat_type === 'groupchat'){
                onMucMessage(stanza, forwarded_attrs);
            } else {
                onChatMessage(stanza, forwarded_attrs);
            }
        }

        function registerMessageForwardingHandlerForChat () {
            _converse.connection.addHandler(stanza => {
                if (sizzle(`message > forwarded[xmlns="${Strophe.NS.FORWARD}"]`, stanza).pop()) {
                    // clone Node so changes to the original stanza and this stanza interfere with each other
                    onForwardedMessage(stanza.cloneNode(true));
                }
                return true;
            }, null, 'message');
        }
        _converse.api.listen.on('connected', registerMessageForwardingHandlerForChat);
        _converse.api.listen.on('reconnected', registerMessageForwardingHandlerForChat);

        _converse.api.listen.on('addClientFeatures', () => _converse.api.disco.own.features.add(Strophe.NS.FORWARD));
    }
});
