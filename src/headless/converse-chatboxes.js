// Converse.js
// https://conversejs.org
//
// Copyright (c) 2012-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)
/**
 * @module converse-chatboxes
 */
import "./converse-emoji";
import "./utils/form";
import { get, isObject, isString, propertyOf } from "lodash";
import BrowserStorage from "backbone.browserStorage";
import converse from "./converse-core";
import filesize from "filesize";

const { $msg, Backbone, Strophe, dayjs, sizzle, utils } = converse.env;
const u = converse.env.utils;

Strophe.addNamespace('MESSAGE_CORRECT', 'urn:xmpp:message-correct:0');
Strophe.addNamespace('RECEIPTS', 'urn:xmpp:receipts');
Strophe.addNamespace('REFERENCE', 'urn:xmpp:reference:0');
Strophe.addNamespace('MARKERS', 'urn:xmpp:chat-markers:0');


converse.plugins.add('converse-chatboxes', {

    dependencies: ["converse-emoji", "converse-roster", "converse-vcard"],

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
            'auto_join_private_chats': [],
            'clear_messages_on_reconnection': false,
            'filter_by_resource': false,
            'allow_message_corrections': 'all',
            'send_chat_state_notifications': true
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
            _converse.api.chats.open(jid);
        }
        _converse.router.route('converse/chat?jid=:jid', openChat);


        const ModelWithContact = Backbone.Model.extend({

            initialize () {
                this.rosterContactAdded = u.getResolveablePromise();
            },

            async setRosterContact (jid) {
                const contact = await _converse.api.contacts.get(jid);
                if (contact) {
                    this.contact = contact;
                    this.set('nickname', contact.get('nickname'));
                    this.rosterContactAdded.resolve();
                }
            }
        });


        /**
         * Represents a non-MUC message. These can be either `chat` messages or
         * `headline` messages.
         * @class
         * @namespace _converse.Message
         * @memberOf _converse
         * @example const msg = new _converse.Message({'message': 'hello world!'});
         */
        _converse.Message = ModelWithContact.extend({

            defaults () {
                return {
                    'msgid': _converse.connection.getUniqueId(),
                    'time': (new Date()).toISOString(),
                    'ephemeral': false
                };
            },

            initialize () {
                ModelWithContact.prototype.initialize.apply(this, arguments);

                if (this.get('type') === 'chat') {
                    this.setVCard();
                    this.setRosterContact(Strophe.getBareJidFromJid(this.get('from')));
                }

                if (this.get('file')) {
                    this.on('change:put', this.uploadFile, this);
                }
                if (this.isEphemeral()) {
                    window.setTimeout(this.safeDestroy.bind(this), 10000);
                }
            },

            safeDestroy () {
                try {
                    this.destroy()
                } catch (e) {
                    _converse.log(e, Strophe.LogLevel.ERROR);
                }
            },

            setVCard () {
                if (!_converse.vcards) {
                    // VCards aren't supported
                    return;
                }
                if (this.get('type') === 'error') {
                    return;
                } else {
                    const jid = Strophe.getBareJidFromJid(this.get('from'));
                    this.vcard = _converse.vcards.findWhere({'jid': jid}) || _converse.vcards.create({'jid': jid});
                }
            },

            isOnlyChatStateNotification () {
                return u.isOnlyChatStateNotification(this);
            },

            isEphemeral () {
                return this.isOnlyChatStateNotification() || this.get('ephemeral');
            },

            getDisplayName () {
                if (this.get('type') === 'groupchat') {
                    return this.get('nick');
                } else if (this.contact) {
                    return this.contact.getDisplayName();
                } else if (this.vcard) {
                    return this.vcard.getDisplayName();
                } else {
                    return this.get('from');
                }
            },

            getMessageText () {
                if (this.get('is_encrypted')) {
                    return this.get('plaintext') ||
                           (_converse.debug ? __('Unencryptable OMEMO message') : null);
                }
                return this.get('message');
            },

            isMeCommand () {
                const text = this.getMessageText();
                if (!text) {
                    return false;
                }
                return text.startsWith('/me ');
            },

            sendSlotRequestStanza () {
                /* Send out an IQ stanza to request a file upload slot.
                 *
                 * https://xmpp.org/extensions/xep-0363.html#request
                 */
                if (!this.file) {
                    return Promise.reject(new Error("file is undefined"));
                }
                const iq = converse.env.$iq({
                    'from': _converse.jid,
                    'to': this.get('slot_request_url'),
                    'type': 'get'
                }).c('request', {
                    'xmlns': Strophe.NS.HTTPUPLOAD,
                    'filename': this.file.name,
                    'size': this.file.size,
                    'content-type': this.file.type
                })
                return _converse.api.sendIQ(iq);
            },

            async getRequestSlotURL () {
                let stanza;
                try {
                    stanza = await this.sendSlotRequestStanza();
                } catch (e) {
                    _converse.log(e, Strophe.LogLevel.ERROR);
                    return this.save({
                        'type': 'error',
                        'message': __("Sorry, could not determine upload URL."),
                        'ephemeral': true
                    });
                }
                const slot = stanza.querySelector('slot');
                if (slot) {
                    this.save({
                        'get':  slot.querySelector('get').getAttribute('url'),
                        'put': slot.querySelector('put').getAttribute('url'),
                    });
                } else {
                    return this.save({
                        'type': 'error',
                        'message': __("Sorry, could not determine file upload URL."),
                        'ephemeral': true
                    });
                }
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
                    let message;
                    if (xhr.responseText) {
                        message = __('Sorry, could not succesfully upload your file. Your server’s response: "%1$s"', xhr.responseText)
                    } else {
                        message = __('Sorry, could not succesfully upload your file.');
                    }
                    this.save({
                        'type': 'error',
                        'upload': _converse.FAILURE,
                        'message': message,
                        'ephemeral': true
                    });
                };
                xhr.open('PUT', this.get('put'), true);
                xhr.setRequestHeader("Content-type", this.file.type);
                xhr.send(this.file);
            }
        });


        _converse.Messages = _converse.Collection.extend({
            model: _converse.Message,
            comparator: 'time'
        });


        /**
         * Represents an open/ongoing chat conversation.
         *
         * @class
         * @namespace _converse.ChatBox
         * @memberOf _converse
         */
        _converse.ChatBox = ModelWithContact.extend({
            messagesCollection: _converse.Messages,

            defaults () {
                return {
                    'bookmarked': false,
                    'chat_state': undefined,
                    'hidden': ['mobile', 'fullscreen'].includes(_converse.view_mode),
                    'message_type': 'chat',
                    'nickname': undefined,
                    'num_unread': 0,
                    'time_sent': (new Date(0)).toISOString(),
                    'time_opened': this.get('time_opened') || (new Date()).getTime(),
                    'type': _converse.PRIVATE_CHAT_TYPE,
                    'url': ''
                }
            },

            initialize () {
                ModelWithContact.prototype.initialize.apply(this, arguments);

                const jid = this.get('jid');
                if (!jid) {
                    // XXX: The `validate` method will prevent this model
                    // from being persisted if there's no jid, but that gets
                    // called after model instantiation, so we have to deal
                    // with invalid models here also.
                    // This happens when the controlbox is in browser storage,
                    // but we're in embedded mode.
                    return;
                }
                this.set({'box_id': `box-${btoa(jid)}`});

                if (_converse.vcards) {
                    this.vcard = _converse.vcards.findWhere({'jid': jid}) || _converse.vcards.create({'jid': jid});
                }
                if (this.get('type') === _converse.PRIVATE_CHAT_TYPE) {
                    this.presence = _converse.presences.findWhere({'jid': jid}) || _converse.presences.create({'jid': jid});
                    this.setRosterContact(jid);
                }
                this.on('change:chat_state', this.sendChatState, this);
                this.initMessages();
                this.fetchMessages();
            },

            getMessagesCacheKey () {
                return `converse.messages-${this.get('jid')}-${_converse.bare_jid}`;
            },

            initMessages () {
                this.messages = new this.messagesCollection();
                const storage = _converse.config.get('storage');
                this.messages.browserStorage = new BrowserStorage[storage](this.getMessagesCacheKey());
                this.messages.chatbox = this;
                this.listenTo(this.messages, 'change:upload', message => {
                    if (message.get('upload') === _converse.SUCCESS) {
                        _converse.api.send(this.createMessageStanza(message));
                    }
                });
            },

            afterMessagesFetched () {
                /**
                 * Triggered whenever a `_converse.ChatBox` instance has fetched its messages from
                 * `sessionStorage` but **NOT** from the server.
                 * @event _converse#afterMessagesFetched
                 * @type {_converse.ChatBox | _converse.ChatRoom}
                 * @example _converse.api.listen.on('afterMessagesFetched', view => { ... });
                 */
                _converse.api.trigger('afterMessagesFetched', this);
            },

            fetchMessages () {
                if (this.messages.fetched) {
                    _converse.log(`Not re-fetching messages for ${this.get('jid')}`, Strophe.LogLevel.INFO);
                    return;
                }
                this.messages.fetched = u.getResolveablePromise();
                const resolve = this.messages.fetched.resolve;
                this.messages.fetch({
                    'add': true,
                    'success': () => { this.afterMessagesFetched(); resolve() },
                    'error': () => { this.afterMessagesFetched(); resolve() }
                });
                return this.messages.fetched;
            },

            clearMessages () {
                try {
                    this.messages.models.forEach(m => m.destroy());
                    this.messages.reset();
                } catch (e) {
                    this.messages.trigger('reset');
                    _converse.log(e, Strophe.LogLevel.ERROR);
                } finally {
                    delete this.messages.fetched;
                    this.messages.browserStorage._clear();
                }
            },

            close () {
                try {
                    this.destroy();
                } catch (e) {
                    _converse.log(e, Strophe.LogLevel.ERROR);
                } finally {
                    if (_converse.clear_messages_on_reconnection) {
                        this.clearMessages();
                    }
                }
            },

            announceReconnection () {
                /**
                 * Triggered whenever a `_converse.ChatBox` instance has reconnected after an outage
                 * @event _converse#onChatReconnected
                 * @type {_converse.ChatBox | _converse.ChatRoom}
                 * @example _converse.api.listen.on('onChatReconnected', chatbox => { ... });
                 */
                _converse.api.trigger('chatReconnected', this);
            },

            onReconnection () {
                if (_converse.clear_messages_on_reconnection) {
                    this.clearMessages();
                }
                this.announceReconnection();
            },

            validate (attrs) {
                if (!attrs.jid) {
                    return 'Ignored ChatBox without JID';
                }
                const room_jids = _converse.auto_join_rooms.map(s => isObject(s) ? s.jid : s);
                const auto_join = _converse.auto_join_private_chats.concat(room_jids);
                if (_converse.singleton && !auto_join.includes(attrs.jid) && !_converse.auto_join_on_invite) {
                    const msg = `${attrs.jid} is not allowed because singleton is true and it's not being auto_joined`;
                    _converse.log(msg, Strophe.LogLevel.WARN);
                    return msg;
                }
            },

            getDisplayName () {
                if (this.contact) {
                    return this.contact.getDisplayName();
                } else if (this.vcard) {
                    return this.vcard.getDisplayName();
                } else {
                    return this.get('jid');
                }
            },

            createMessageFromError (error) {
                if (error instanceof _converse.TimeoutError) {
                    const msg = this.messages.create({'type': 'error', 'message': error.message, 'retry': true});
                    msg.error = error;
                }
            },

            getOldestMessage () {
                for (let i=0; i<this.messages.length; i++) {
                    const message = this.messages.at(i);
                    if (message.get('type') === this.get('message_type')) {
                        return message;
                    }
                }
            },


            getMostRecentMessage () {
                for (let i=this.messages.length-1; i>=0; i--) {
                    const message = this.messages.at(i);
                    if (message.get('type') === this.get('message_type')) {
                        return message;
                    }
                }
            },

            getUpdatedMessageAttributes (message, stanza) {  // eslint-disable-line no-unused-vars
                // Overridden in converse-muc and converse-mam
                return {};
            },

            updateMessage (message, stanza) {
                // Overridden in converse-muc and converse-mam
                const attrs = this.getUpdatedMessageAttributes(message, stanza);
                if (attrs) {
                    message.save(attrs);
                }
            },

            /**
             * Mutator for setting the chat state of this chat session.
             * Handles clearing of any chat state notification timeouts and
             * setting new ones if necessary.
             * Timeouts are set when the  state being set is COMPOSING or PAUSED.
             * After the timeout, COMPOSING will become PAUSED and PAUSED will become INACTIVE.
             * See XEP-0085 Chat State Notifications.
             * @private
             * @method _converse.ChatBox#setChatState
             * @param { string } state - The chat state (consts ACTIVE, COMPOSING, PAUSED, INACTIVE, GONE)
             */
            setChatState (state, options) {
                if (this.chat_state_timeout !== undefined) {
                    window.clearTimeout(this.chat_state_timeout);
                    delete this.chat_state_timeout;
                }
                if (state === _converse.COMPOSING) {
                    this.chat_state_timeout = window.setTimeout(
                        this.setChatState.bind(this),
                        _converse.TIMEOUTS.PAUSED,
                        _converse.PAUSED
                    );
                } else if (state === _converse.PAUSED) {
                    this.chat_state_timeout = window.setTimeout(
                        this.setChatState.bind(this),
                        _converse.TIMEOUTS.INACTIVE,
                        _converse.INACTIVE
                    );
                }
                this.set('chat_state', state, options);
                return this;
            },

            /**
             * @private
             * @method _converse.ChatBox#shouldShowErrorMessage
             * @returns {boolean}
             */
            shouldShowErrorMessage (stanza) {
                const id = stanza.getAttribute('id');
                if (id) {
                    const msgs = this.messages.where({'msgid': id});
                    const referenced_msgs = msgs.filter(m => m.get('type') !== 'error');
                    if (!referenced_msgs.length && stanza.querySelector('body') === null) {
                        // If the error refers to a message not included in our store,
                        // and it doesn't have a <body> tag, we assume that this was a
                        // CSI message (which we don't store).
                        // See https://github.com/conversejs/converse.js/issues/1317
                        return;
                    }
                    const dupes = msgs.filter(m => m.get('type') === 'error');
                    if (dupes.length) {
                        return;
                    }
                }
                // Gets overridden in ChatRoom
                return true;
            },

            /**
             * If the passed in `message` stanza contains an
             * [XEP-0308](https://xmpp.org/extensions/xep-0308.html#usecase)
             * `<replace>` element, return its `id` attribute.
             * @private
             * @method _converse.ChatBox#getReplaceId
             * @param { XMLElement } stanza
             */
            getReplaceId (stanza) {
                const el = sizzle(`replace[xmlns="${Strophe.NS.MESSAGE_CORRECT}"]`, stanza).pop();
                if (el) {
                    return el.getAttribute('id');
                }
            },

            /**
             * Determine whether the passed in message attributes represent a
             * message which corrects a previously received message, or an
             * older message which has already been corrected.
             * In both cases, update the corrected message accordingly.
             * @private
             * @method _converse.ChatBox#correctMessage
             * @param { object } attrs - Attributes representing a received
             *     message, as returned by
             *     {@link _converse.ChatBox.getMessageAttributesFromStanza}
             */
            correctMessage (attrs) {
                if (!attrs.replaced_id || !attrs.from) {
                    return;
                }
                const message = this.messages.findWhere({'msgid': attrs.replaced_id, 'from': attrs.from});
                if (!message) {
                    return;
                }
                const older_versions = message.get('older_versions') || {};
                if ((attrs.time < message.get('time')) && message.get('edited')) {
                    // This is an older message which has been corrected afterwards
                    older_versions[attrs.time] = attrs['message'];
                    message.save({'older_versions': older_versions});
                } else {
                    // This is a correction of an earlier message we already received
                    older_versions[message.get('time')] = message.get('message');
                    attrs = Object.assign(attrs, {'older_versions': older_versions});
                    delete attrs['id']; // Delete id, otherwise a new cache entry gets created
                    message.save(attrs);
                }
                return message;
            },

            async getDuplicateMessage (stanza) {
                return this.findDuplicateFromOriginID(stanza) ||
                    await this.findDuplicateFromStanzaID(stanza) ||
                    this.findDuplicateFromMessage(stanza);
            },

            findDuplicateFromOriginID  (stanza) {
                const origin_id = sizzle(`origin-id[xmlns="${Strophe.NS.SID}"]`, stanza).pop();
                if (!origin_id) {
                    return null;
                }
                return this.messages.findWhere({
                    'origin_id': origin_id.getAttribute('id'),
                    'from': stanza.getAttribute('from')
                });
            },

            async findDuplicateFromStanzaID (stanza) {
                const stanza_id = sizzle(`stanza-id[xmlns="${Strophe.NS.SID}"]`, stanza).pop();
                if (!stanza_id) {
                    return false;
                }
                const by_jid = stanza_id.getAttribute('by');
                if (!(await _converse.api.disco.supports(Strophe.NS.SID, by_jid))) {
                    return false;
                }
                const query = {};
                query[`stanza_id ${by_jid}`] = stanza_id.getAttribute('id');
                return this.messages.findWhere(query);
            },

            findDuplicateFromMessage (stanza) {
                const text = this.getMessageBody(stanza) || undefined;
                if (!text) { return false; }
                const id = stanza.getAttribute('id');
                if (!id) { return false; }
                return this.messages.findWhere({
                    'message': text,
                    'from': stanza.getAttribute('from'),
                    'msgid': id
                });
            },

            sendMarker(to_jid, id, type) {
                const stanza = $msg({
                    'from': _converse.connection.jid,
                    'id': _converse.connection.getUniqueId(),
                    'to': to_jid,
                    'type': 'chat',
                }).c(type, {'xmlns': Strophe.NS.MARKERS, 'id': id});
                _converse.api.send(stanza);
            },

            handleChatMarker (stanza, from_jid, is_carbon, is_roster_contact, is_mam) {
                const to_bare_jid = Strophe.getBareJidFromJid(stanza.getAttribute('to'));
                if (to_bare_jid !== _converse.bare_jid) {
                    return false;
                }
                const markers = sizzle(`[xmlns="${Strophe.NS.MARKERS}"]`, stanza);
                if (markers.length === 0) {
                    return false;
                } else if (markers.length > 1) {
                    _converse.log(
                        'handleChatMarker: Ignoring incoming stanza with multiple message markers',
                        Strophe.LogLevel.ERROR
                    );
                    _converse.log(stanza, Strophe.LogLevel.ERROR);
                    return false;
                } else {
                    const marker = markers.pop();
                    if (marker.nodeName === 'markable') {
                        if (is_roster_contact && !is_carbon && !is_mam) {
                            this.sendMarker(from_jid, stanza.getAttribute('id'), 'received');
                        }
                        return false;
                    } else {
                        const msgid = marker && marker.getAttribute('id'),
                            message = msgid && this.messages.findWhere({msgid}),
                            field_name = `marker_${marker.nodeName}`;

                        if (message && !message.get(field_name)) {
                            message.save({field_name: (new Date()).toISOString()});
                        }
                        return true;
                    }
                }
            },

            sendReceiptStanza (to_jid, id) {
                const receipt_stanza = $msg({
                    'from': _converse.connection.jid,
                    'id': _converse.connection.getUniqueId(),
                    'to': to_jid,
                    'type': 'chat',
                }).c('received', {'xmlns': Strophe.NS.RECEIPTS, 'id': id}).up()
                .c('store', {'xmlns': Strophe.NS.HINTS}).up();
                _converse.api.send(receipt_stanza);
            },

            handleReceipt (stanza, from_jid, is_carbon, is_me) {
                const requests_receipt = sizzle(`request[xmlns="${Strophe.NS.RECEIPTS}"]`, stanza).pop() !== undefined;
                if (requests_receipt && !is_carbon && !is_me) {
                    this.sendReceiptStanza(from_jid, stanza.getAttribute('id'));
                }
                const to_bare_jid = Strophe.getBareJidFromJid(stanza.getAttribute('to'));
                if (to_bare_jid === _converse.bare_jid) {
                    const receipt = sizzle(`received[xmlns="${Strophe.NS.RECEIPTS}"]`, stanza).pop();
                    if (receipt) {
                        const msgid = receipt && receipt.getAttribute('id'),
                            message = msgid && this.messages.findWhere({msgid});
                        if (message && !message.get('received')) {
                            message.save({'received': (new Date()).toISOString()});
                        }
                        return true;
                    }
                }
                return false;
            },

            /**
             * Given a {@link _converse.Message} return the XML stanza that represents it.
             * @private
             * @method _converse.ChatBox#createMessageStanza
             * @param { _converse.Message } message - The message object
             */
            createMessageStanza (message) {
                const stanza = $msg({
                        'from': _converse.connection.jid,
                        'to': this.get('jid'),
                        'type': this.get('message_type'),
                        'id': message.get('edited') && _converse.connection.getUniqueId() || message.get('msgid'),
                    }).c('body').t(message.get('message')).up()
                      .c(_converse.ACTIVE, {'xmlns': Strophe.NS.CHATSTATES}).root();

                if (message.get('type') === 'chat') {
                    stanza.c('request', {'xmlns': Strophe.NS.RECEIPTS}).root();
                }
                if (message.get('is_spoiler')) {
                    if (message.get('spoiler_hint')) {
                        stanza.c('spoiler', {'xmlns': Strophe.NS.SPOILER}, message.get('spoiler_hint')).root();
                    } else {
                        stanza.c('spoiler', {'xmlns': Strophe.NS.SPOILER}).root();
                    }
                }
                (message.get('references') || []).forEach(reference => {
                    const attrs = {
                        'xmlns': Strophe.NS.REFERENCE,
                        'begin': reference.begin,
                        'end': reference.end,
                        'type': reference.type,
                    }
                    if (reference.uri) {
                        attrs.uri = reference.uri;
                    }
                    stanza.c('reference', attrs).root();
                });

                if (message.get('oob_url')) {
                    stanza.c('x', {'xmlns': Strophe.NS.OUTOFBAND}).c('url').t(message.get('oob_url')).root();
                }
                if (message.get('edited')) {
                    stanza.c('replace', {
                        'xmlns': Strophe.NS.MESSAGE_CORRECT,
                        'id': message.get('msgid')
                    }).root();
                }
                if (message.get('origin_id')) {
                    stanza.c('origin-id', {'xmlns': Strophe.NS.SID, 'id': message.get('origin_id')}).root();
                }
                return stanza;
            },

            getOutgoingMessageAttributes (text, spoiler_hint) {
                const is_spoiler = this.get('composing_spoiler');
                const origin_id = _converse.connection.getUniqueId();
                return {
                    'id': origin_id,
                    'jid': this.get('jid'),
                    'nickname': this.get('nickname'),
                    'msgid': origin_id,
                    'origin_id': origin_id,
                    'fullname': _converse.xmppstatus.get('fullname'),
                    'from': _converse.bare_jid,
                    'is_single_emoji': text ? u.isOnlyEmojis(text) : false,
                    'sender': 'me',
                    'time': (new Date()).toISOString(),
                    'message': text ? u.httpToGeoUri(u.shortnameToUnicode(text), _converse) : undefined,
                    'is_spoiler': is_spoiler,
                    'spoiler_hint': is_spoiler ? spoiler_hint : undefined,
                    'type': this.get('message_type')
                }
            },

            /**
             * Responsible for setting the editable attribute of messages.
             * If _converse.allow_message_corrections is "last", then only the last
             * message sent from me will be editable. If set to "all" all messages
             * will be editable. Otherwise no messages will be editable.
             * @method _converse.ChatBox#setEditable
             * @memberOf _converse.ChatBox
             * @param { Object } attrs An object containing message attributes.
             * @param { String } send_time - time when the message was sent
             */
            setEditable (attrs, send_time, stanza) {
                if (stanza && u.isHeadlineMessage(_converse, stanza)) {
                    return;
                }
                if (u.isEmptyMessage(attrs) || attrs.sender !== 'me') {
                    return;
                }
                if (_converse.allow_message_corrections === 'all') {
                    attrs.editable = !(attrs.file || 'oob_url' in attrs);
                } else if ((_converse.allow_message_corrections === 'last') &&
                           (send_time > this.get('time_sent'))) {
                    this.set({'time_sent': send_time});
                    const msg = this.messages.findWhere({'editable': true});
                    if (msg) {
                        msg.save({'editable': false});
                    }
                    attrs.editable = !(attrs.file || 'oob_url' in attrs);
                }
            },

            /**
             * Responsible for sending off a text message inside an ongoing chat conversation.
             * @method _converse.ChatBox#sendMessage
             * @memberOf _converse.ChatBox
             * @param { String } text - The chat message text
             * @param { String } spoiler_hint - An optional hint, if the message being sent is a spoiler
             * @returns { _converse.Message }
             * @example
             * const chat = _converse.api.chats.get('buddy1@example.com');
             * chat.sendMessage('hello world');
             */
            sendMessage (text, spoiler_hint) {
                const attrs = this.getOutgoingMessageAttributes(text, spoiler_hint);
                let message = this.messages.findWhere('correcting')
                if (message) {
                    const older_versions = message.get('older_versions') || {};
                    older_versions[message.get('time')] = message.get('message');
                    message.save({
                        'correcting': false,
                        'edited': (new Date()).toISOString(),
                        'message': attrs.message,
                        'older_versions': older_versions,
                        'references': attrs.references,
                        'is_single_emoji':  attrs.message ? u.isOnlyEmojis(attrs.message) : false,
                        'origin_id': _converse.connection.getUniqueId(),
                        'received': undefined
                    });
                } else {
                    this.setEditable(attrs, (new Date()).toISOString());
                    message = this.messages.create(attrs);
                }
                _converse.api.send(this.createMessageStanza(message));
                return message;
            },

            /**
             * Sends a message with the current XEP-0085 chat state of the user
             * as taken from the `chat_state` attribute of the {@link _converse.ChatBox}.
             * @private
             * @method _converse.ChatBox#sendChatState
             */
            sendChatState () {
                if (_converse.send_chat_state_notifications && this.get('chat_state')) {
                    const allowed = _converse.send_chat_state_notifications;
                    if (Array.isArray(allowed) && !allowed.includes(this.get('chat_state'))) {
                        return;
                    }
                    _converse.api.send(
                        $msg({
                            'id': _converse.connection.getUniqueId(),
                            'to': this.get('jid'),
                            'type': 'chat'
                        }).c(this.get('chat_state'), {'xmlns': Strophe.NS.CHATSTATES}).up()
                          .c('no-store', {'xmlns': Strophe.NS.HINTS}).up()
                          .c('no-permanent-store', {'xmlns': Strophe.NS.HINTS})
                    );
                }
            },


            async sendFiles (files) {
                const result = await _converse.api.disco.features.get(Strophe.NS.HTTPUPLOAD, _converse.domain);
                const item = result.pop();
                if (!item) {
                    this.messages.create({
                        'message': __("Sorry, looks like file upload is not supported by your server."),
                        'type': 'error',
                        'ephemeral': true
                    });
                    return;
                }
                const data = item.dataforms.where({'FORM_TYPE': {'value': Strophe.NS.HTTPUPLOAD, 'type': "hidden"}}).pop(),
                      max_file_size = window.parseInt(get(data, 'attributes.max-file-size.value')),
                      slot_request_url = get(item, 'id');

                if (!slot_request_url) {
                    this.messages.create({
                        'message': __("Sorry, looks like file upload is not supported by your server."),
                        'type': 'error',
                        'ephemeral': true
                    });
                    return;
                }
                Array.from(files).forEach(file => {
                    if (!window.isNaN(max_file_size) && window.parseInt(file.size) > max_file_size) {
                        return this.messages.create({
                            'message': __('The size of your file, %1$s, exceeds the maximum allowed by your server, which is %2$s.',
                                file.name, filesize(max_file_size)),
                            'type': 'error',
                            'ephemeral': true
                        });
                    } else {
                        const attrs = Object.assign(
                            this.getOutgoingMessageAttributes(), {
                            'file': true,
                            'progress': 0,
                            'slot_request_url': slot_request_url
                        });
                        this.setEditable(attrs, (new Date()).toISOString());
                        const message = this.messages.create(attrs, {'silent': true});
                        message.file = file;
                        this.messages.trigger('add', message);
                        message.getRequestSlotURL();
                    }
                });
            },

            getReferencesFromStanza (stanza) {
                const text = propertyOf(stanza.querySelector('body'))('textContent');
                return sizzle(`reference[xmlns="${Strophe.NS.REFERENCE}"]`, stanza).map(ref => {
                    const begin = ref.getAttribute('begin'),
                          end = ref.getAttribute('end');
                    return  {
                        'begin': begin,
                        'end': end,
                        'type': ref.getAttribute('type'),
                        'value': text.slice(begin, end),
                        'uri': ref.getAttribute('uri')
                    };
                });
            },

            /**
             * Extract the XEP-0359 stanza IDs from the passed in stanza
             * and return a map containing them.
             * @private
             * @method _converse.ChatBox#getStanzaIDs
             * @param { XMLElement } stanza - The message stanza
             */
            getStanzaIDs (stanza) {
                const attrs = {};
                const stanza_ids = sizzle(`stanza-id[xmlns="${Strophe.NS.SID}"]`, stanza);
                if (stanza_ids.length) {
                    stanza_ids.forEach(s => (attrs[`stanza_id ${s.getAttribute('by')}`] = s.getAttribute('id')));
                }
                const result = sizzle(`message > result[xmlns="${Strophe.NS.MAM}"]`, stanza).pop();
                if (result) {
                    const by_jid = stanza.getAttribute('from');
                    attrs[`stanza_id ${by_jid}`] = result.getAttribute('id');
                }

                const origin_id = sizzle(`origin-id[xmlns="${Strophe.NS.SID}"]`, stanza).pop();
                if (origin_id) {
                    attrs['origin_id'] = origin_id.getAttribute('id');
                }
                return attrs;
            },

            isArchived (original_stanza) {
                return !!sizzle(`result[xmlns="${Strophe.NS.MAM}"]`, original_stanza).pop();
            },

            getErrorMessage (stanza) {
                const error = stanza.querySelector('error');
                return propertyOf(error.querySelector('text'))('textContent') ||
                    __('Sorry, an error occurred:') + ' ' + error.innerHTML;
            },

            /**
             * Given a message stanza, return the text contained in its body.
             * @private
             * @param { XMLElement } stanza
             */
            getMessageBody (stanza) {
                const type = stanza.getAttribute('type');
                if (type === 'error') {
                    return this.getErrorMessage(stanza);
                } else {
                    const body = stanza.querySelector('body');
                    if (body) {
                        return body.textContent.trim();
                    }
                }
            },


            /**
             * Parses a passed in message stanza and returns an object
             * of attributes.
             * @private
             * @method _converse.ChatBox#getMessageAttributesFromStanza
             * @param { XMLElement } stanza - The message stanza
             * @param { XMLElement } delay - The <delay> node from the stanza, if there was one.
             * @param { XMLElement } original_stanza - The original stanza, that contains the
             *  message stanza, if it was contained, otherwise it's the message stanza itself.
             */
            async getMessageAttributesFromStanza (stanza, original_stanza) {
                const spoiler = sizzle(`spoiler[xmlns="${Strophe.NS.SPOILER}"]`, original_stanza).pop();
                const delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, original_stanza).pop();
                const text = this.getMessageBody(stanza) || undefined;
                const chat_state = stanza.getElementsByTagName(_converse.COMPOSING).length && _converse.COMPOSING ||
                            stanza.getElementsByTagName(_converse.PAUSED).length && _converse.PAUSED ||
                            stanza.getElementsByTagName(_converse.INACTIVE).length && _converse.INACTIVE ||
                            stanza.getElementsByTagName(_converse.ACTIVE).length && _converse.ACTIVE ||
                            stanza.getElementsByTagName(_converse.GONE).length && _converse.GONE;

                const replaced_id = this.getReplaceId(stanza)
                const msgid = replaced_id || stanza.getAttribute('id') || original_stanza.getAttribute('id');
                const attrs = Object.assign({
                    'chat_state': chat_state,
                    'is_archived': this.isArchived(original_stanza),
                    'is_delayed': !!delay,
                    'is_single_emoji': text ? await u.isOnlyEmojis(text) : false,
                    'is_spoiler': !!spoiler,
                    'message': text,
                    'msgid': msgid,
                    'replaced_id': replaced_id,
                    'references': this.getReferencesFromStanza(stanza),
                    'subject': propertyOf(stanza.querySelector('subject'))('textContent'),
                    'thread': propertyOf(stanza.querySelector('thread'))('textContent'),
                    'time': delay ? dayjs(delay.getAttribute('stamp')).toISOString() : (new Date()).toISOString(),
                    'type': stanza.getAttribute('type')
                }, this.getStanzaIDs(original_stanza));

                if (attrs.type === 'groupchat') {
                    attrs.from = stanza.getAttribute('from');
                    attrs.nick = Strophe.unescapeNode(Strophe.getResourceFromJid(attrs.from));
                    attrs.sender = attrs.nick === this.get('nick') ? 'me': 'them';
                    attrs.received = (new Date()).toISOString();
                } else {
                    attrs.from = Strophe.getBareJidFromJid(stanza.getAttribute('from'));
                    if (attrs.from === _converse.bare_jid) {
                        attrs.sender = 'me';
                        attrs.fullname = _converse.xmppstatus.get('fullname');
                    } else {
                        attrs.sender = 'them';
                        attrs.fullname = this.get('fullname');
                    }
                }
                sizzle(`x[xmlns="${Strophe.NS.OUTOFBAND}"]`, stanza).forEach(xform => {
                    attrs['oob_url'] = xform.querySelector('url').textContent;
                    attrs['oob_desc'] = xform.querySelector('url').textContent;
                });
                if (spoiler) {
                    attrs.spoiler_hint = spoiler.textContent.length > 0 ? spoiler.textContent : '';
                }
                if (replaced_id) {
                    attrs['edited'] = (new Date()).toISOString();
                }
                // We prefer to use one of the XEP-0359 unique and stable stanza IDs as the Model id, to avoid duplicates.
                attrs['id'] = attrs['origin_id'] ||
                    attrs[`stanza_id ${attrs.from}`] ||
                    _converse.connection.getUniqueId();
                return attrs;
            },

            maybeShow () {
                // Returns the chatbox
                return this.trigger("show");
            },

            /**
             * Indicates whether the chat is hidden and therefore
             * whether a newly received message will be visible
             * to the user or not.
             * @returns {boolean}
             */
            isHidden () {
                return this.get('hidden') ||
                    this.get('minimized') ||
                    this.isScrolledUp() ||
                    _converse.windowState === 'hidden';
            },

            /**
             * Given a newly received {@link _converse.Message} instance,
             * update the unread counter if necessary.
             * @private
             * @param {_converse.Message} message
             */
            incrementUnreadMsgCounter (message) {
                if (!message || !message.get('message')) {
                    return;
                }
                if (utils.isNewMessage(message) && this.isHidden()) {
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


        _converse.ChatBoxes = _converse.Collection.extend({
            comparator: 'time_opened',

            model (attrs, options) {
                return new _converse.ChatBox(attrs, options);
            },

            registerMessageHandler () {
                _converse.connection.addHandler(stanza => {
                    if (sizzle(`message > result[xmlns="${Strophe.NS.MAM}"]`, stanza).pop()) {
                        // MAM messages are handled in converse-mam.
                        // We shouldn't get MAM messages here because
                        // they shouldn't have a `type` attribute.
                        _converse.log(`Received a MAM message with type "chat".`, Strophe.LogLevel.WARN);
                        return true;
                    }
                    this.onMessage(stanza);
                    return true;
                }, null, 'message', 'chat');

                _converse.connection.addHandler(stanza => {
                    // Message receipts are usually without the `type` attribute. See #1353
                    if (stanza.getAttribute('type') !== null) {
                        // TODO: currently Strophe has no way to register a handler
                        // for stanzas without a `type` attribute.
                        // We could update it to accept null to mean no attribute,
                        // but that would be a backward-incompatible change
                        return true; // Gets handled above.
                    }
                    this.onMessage(stanza);
                    return true;
                }, Strophe.NS.RECEIPTS, 'message');

                _converse.connection.addHandler(stanza => {
                    this.onErrorMessage(stanza);
                    return true;
                }, null, 'message', 'error');
            },

            onChatBoxesFetched (collection) {
                /* Show chat boxes upon receiving them from storage */
                collection.filter(c => !c.isValid()).forEach(c => c.destroy());
                collection.forEach(c => c.maybeShow());
                /**
                 * Triggered when a message stanza is been received and processed.
                 * @event _converse#chatBoxesFetched
                 * @type { object }
                 * @property { _converse.ChatBox | _converse.ChatRoom } chatbox
                 * @property { XMLElement } stanza
                 * @example _converse.api.listen.on('message', obj => { ... });
                 * @example _converse.api.waitUntil('chatBoxesFetched').then(() => { ... });
                 */
                _converse.api.trigger('chatBoxesFetched');
            },

            onConnected (reconnecting) {
                this.registerMessageHandler();
                if (reconnecting) {
                    return;
                }
                const storage = _converse.config.get('storage');
                this.browserStorage = new BrowserStorage[storage](
                    `converse.chatboxes-${_converse.bare_jid}`);
                this.fetch({
                    'add': true,
                    'success': c => this.onChatBoxesFetched(c)
                });
            },

            /**
             * Handler method for all incoming error stanza stanzas.
             * @private
             * @method _converse.ChatBox#onErrorMessage
             * @param { XMLElement } stanza - The error message stanza
             */
            async onErrorMessage (stanza) {
                const from_jid =  Strophe.getBareJidFromJid(stanza.getAttribute('from'));
                if (utils.isSameBareJID(from_jid, _converse.bare_jid)) {
                    return;
                }
                const chatbox = this.getChatBox(from_jid);
                if (!chatbox) {
                    return;
                }
                const should_show = await chatbox.shouldShowErrorMessage(stanza);
                if (!should_show) {
                    return;
                }
                const attrs = await chatbox.getMessageAttributesFromStanza(stanza, stanza);
                chatbox.messages.create(attrs);
            },

            /**
             * Reject an incoming message by replying with an error message of type "cancel".
             * @private
             * @method _converse.ChatBox#rejectMessage
             * @param { XMLElement } stanza - The incoming message stanza
             * @param { XMLElement } text - Text explaining why the message was rejected
             */
            rejectMessage (stanza, text) {
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
            },

            /**
             * Handler method for all incoming single-user chat "message" stanzas.
             * @private
             * @method _converse.ChatBox#onMessage
             * @param { XMLElement } stanza - The incoming message stanza
             */
            async onMessage (stanza) {
                const original_stanza = stanza;
                let to_jid = stanza.getAttribute('to');
                const to_resource = Strophe.getResourceFromJid(to_jid);

                if (_converse.filter_by_resource && (to_resource && to_resource !== _converse.resource)) {
                    return _converse.log(
                        `onMessage: Ignoring incoming message intended for a different resource: ${to_jid}`,
                        Strophe.LogLevel.INFO
                    );
                } else if (utils.isHeadlineMessage(_converse, stanza)) {
                    // XXX: Prosody sends headline messages with the
                    // wrong type ('chat'), so we need to filter them out here.
                    return _converse.log(
                        `onMessage: Ignoring incoming headline message from JID: ${stanza.getAttribute('from')}`,
                        Strophe.LogLevel.INFO
                    );
                }

                const bare_forward = sizzle(`message > forwarded[xmlns="${Strophe.NS.FORWARD}"]`, stanza).length;
                if (bare_forward) {
                    return this.rejectMessage(
                        stanza,
                        'Forwarded messages not part of an encapsulating protocol are not supported'
                    );
                }
                let from_jid = stanza.getAttribute('from') || _converse.bare_jid;
                const is_carbon = u.isCarbonMessage(stanza);
                if (is_carbon) {
                    if (from_jid === _converse.bare_jid) {
                        const selector = `[xmlns="${Strophe.NS.CARBONS}"] > forwarded[xmlns="${Strophe.NS.FORWARD}"] > message`;
                        stanza = sizzle(selector, stanza).pop();
                        to_jid = stanza.getAttribute('to');
                        from_jid = stanza.getAttribute('from');
                    } else {
                        // Prevent message forging via carbons: https://xmpp.org/extensions/xep-0280.html#security
                        return this.rejectMessage(stanza, 'Rejecting carbon from invalid JID');
                    }
                }

                const is_mam = u.isMAMMessage(stanza);
                if (is_mam) {
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
                const is_roster_contact = contact !== undefined;
                if (!is_me && !is_roster_contact && !_converse.allow_non_roster_messaging) {
                    return;
                }

                // Get chat box, but only create when the message has something to show to the user
                const has_body = sizzle(`body, encrypted[xmlns="${Strophe.NS.OMEMO}"]`, stanza).length > 0;
                const roster_nick = get(contact, 'attributes.nickname');
                const chatbox = this.getChatBox(contact_jid, {'nickname': roster_nick}, has_body);

                if (chatbox) {
                    const message = await chatbox.getDuplicateMessage(stanza);
                    if (message) {
                        chatbox.updateMessage(message, original_stanza);
                    }
                    if (!message &&
                            !chatbox.handleReceipt (stanza, from_jid, is_carbon, is_me) &&
                            !chatbox.handleChatMarker(stanza, from_jid, is_carbon, is_roster_contact, is_mam)) {

                        const attrs = await chatbox.getMessageAttributesFromStanza(stanza, original_stanza);
                        chatbox.setEditable(attrs, attrs.time, stanza);
                        if (attrs['chat_state'] || !u.isEmptyMessage(attrs)) {
                            const msg = chatbox.correctMessage(attrs) || chatbox.messages.create(attrs);
                            chatbox.incrementUnreadMsgCounter(msg);
                        }
                    }
                }
                /**
                 * Triggered when a message stanza is been received and processed
                 * @event _converse#message
                 * @type { object }
                 * @property { _converse.ChatBox | _converse.ChatRoom } chatbox
                 * @property { XMLElement } stanza
                 * @example _converse.api.listen.on('message', obj => { ... });
                 */
                _converse.api.trigger('message', {'stanza': original_stanza, 'chatbox': chatbox});
            },

            /**
             * Returns a chat box or optionally return a newly
             * created one if one doesn't exist.
             * @private
             * @method _converse.ChatBox#getChatBox
             * @param { string } jid - The JID of the user whose chat box we want
             * @param { boolean } create - Should a new chat box be created if none exists?
             * @param { object } attrs - Optional chat box atributes. If the
             *  chat box already exists, its attributes will be updated.
             */
            getChatBox (jid, attrs={}, create) {
                if (isObject(jid)) {
                    create = attrs;
                    attrs = jid;
                    jid = attrs.jid;
                }
                jid = Strophe.getBareJidFromJid(jid.toLowerCase());

                let  chatbox = this.get(Strophe.getBareJidFromJid(jid));
                if (chatbox) {
                    chatbox.save(attrs);
                } else if (create) {
                    Object.assign(attrs, {'jid': jid, 'id': jid});
                    chatbox = this.create(attrs, {
                        'error' (model, response) {
                            _converse.log(response.responseText);
                        }
                    });
                    if (!chatbox.isValid()) {
                        chatbox.destroy();
                        return null;
                    }
                }
                return chatbox;
            }
        });


        function autoJoinChats () {
            /* Automatically join private chats, based on the
             * "auto_join_private_chats" configuration setting.
             */
            _converse.auto_join_private_chats.forEach(jid => {
                if (_converse.chatboxes.where({'jid': jid}).length) {
                    return;
                }
                if (isString(jid)) {
                    _converse.api.chats.open(jid);
                } else {
                    _converse.log(
                        'Invalid jid criteria specified for "auto_join_private_chats"',
                        Strophe.LogLevel.ERROR);
                }
            });
            /**
             * Triggered once any private chats have been automatically joined as
             * specified by the `auto_join_private_chats` setting.
             * See: https://conversejs.org/docs/html/configuration.html#auto-join-private-chats
             * @event _converse#privateChatsAutoJoined
             * @example _converse.api.listen.on('privateChatsAutoJoined', () => { ... });
             * @example _converse.api.waitUntil('privateChatsAutoJoined').then(() => { ... });
             */
            _converse.api.trigger('privateChatsAutoJoined');
        }


        /************************ BEGIN Event Handlers ************************/
        _converse.api.listen.on('chatBoxesFetched', autoJoinChats);


        _converse.api.listen.on('addClientFeatures', () => {
            _converse.api.disco.own.features.add(Strophe.NS.MESSAGE_CORRECT);
            _converse.api.disco.own.features.add(Strophe.NS.HTTPUPLOAD);
            _converse.api.disco.own.features.add(Strophe.NS.OUTOFBAND);
        });

        _converse.api.listen.on('pluginsInitialized', () => {
            _converse.chatboxes = new _converse.ChatBoxes();
            /**
             * Triggered once the _converse.ChatBoxes collection has been initialized.
             * @event _converse#chatBoxesInitialized
             * @example _converse.api.listen.on('chatBoxesInitialized', () => { ... });
             * @example _converse.api.waitUntil('chatBoxesInitialized').then(() => { ... });
             */
            _converse.api.trigger('chatBoxesInitialized');
        });

        _converse.api.listen.on('clearSession', () => {
            if (_converse.shouldClearCache()) {
                _converse.chatboxes.filter(c => c.messages && c.messages.clearSession({'silent': true}));
            }
        });


        _converse.api.listen.on('presencesInitialized', (reconnecting) => _converse.chatboxes.onConnected(reconnecting));
        _converse.api.listen.on('reconnected', () => _converse.chatboxes.forEach(m => m.onReconnection()));
        /************************ END Event Handlers ************************/


        /************************ BEGIN API ************************/
        Object.assign(_converse.api, {
            /**
             * The "chats" namespace (used for one-on-one chats)
             *
             * @namespace _converse.api.chats
             * @memberOf _converse.api
             */
            chats: {
                /**
                 * @method _converse.api.chats.create
                 * @param {string|string[]} jid|jids An jid or array of jids
                 * @param {object} [attrs] An object containing configuration attributes.
                 */
                async create (jids, attrs) {
                    if (isString(jids)) {
                        if (attrs && !get(attrs, 'fullname')) {
                            const contact = await _converse.api.contacts.get(jids);
                            attrs.fullname = get(contact, 'attributes.fullname');
                        }
                        const chatbox = _converse.chatboxes.getChatBox(jids, attrs, true);
                        if (!chatbox) {
                            _converse.log("Could not open chatbox for JID: "+jids, Strophe.LogLevel.ERROR);
                            return;
                        }
                        return chatbox;
                    }
                    if (Array.isArray(jids)) {
                        return Promise.all(jids.forEach(async jid => {
                            const contact = await _converse.api.contacts.get(jids);
                            attrs.fullname = get(contact, 'attributes.fullname');
                            return _converse.chatboxes.getChatBox(jid, attrs, true).maybeShow();
                        }));
                    }
                    _converse.log(
                        "chats.create: You need to provide at least one JID",
                        Strophe.LogLevel.ERROR
                    );
                    return null;
                },

                /**
                 * Opens a new one-on-one chat.
                 *
                 * @method _converse.api.chats.open
                 * @param {String|string[]} name - e.g. 'buddy@example.com' or ['buddy1@example.com', 'buddy2@example.com']
                 * @param {Object} [attrs] - Attributes to be set on the _converse.ChatBox model.
                 * @param {Boolean} [attrs.minimized] - Should the chat be
                 *   created in minimized state.
                 * @param {Boolean} [force=false] - By default, a minimized
                 *   chat won't be maximized (in `overlayed` view mode) and in
                 *   `fullscreen` view mode a newly opened chat won't replace
                 *   another chat already in the foreground.
                 *   Set `force` to `true` if you want to force the chat to be
                 *   maximized or shown.
                 * @returns {Promise} Promise which resolves with the
                 *   _converse.ChatBox representing the chat.
                 *
                 * @example
                 * // To open a single chat, provide the JID of the contact you're chatting with in that chat:
                 * converse.plugins.add('myplugin', {
                 *     initialize: function() {
                 *         var _converse = this._converse;
                 *         // Note, buddy@example.org must be in your contacts roster!
                 *         _converse.api.chats.open('buddy@example.com').then(chat => {
                 *             // Now you can do something with the chat model
                 *         });
                 *     }
                 * });
                 *
                 * @example
                 * // To open an array of chats, provide an array of JIDs:
                 * converse.plugins.add('myplugin', {
                 *     initialize: function () {
                 *         var _converse = this._converse;
                 *         // Note, these users must first be in your contacts roster!
                 *         _converse.api.chats.open(['buddy1@example.com', 'buddy2@example.com']).then(chats => {
                 *             // Now you can do something with the chat models
                 *         });
                 *     }
                 * });
                 */
                async open (jids, attrs, force) {
                    await Promise.all([
                        _converse.api.waitUntil('rosterContactsFetched'),
                        _converse.api.waitUntil('chatBoxesFetched')
                    ]);

                    if (isString(jids)) {
                        const chat = await _converse.api.chats.create(jids, attrs);
                        if (chat) {
                            return chat.maybeShow(force);
                        }
                        return chat;
                    } else if (Array.isArray(jids)) {
                        return Promise.all(
                            jids.map(j => _converse.api.chats.create(j, attrs).then(c => c ? c.maybeShow(force) : null))
                                .filter(c => c)
                        );
                    }
                    const err_msg = "chats.open: You need to provide at least one JID";
                    _converse.log(err_msg, Strophe.LogLevel.ERROR);
                    throw new Error(err_msg);
                },

                /**
                 * Returns a chat model. The chat should already be open.
                 *
                 * @method _converse.api.chats.get
                 * @param {String|string[]} jids - e.g. 'buddy@example.com' or ['buddy1@example.com', 'buddy2@example.com']
                 * @returns {_converse.ChatBox}
                 *
                 * @example
                 * // To return a single chat, provide the JID of the contact you're chatting with in that chat:
                 * const model = _converse.api.chats.get('buddy@example.com');
                 *
                 * @example
                 * // To return an array of chats, provide an array of JIDs:
                 * const models = _converse.api.chats.get(['buddy1@example.com', 'buddy2@example.com']);
                 *
                 * @example
                 * // To return all open chats, call the method without any parameters::
                 * const models = _converse.api.chats.get();
                 *
                 */
                get (jids) {
                    if (jids === undefined) {
                        const result = [];
                        _converse.chatboxes.each(function (chatbox) {
                            // FIXME: Leaky abstraction from MUC. We need to add a
                            // base type for chat boxes, and check for that.
                            if (chatbox.get('type') !== _converse.CHATROOMS_TYPE) {
                                result.push(chatbox);
                            }
                        });
                        return result;
                    } else if (isString(jids)) {
                        return _converse.chatboxes.getChatBox(jids);
                    }
                    return jids.map(jid => _converse.chatboxes.getChatBox(jid, {}, true));
                }
            }
        });
        /************************ END API ************************/
    }
});
