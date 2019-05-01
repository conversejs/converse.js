// Converse.js
// https://conversejs.org
//
// Copyright (c) 2012-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

import "./utils/emoji";
import "./utils/form";
import converse from "./converse-core";
import filesize from "filesize";

const { $msg, Backbone, Promise, Strophe, moment, sizzle, utils, _ } = converse.env;
const u = converse.env.utils;

Strophe.addNamespace('MESSAGE_CORRECT', 'urn:xmpp:message-correct:0');
Strophe.addNamespace('RECEIPTS', 'urn:xmpp:receipts');
Strophe.addNamespace('REFERENCE', 'urn:xmpp:reference:0');
Strophe.addNamespace('MARKERS', 'urn:xmpp:chat-markers:0');


converse.plugins.add('converse-chatboxes', {

    dependencies: ["converse-roster", "converse-vcard"],

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
            'filter_by_resource': false,
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

            async setRosterContact (jid) {
                const contact = await _converse.api.contacts.get(jid);
                if (contact) {
                    this.contact = contact;
                    this.set('nickname', contact.get('nickname'));
                    this.trigger('rosterContactAdded');
                }
            }
        });


        _converse.Message = ModelWithContact.extend({

            defaults () {
                return {
                    'msgid': _converse.connection.getUniqueId(),
                    'time': moment().format()
                };
            },

            initialize () {
                this.setVCard();
                if (this.get('type') === 'chat') {
                    this.setRosterContact(Strophe.getBareJidFromJid(this.get('from')));
                }
                if (this.get('file')) {
                    this.on('change:put', this.uploadFile, this);
                }
                if (this.isOnlyChatStateNotification()) {
                    window.setTimeout(this.destroy.bind(this), 20000);
                }
            },

            getVCardForChatroomOccupant () {
                const chatbox = this.collection.chatbox,
                      nick = Strophe.getResourceFromJid(this.get('from'));

                if (chatbox.get('nick') === nick) {
                    return _converse.xmppstatus.vcard;
                } else {
                    let vcard;
                    if (this.get('vcard_jid')) {
                        vcard = _converse.vcards.findWhere({'jid': this.get('vcard_jid')});
                    }
                    if (!vcard) {
                        let jid;
                        const occupant = chatbox.occupants.findWhere({'nick': nick});
                        if (occupant && occupant.get('jid')) {
                            jid = occupant.get('jid');
                            this.save({'vcard_jid': jid}, {'silent': true});
                        } else {
                            jid = this.get('from');
                        }
                        vcard = _converse.vcards.findWhere({'jid': jid}) || _converse.vcards.create({'jid': jid});
                    }
                    return vcard;
                }
            },

            setVCard () {
                if (!_converse.vcards) {
                    // VCards aren't supported
                    return;
                }
                if (this.get('type') === 'error') {
                    return;
                } else if (this.get('type') === 'groupchat') {
                    this.vcard = this.getVCardForChatroomOccupant();
                } else {
                    const jid = Strophe.getBareJidFromJid(this.get('from'));
                    this.vcard = _converse.vcards.findWhere({'jid': jid}) || _converse.vcards.create({'jid': jid});
                }
            },

            isOnlyChatStateNotification () {
                return u.isOnlyChatStateNotification(this);
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

            sendSlotRequestStanza () {
                /* Send out an IQ stanza to request a file upload slot.
                 *
                 * https://xmpp.org/extensions/xep-0363.html#request
                 */
                if (_.isNil(this.file)) {
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
                        'message': __("Sorry, could not determine upload URL.")
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
                        'message': __("Sorry, could not determine file upload URL.")
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
                        'message': message
                    });
                };
                xhr.open('PUT', this.get('put'), true);
                xhr.setRequestHeader("Content-type", this.file.type);
                xhr.send(this.file);
            }
        });


        _converse.Messages = Backbone.Collection.extend({
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
            defaults () {
                return {
                    'bookmarked': false,
                    'chat_state': undefined,
                    'hidden': _.includes(['mobile', 'fullscreen'], _converse.view_mode),
                    'message_type': 'chat',
                    'nickname': undefined,
                    'num_unread': 0,
                    'time_opened': this.get('time_opened') || moment().valueOf(),
                    'type': _converse.PRIVATE_CHAT_TYPE,
                    'url': ''
                }
            },

            initialize () {
                const jid = this.get('jid');
                if (!jid) {
                    // XXX: The `validate` method will prevent this model
                    // from being persisted if there's no jid, but that gets
                    // called after model instantiation, so we have to deal
                    // with invalid models here also.
                    //
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
            },

            initMessages () {
                this.messages = new _converse.Messages();
                const storage = _converse.config.get('storage');
                this.messages.browserStorage = new Backbone.BrowserStorage[storage](
                    `converse.messages-${this.get('jid')}-${_converse.bare_jid}`);
                this.messages.chatbox = this;

                this.messages.on('change:upload', (message) => {
                    if (message.get('upload') === _converse.SUCCESS) {
                        _converse.api.send(this.createMessageStanza(message));
                    }
                });
            },

            validate (attrs, options) {
                const { _converse } = this.__super__;
                if (!attrs.jid) {
                    return 'Ignored ChatBox without JID';
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

            getUpdatedMessageAttributes (message, stanza) {
                // Overridden in converse-muc and converse-mam
                return {};
            },

            updateMessage (message, stanza) {
                // Overridden in converse-muc and converse-mam
                const attrs = this.getUpdatedMessageAttributes(message, stanza);
                if (attrs) {
                    message.save(attrs, {'patch': true});
                }
            },

            handleMessageCorrection (stanza) {
                const replace = sizzle(`replace[xmlns="${Strophe.NS.MESSAGE_CORRECT}"]`, stanza).pop();
                if (replace) {
                    const msgid = replace && replace.getAttribute('id') || stanza.getAttribute('id'),
                        message = msgid && this.messages.findWhere({msgid});

                    if (!message) {
                        // XXX: Looks like we received a correction for a
                        // non-existing message, probably due to MAM.
                        // Not clear what can be done about this... we'll
                        // just create it as a separate message for now.
                        return false;
                    }
                    const older_versions = message.get('older_versions') || [];
                    older_versions.push(message.get('message'));
                    message.save({
                        'message': this.getMessageBody(stanza),
                        'references': this.getReferencesFromStanza(stanza),
                        'older_versions': older_versions,
                        'edited': moment().format()
                    });
                    return true;
                }
                return false;
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
                const result = await _converse.api.disco.supports(Strophe.NS.SID, by_jid);
                if (!result.length) {
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
                            message.save({field_name: moment().format()});
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

            handleReceipt (stanza, from_jid, is_carbon, is_me, is_mam) {
                const requests_receipt = !_.isUndefined(sizzle(`request[xmlns="${Strophe.NS.RECEIPTS}"]`, stanza).pop());
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
                            message.save({'received': moment().format()});
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
                const is_spoiler = this.get('composing_spoiler'),
                      origin_id = _converse.connection.getUniqueId();

                return {
                    'jid': this.get('jid'),
                    'nickname': this.get('nickname'),
                    'msgid': origin_id,
                    'origin_id': origin_id,
                    'fullname': _converse.xmppstatus.get('fullname'),
                    'from': _converse.bare_jid,
                    'is_single_emoji': text ? u.isSingleEmoji(text) : false,
                    'sender': 'me',
                    'time': moment().format(),
                    'message': text ? u.httpToGeoUri(u.shortnameToUnicode(text), _converse) : undefined,
                    'is_spoiler': is_spoiler,
                    'spoiler_hint': is_spoiler ? spoiler_hint : undefined,
                    'type': this.get('message_type')
                }
            },

            /**
             * Responsible for sending off a text message inside an ongoing
             * chat conversation.
             *
             * @method _converse.ChatBox#sendMessage
             * @memberOf _converse.ChatBox
             *
             * @param {String} text - The chat message text
             * @param {String} spoiler_hint - An optional hint, if the message being sent is a spoiler
             *
             * @example
             * const chat = _converse.api.chats.get('buddy1@example.com');
             * chat.sendMessage('hello world');
             */
            sendMessage (text, spoiler_hint) {
                const attrs = this.getOutgoingMessageAttributes(text, spoiler_hint);
                let message = this.messages.findWhere('correcting')
                if (message) {
                    const older_versions = message.get('older_versions') || [];
                    older_versions.push(message.get('message'));
                    message.save({
                        'correcting': false,
                        'edited': moment().format(),
                        'message': attrs.message,
                        'older_versions': older_versions,
                        'references': attrs.references
                    });
                } else {
                    message = this.messages.create(attrs);
                }
                _converse.api.send(this.createMessageStanza(message));
                return true;
            },

            sendChatState () {
                /* Sends a message with the status of the user in this chat session
                 * as taken from the 'chat_state' attribute of the chat box.
                 * See XEP-0085 Chat State Notifications.
                 */
                if (_converse.send_chat_state_notifications && this.get('chat_state')) {
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
                const result = await _converse.api.disco.supports(Strophe.NS.HTTPUPLOAD, _converse.domain),
                      item = result.pop();

                if (!item) {
                    this.messages.create({
                        'message': __("Sorry, looks like file upload is not supported by your server."),
                        'type': 'error'
                    });
                    return;
                }

                const data = item.dataforms.where({'FORM_TYPE': {'value': Strophe.NS.HTTPUPLOAD, 'type': "hidden"}}).pop(),
                      max_file_size = window.parseInt(_.get(data, 'attributes.max-file-size.value')),
                      slot_request_url = _.get(item, 'id');

                if (!slot_request_url) {
                    this.messages.create({
                        'message': __("Sorry, looks like file upload is not supported by your server."),
                        'type': 'error'
                    });
                    return;
                }
                _.each(files, (file) => {
                    if (!window.isNaN(max_file_size) && window.parseInt(file.size) > max_file_size) {
                        return this.messages.create({
                            'message': __('The size of your file, %1$s, exceeds the maximum allowed by your server, which is %2$s.',
                                file.name, filesize(max_file_size)),
                            'type': 'error'
                        });
                    } else {
                        const message = this.messages.create(
                            Object.assign(
                                this.getOutgoingMessageAttributes(), {
                                'file': true,
                                'progress': 0,
                                'slot_request_url': slot_request_url
                            }), {'silent': true}
                        );
                        message.file = file;
                        this.messages.trigger('add', message);
                        message.getRequestSlotURL();
                    }
                });
            },

            getReferencesFromStanza (stanza) {
                const text = _.propertyOf(stanza.querySelector('body'))('textContent');
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
                return !_.isNil(sizzle(`result[xmlns="${Strophe.NS.MAM}"]`, original_stanza).pop());
            },

            getErrorMessage (stanza) {
                const error = stanza.querySelector('error');
                return _.propertyOf(error.querySelector('text'))('textContent') ||
                    __('Sorry, an error occurred:') + ' ' + error.innerHTML;
            },

            getMessageBody (stanza) {
                /* Given a message stanza, return the text contained in its body.
                 */
                const type = stanza.getAttribute('type');
                if (type === 'error') {
                    return this.getErrorMessage(stanza);
                } else {
                    return _.propertyOf(stanza.querySelector('body'))('textContent');
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
            getMessageAttributesFromStanza (stanza, original_stanza) {
                const spoiler = sizzle(`spoiler[xmlns="${Strophe.NS.SPOILER}"]`, original_stanza).pop(),
                      delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, original_stanza).pop(),
                      text = this.getMessageBody(stanza) || undefined,
                      chat_state = stanza.getElementsByTagName(_converse.COMPOSING).length && _converse.COMPOSING ||
                            stanza.getElementsByTagName(_converse.PAUSED).length && _converse.PAUSED ||
                            stanza.getElementsByTagName(_converse.INACTIVE).length && _converse.INACTIVE ||
                            stanza.getElementsByTagName(_converse.ACTIVE).length && _converse.ACTIVE ||
                            stanza.getElementsByTagName(_converse.GONE).length && _converse.GONE;

                const attrs = Object.assign({
                    'chat_state': chat_state,
                    'is_archived': this.isArchived(original_stanza),
                    'is_delayed': !_.isNil(delay),
                    'is_spoiler': !_.isNil(spoiler),
                    'is_single_emoji': text ? u.isSingleEmoji(text) : false,
                    'message': text,
                    'msgid': stanza.getAttribute('id'),
                    'references': this.getReferencesFromStanza(stanza),
                    'subject': _.propertyOf(stanza.querySelector('subject'))('textContent'),
                    'thread': _.propertyOf(stanza.querySelector('thread'))('textContent'),
                    'time': delay ? moment(delay.getAttribute('stamp')).format() : moment().format(),
                    'type': stanza.getAttribute('type')
                }, this.getStanzaIDs(original_stanza));


                if (attrs.type === 'groupchat') {
                    attrs.from = stanza.getAttribute('from');
                    attrs.nick = Strophe.unescapeNode(Strophe.getResourceFromJid(attrs.from));
                    attrs.sender = attrs.nick === this.get('nick') ? 'me': 'them';
                } else {
                    attrs.from = Strophe.getBareJidFromJid(stanza.getAttribute('from'));
                    if (attrs.from === _converse.bare_jid) {
                        attrs.sender = 'me';
                        attrs.fullname = _converse.xmppstatus.get('fullname');
                    } else {
                        attrs.sender = 'them';
                        attrs.fullname = this.get('fullname') || this.get('fullname')
                    }
                }
                _.each(sizzle(`x[xmlns="${Strophe.NS.OUTOFBAND}"]`, stanza), (xform) => {
                    attrs['oob_url'] = xform.querySelector('url').textContent;
                    attrs['oob_desc'] = xform.querySelector('url').textContent;
                });
                if (spoiler) {
                    attrs.spoiler_hint = spoiler.textContent.length > 0 ? spoiler.textContent : '';
                }
                // We prefer to use one of the XEP-0359 unique and stable stanza IDs as the Model id, to avoid duplicates.
                attrs['id'] = attrs['origin_id'] || attrs[`stanza_id ${attrs.from}`] || _converse.connection.getUniqueId();
                return attrs;
            },

            maybeShow () {
                // Returns the chatbox
                return this.trigger("show");
            },

            isHidden () {
                /* Returns a boolean to indicate whether a newly received
                 * message will be visible to the user or not.
                 */
                return this.get('hidden') ||
                    this.get('minimized') ||
                    this.isScrolledUp() ||
                    _converse.windowState === 'hidden';
            },

            incrementUnreadMsgCounter (message) {
                /* Given a newly received message, update the unread counter if
                 * necessary.
                 */
                if (!message) { return; }
                if (_.isNil(message.get('message'))) { return; }
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


        _converse.ChatBoxes = Backbone.Collection.extend({
            comparator: 'time_opened',

            model (attrs, options) {
                return new _converse.ChatBox(attrs, options);
            },

            registerMessageHandler () {
                _converse.connection.addHandler(stanza => {
                    this.onMessage(stanza);
                    return true;
                }, null, 'message', 'chat');

                _converse.connection.addHandler(stanza => {
                    // Message receipts are usually without the `type` attribute. See #1353
                    if (!_.isNull(stanza.getAttribute('type'))) {
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
                /* Show chat boxes upon receiving them from sessionStorage */
                collection.each(chatbox => chatbox.maybeShow());
                /**
                 * Triggered when a message stanza is been received and processed.
                 * @event _converse#message
                 * @type { object }
                 * @property { _converse.ChatBox | _converse.ChatRoom } chatbox
                 * @property { XMLElement } stanza
                 * @example _converse.api.listen.on('message', obj => { ... });
                 * @example _converse.api.waitUntil('chatBoxesFetched').then(() => { ... });
                 */
                _converse.api.trigger('chatBoxesFetched');
            },

            onConnected () {
                this.browserStorage = new Backbone.BrowserStorage.session(
                    `converse.chatboxes-${_converse.bare_jid}`);
                this.registerMessageHandler();
                this.fetch({
                    'add': true,
                    'success': this.onChatBoxesFetched.bind(this)
                });
            },

            async onErrorMessage (message) {
                /* Handler method for all incoming error message stanzas
                */
                const from_jid =  Strophe.getBareJidFromJid(message.getAttribute('from'));
                if (utils.isSameBareJID(from_jid, _converse.bare_jid)) {
                    return true;
                }
                const chatbox = this.getChatBox(from_jid);
                if (!chatbox) {
                    return true;
                }
                const id = message.getAttribute('id');
                if (id) {
                    const msgs = chatbox.messages.where({'msgid': id});
                    if (!msgs.length || msgs.filter(m => m.get('type') === 'error').length) {
                        // If the error refers to a message not included in our store.
                        // We assume that this was a CSI message (which we don't store).
                        // See https://github.com/conversejs/converse.js/issues/1317
                        //
                        // We also ignore duplicate error messages.
                        return;
                    }
                } else {
                    // An error message without id likely means that we
                    // sent a message without id (which shouldn't happen).
                    _converse.log('Received an error message without id attribute!', Strophe.LogLevel.ERROR);
                    _converse.log(message, Strophe.LogLevel.ERROR);
                }
                const attrs = await chatbox.getMessageAttributesFromStanza(message, message);
                chatbox.messages.create(attrs);
            },

            /**
             * Handler method for all incoming single-user chat "message" stanzas.
             * @private
             * @method _converse.ChatBox#onMessage
             * @param { XMLElement } stanza - The incoming message stanza
             */
            async onMessage (stanza) {
                let to_jid = stanza.getAttribute('to');
                const to_resource = Strophe.getResourceFromJid(to_jid);

                if (_converse.filter_by_resource && (to_resource && to_resource !== _converse.resource)) {
                    _converse.log(
                        `onMessage: Ignoring incoming message intended for a different resource: ${to_jid}`,
                        Strophe.LogLevel.INFO
                    );
                    return true;
                } else if (utils.isHeadlineMessage(_converse, stanza)) {
                    // XXX: Ideally we wouldn't have to check for headline
                    // messages, but Prosody sends headline messages with the
                    // wrong type ('chat'), so we need to filter them out here.
                    _converse.log(
                        `onMessage: Ignoring incoming headline message from JID: ${stanza.getAttribute('from')}`,
                        Strophe.LogLevel.INFO
                    );
                    return true;
                }

                let from_jid = stanza.getAttribute('from'),
                    is_carbon = false,
                    is_mam = false;

                const forwarded = stanza.querySelector('forwarded'),
                      original_stanza = stanza;

                if (!_.isNull(forwarded)) {
                    const forwarded_message = forwarded.querySelector('message'),
                          forwarded_from = forwarded_message.getAttribute('from'),
                          xmlns = Strophe.NS.CARBONS;
                    is_carbon = sizzle(`received[xmlns="${xmlns}"]`, stanza).length > 0;
                    if (is_carbon && Strophe.getBareJidFromJid(forwarded_from) !== from_jid) {
                        // Prevent message forging via carbons
                        // https://xmpp.org/extensions/xep-0280.html#security
                        return true;
                    }
                    is_mam = sizzle(`message > result[xmlns="${Strophe.NS.MAM}"]`, stanza).length > 0;
                    stanza = forwarded_message;
                    from_jid = stanza.getAttribute('from');
                    to_jid = stanza.getAttribute('to');
                }

                const from_bare_jid = Strophe.getBareJidFromJid(from_jid),
                      from_resource = Strophe.getResourceFromJid(from_jid),
                      is_me = from_bare_jid === _converse.bare_jid;

                let contact_jid; 
                if (is_me) {
                    // I am the sender, so this must be a forwarded message...
                    if (_.isNull(to_jid)) {
                        return _converse.log(
                            `Don't know how to handle message stanza without 'to' attribute. ${stanza.outerHTML}`,
                            Strophe.LogLevel.ERROR
                        );
                    }
                    contact_jid = Strophe.getBareJidFromJid(to_jid);
                } else {
                    contact_jid = from_bare_jid;
                }

                const contact = await _converse.api.contacts.get(contact_jid);
                const is_roster_contact = !_.isUndefined(contact);
                if (!is_me && !is_roster_contact && !_converse.allow_non_roster_messaging) {
                    return;
                }

                // Get chat box, but only create when the message has something to show to the user
                const has_body = sizzle(`body, encrypted[xmlns="${Strophe.NS.OMEMO}"]`, stanza).length > 0,
                      roster_nick = _.get(contact, 'attributes.nickname'),
                      chatbox = this.getChatBox(contact_jid, {'nickname': roster_nick}, has_body);

                if (chatbox) {
                    const message = await chatbox.getDuplicateMessage(stanza);
                    if (message) {
                        chatbox.updateMessage(message, original_stanza);
                    }
                    if (!message &&
                            !chatbox.handleMessageCorrection(stanza) &&
                            !chatbox.handleReceipt (stanza, from_jid, is_carbon, is_me, is_mam) &&
                            !chatbox.handleChatMarker(stanza, from_jid, is_carbon, is_roster_contact, is_mam)) {

                        const attrs = await chatbox.getMessageAttributesFromStanza(stanza, original_stanza);
                        if (attrs['chat_state'] || !u.isEmptyMessage(attrs)) {
                            const msg = chatbox.messages.create(attrs);
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
             * @param { object } attrs - Optional chat box atributes.
             */
            getChatBox (jid, attrs={}, create) {
                if (_.isObject(jid)) {
                    create = attrs;
                    attrs = jid;
                    jid = attrs.jid;
                }
                jid = Strophe.getBareJidFromJid(jid.toLowerCase());

                let  chatbox = this.get(Strophe.getBareJidFromJid(jid));
                if (!chatbox && create) {
                    Object.assign(attrs, {'jid': jid, 'id': jid});
                    chatbox = this.create(attrs, {
                        'error' (model, response) {
                            _converse.log(response.responseText);
                        }
                    });
                }
                return chatbox;
            }
        });


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
        _converse.api.listen.on('presencesInitialized', () => _converse.chatboxes.onConnected());
        /************************ END Event Handlers ************************/


        /************************ BEGIN API ************************/
        Object.assign(_converse.api, {
            /**
             * The "chats" namespace (used for one-on-one chats)
             *
             * @namespace _converse.api.chats
             * @memberOf _converse.api
             */
            'chats': {
                /**
                 * @method _converse.api.chats.create
                 * @param {string|string[]} jid|jids An jid or array of jids
                 * @param {object} [attrs] An object containing configuration attributes.
                 */
                async create (jids, attrs) {
                    if (_.isString(jids)) {
                        if (attrs && !_.get(attrs, 'fullname')) {
                            const contact = await _converse.api.contacts.get(jids);
                            attrs.fullname = _.get(contact, 'attributes.fullname');
                        }
                        const chatbox = _converse.chatboxes.getChatBox(jids, attrs, true);
                        if (_.isNil(chatbox)) {
                            _converse.log("Could not open chatbox for JID: "+jids, Strophe.LogLevel.ERROR);
                            return;
                        }
                        return chatbox;
                    }
                    if (_.isArray(jids)) {
                        return Promise.all(jids.forEach(async jid => {
                            const contact = await _converse.api.contacts.get(jids);
                            attrs.fullname = _.get(contact, 'attributes.fullname');
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

                    if (_.isString(jids)) {
                        const chat = await _converse.api.chats.create(jids, attrs);
                        return chat.maybeShow(force);
                    } else if (_.isArray(jids)) {
                        return Promise.all(jids.map(j => _converse.api.chats.create(j, attrs).then(c => c.maybeShow(force))));
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
                    if (_.isUndefined(jids)) {
                        const result = [];
                        _converse.chatboxes.each(function (chatbox) {
                            // FIXME: Leaky abstraction from MUC. We need to add a
                            // base type for chat boxes, and check for that.
                            if (chatbox.get('type') !== _converse.CHATROOMS_TYPE) {
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
