/**
 * @module converse-chat
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { find, get, isMatch, isObject, isString, pick } from "lodash";
import { Collection } from "skeletor.js/src/collection";
import { Model } from 'skeletor.js/src/model.js';
import converse from "./converse-core";
import dayjs from 'dayjs';
import filesize from "filesize";
import log from "./log";
import stanza_utils from "./utils/stanza";

const { $msg, Strophe, sizzle, utils } = converse.env;
const u = converse.env.utils;


converse.plugins.add('converse-chat', {
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
    dependencies: ["converse-chatboxes", "converse-disco"],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;
        const { __ } = _converse;

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


        const ModelWithContact = Model.extend({

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
                    'msgid': u.getUniqueId(),
                    'time': (new Date()).toISOString(),
                    'is_ephemeral': false
                };
            },

            async initialize () {
                this.initialized = u.getResolveablePromise();

                if (this.get('type') === 'chat') {
                    ModelWithContact.prototype.initialize.apply(this, arguments);
                    this.setRosterContact(Strophe.getBareJidFromJid(this.get('from')));
                }
                if (this.get('file')) {
                    this.on('change:put', this.uploadFile, this);
                }
                this.setTimerForEphemeralMessage();
                /**
                 * Triggered once a {@link _converse.Message} has been created and initialized.
                 * @event _converse#messageInitialized
                 * @type { _converse.Message}
                 * @example _converse.api.listen.on('messageInitialized', model => { ... });
                 */
                await _converse.api.trigger('messageInitialized', this, {'Synchronous': true});
                this.initialized.resolve();
            },

            /**
             * Sets an auto-destruct timer for this message, if it's is_ephemeral.
             * @private
             * @method _converse.Message#setTimerForEphemeralMessage
             * @returns { Boolean } - Indicates whether the message is
             *   ephemeral or not, and therefore whether the timer was set or not.
             */
            setTimerForEphemeralMessage () {
                const setTimer = () => {
                    this.ephemeral_timer = window.setTimeout(this.safeDestroy.bind(this), 10000);
                }
                if (this.isEphemeral()) {
                    setTimer();
                    return true;
                } else {
                    this.on('change:is_ephemeral',
                        () => this.isEphemeral() ? setTimer() : clearTimeout(this.ephemeral_timer)
                    );
                    return false;
                }
            },

            safeDestroy () {
                try {
                    this.destroy()
                } catch (e) {
                    log.error(e);
                }
            },

            isOnlyChatStateNotification () {
                return u.isOnlyChatStateNotification(this);
            },

            isEphemeral () {
                return this.get('is_ephemeral') || u.isOnlyChatStateNotification(this);
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
                           (_converse.loglevel === 'debug' ? __('Unencryptable OMEMO message') : null);
                }
                return this.get('message');
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
                    log.error(e);
                    return this.save({
                        'type': 'error',
                        'message': __("Sorry, could not determine upload URL."),
                        'is_ephemeral': true
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
                        'is_ephemeral': true
                    });
                }
            },

            uploadFile () {
                const xhr = new XMLHttpRequest();
                xhr.onreadystatechange = () => {
                    if (xhr.readyState === XMLHttpRequest.DONE) {
                        log.info("Status: " + xhr.status);
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
                        'is_ephemeral': true
                    });
                };
                xhr.open('PUT', this.get('put'), true);
                xhr.setRequestHeader("Content-type", this.file.type);
                xhr.send(this.file);
            }
        });


        _converse.Messages = Collection.extend({
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

            async initialize () {
                this.initialized = u.getResolveablePromise();
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
                this.initMessages();

                if (this.get('type') === _converse.PRIVATE_CHAT_TYPE) {
                    this.presence = _converse.presences.findWhere({'jid': jid}) || _converse.presences.create({'jid': jid});
                    await this.setRosterContact(jid);
                }
                this.on('change:chat_state', this.sendChatState, this);
                await this.fetchMessages();
                /**
                 * Triggered once a {@link _converse.ChatBox} has been created and initialized.
                 * @event _converse#chatBoxInitialized
                 * @type { _converse.ChatBox}
                 * @example _converse.api.listen.on('chatBoxInitialized', model => { ... });
                 */
                await _converse.api.trigger('chatBoxInitialized', this, {'Synchronous': true});
                this.initialized.resolve();
            },

            getMessagesCacheKey () {
                return `converse.messages-${this.get('jid')}-${_converse.bare_jid}`;
            },

            initMessages () {
                this.messages = new this.messagesCollection();
                this.messages.chatbox = this;
                this.messages.browserStorage = _converse.createStore(this.getMessagesCacheKey());
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
                    log.info(`Not re-fetching messages for ${this.get('jid')}`);
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

            async onMessage (stanza, original_stanza, from_jid) {
                const attrs = await this.getMessageAttributesFromStanza(stanza, original_stanza);
                const message = this.getDuplicateMessage(attrs);
                if (message) {
                    this.updateMessage(message, original_stanza);
                } else if (
                    !this.handleReceipt (stanza, from_jid) &&
                    !this.handleChatMarker(stanza, from_jid)
                ) {
                    if (this.handleRetraction(attrs)) {
                        return;
                    }
                    this.setEditable(attrs, attrs.time, stanza);
                    if (attrs['chat_state'] ||
                        attrs['retracted'] || // Retraction received *before* the message
                        !u.isEmptyMessage(attrs)
                    ) {
                        const msg = this.handleCorrection(attrs) || this.messages.create(attrs);
                        this.createDayIndicator(msg);
                        this.incrementUnreadMsgCounter(msg);
                    }
                }
            },

            /**
             * Inserts an indicator into the chat area, showing the
             * day as given by the passed in date.
             * The indicator is only inserted if necessary.
             * @private
             * @method _converse.ChatBoxView#createDayIndicator
             * @param { HTMLElement } next_msg_el - The message element before
             *      which the day indicator element must be inserted.
             *      This element must have a "data-isodate" attribute
             *      which specifies its creation date.
             */
            createDayIndicator (next_msg) {
                if (next_msg.get('type') === 'date') {
                    return;
                }
                const next_msg_date = next_msg.get('time');
                const day_date = dayjs(next_msg_date).startOf('day');
                const messages = this.messages.models;
                const idx = messages.indexOf(next_msg);
                const prev_msg = messages[idx-1];
                if (!prev_msg) {
                    return this.messages.create({
                        'type': 'date',
                        'time': day_date.toISOString(),
                    });
                }
                const prev_msg_date = prev_msg ? prev_msg.get('time') : null;
                if (prev_msg_date === null && next_msg_date === null) {
                    return;
                }
                if ((prev_msg_date === null) || dayjs(next_msg_date).isAfter(prev_msg_date, 'day')) {
                    this.messages.create({
                        'type': 'date',
                        'time': day_date.toISOString(),
                    });
                }
            },

            async clearMessages () {
                try {
                    await this.messages.clearStore();
                } catch (e) {
                    this.messages.trigger('reset');
                    log.error(e);
                } finally {
                    delete this.messages.fetched;
                }
            },

            async close () {
                try {
                    await new Promise((success, reject) => {
                        return this.destroy({success, 'error': (m, e) => reject(e)})
                    });
                } catch (e) {
                    log.error(e);
                } finally {
                    if (_converse.clear_messages_on_reconnection) {
                        await this.clearMessages();
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

            async onReconnection () {
                if (_converse.clear_messages_on_reconnection) {
                    await this.clearMessages();
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
                    log.warn(msg);
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
                return {
                    'is_archived': stanza_utils.isArchived(stanza),
                }
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

            isSameUser (jid1, jid2) {
                return u.isSameBareJID(jid1, jid2);
            },

            /**
             * Looks whether we already have a retraction for this
             * incoming message. If so, it's considered "dangling" because it
             * probably hasn't been applied to anything yet, given that the
             * relevant message is only coming in now.
             * @private
             * @method _converse.ChatBox#findDanglingRetraction
             * @param { object } attrs - Attributes representing a received
             *  message, as returned by {@link stanza_utils.getMessageAttributesFromStanza}
             * @returns { _converse.Message }
             */
            findDanglingRetraction (attrs) {
                if (!attrs.origin_id || !this.messages.length) {
                    return null;
                }
                // Only look for dangling retractions if there are newer
                // messages than this one, since retractions come after.
                if (this.messages.last().get('time') > attrs.time) {
                    // Search from latest backwards
                    const messages = Array.from(this.messages.models);
                    messages.reverse();
                    return messages.find(
                        ({attributes}) =>
                            attributes.retracted_id === attrs.origin_id &&
                            attributes.from === attrs.from &&
                            !attributes.moderated_by
                    );
                }
            },

            /**
             * Handles message retraction based on the passed in attributes.
             * @private
             * @method _converse.ChatBox#handleRetraction
             * @param { object } attrs - Attributes representing a received
             *  message, as returned by {@link stanza_utils.getMessageAttributesFromStanza}
             * @returns { Boolean } Returns `true` or `false` depending on
             *  whether a message was retracted or not.
             */
            handleRetraction (attrs) {
                const RETRACTION_ATTRIBUTES = ['retracted', 'retracted_id', 'editable'];
                if (attrs.retracted) {
                    if (attrs.is_tombstone) {
                        return false;
                    }
                    const message = this.messages.findWhere({'origin_id': attrs.retracted_id, 'from': attrs.from});
                    if (!message) {
                        attrs['dangling_retraction'] = true;
                        this.messages.create(attrs);
                        return true;
                    }
                    message.save(pick(attrs, RETRACTION_ATTRIBUTES));
                    return true;
                } else {
                    // Check if we have dangling retraction
                    const message = this.findDanglingRetraction(attrs);
                    if (message) {
                        const retraction_attrs = pick(message.attributes, RETRACTION_ATTRIBUTES);
                        const new_attrs = Object.assign({'dangling_retraction': false}, attrs, retraction_attrs);
                        delete new_attrs['id']; // Delete id, otherwise a new cache entry gets created
                        message.save(new_attrs);
                        return true;
                    }
                }
                return false;
            },

            /**
             * Determines whether the passed in message attributes represent a
             * message which corrects a previously received message, or an
             * older message which has already been corrected.
             * In both cases, update the corrected message accordingly.
             * @private
             * @method _converse.ChatBox#handleCorrection
             * @param { object } attrs - Attributes representing a received
             *  message, as returned by {@link stanza_utils.getMessageAttributesFromStanza}
             * @returns { _converse.Message|undefined } Returns the corrected
             *  message or `undefined` if not applicable.
             */
            handleCorrection (attrs) {
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

            /**
             * Returns an already cached message (if it exists) based on the
             * passed in attributes map.
             * @private
             * @method _converse.ChatBox#getDuplicateMessage
             * @param { object } attrs - Attributes representing a received
             *  message, as returned by {@link stanza_utils.getMessageAttributesFromStanza}
             * @returns {Promise<_converse.Message>}
             */
            getDuplicateMessage (attrs) {
                const queries = [
                        ...this.getStanzaIdQueryAttrs(attrs),
                        this.getOriginIdQueryAttrs(attrs),
                        this.getMessageBodyQueryAttrs(attrs)
                    ].filter(s => s);
                const msgs = this.messages.models;
                return find(msgs, m => queries.reduce((out, q) => (out || isMatch(m.attributes, q)), false));
            },

            getOriginIdQueryAttrs (attrs) {
                return attrs.origin_id && {'origin_id': attrs.origin_id, 'from': attrs.from};
            },

            getStanzaIdQueryAttrs (attrs) {
                const keys = Object.keys(attrs).filter(k => k.startsWith('stanza_id '));
                return keys.map(key => {
                    const by_jid = key.replace(/^stanza_id /, '');
                    const query = {};
                    query[`stanza_id ${by_jid}`] = attrs[key];
                    return query;
                });
            },

            getMessageBodyQueryAttrs (attrs) {
                if (attrs.message && attrs.msgid) {
                    return {
                        'message': attrs.message,
                        'from': attrs.from,
                        'msgid': attrs.msgid
                    }
                }
            },

            /**
             * Sends a message stanza to retract a message in this chat
             * @private
             * @method _converse.ChatBox#sendRetractionMessage
             * @param { _converse.Message } message - The message which we're retracting.
             */
            sendRetractionMessage (message) {
                const origin_id = message.get('origin_id');
                if (!origin_id) {
                    throw new Error("Can't retract message without a XEP-0359 Origin ID");
                }
                const msg = $msg({
                        'id': u.getUniqueId(),
                        'to': this.get('jid'),
                        'type': "chat"
                    })
                    .c('store', {xmlns: Strophe.NS.HINTS}).up()
                    .c("apply-to", {
                        'id': origin_id,
                        'xmlns': Strophe.NS.FASTEN
                    }).c('retract', {xmlns: Strophe.NS.RETRACT})
                return _converse.connection.send(msg);
            },

            sendMarker(to_jid, id, type) {
                const stanza = $msg({
                    'from': _converse.connection.jid,
                    'id': u.getUniqueId(),
                    'to': to_jid,
                    'type': 'chat',
                }).c(type, {'xmlns': Strophe.NS.MARKERS, 'id': id});
                _converse.api.send(stanza);
            },

            handleChatMarker (stanza, from_jid) {
                const to_bare_jid = Strophe.getBareJidFromJid(stanza.getAttribute('to'));
                if (to_bare_jid !== _converse.bare_jid) {
                    return false;
                }
                const markers = sizzle(`[xmlns="${Strophe.NS.MARKERS}"]`, stanza);
                if (markers.length === 0) {
                    return false;
                } else if (markers.length > 1) {
                    log.error('handleChatMarker: Ignoring incoming stanza with multiple message markers');
                    log.error(stanza);
                    return false;
                } else {
                    const marker = markers.pop();
                    if (marker.nodeName === 'markable') {
                        if (this.contact && !u.isMAMMessage(stanza) && !u.isCarbonMessage(stanza)) {
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
                    'id': u.getUniqueId(),
                    'to': to_jid,
                    'type': 'chat',
                }).c('received', {'xmlns': Strophe.NS.RECEIPTS, 'id': id}).up()
                .c('store', {'xmlns': Strophe.NS.HINTS}).up();
                _converse.api.send(receipt_stanza);
            },

            handleReceipt (stanza, from_jid) {
                const is_me = Strophe.getBareJidFromJid(from_jid) === _converse.bare_jid;
                const requests_receipt = sizzle(`request[xmlns="${Strophe.NS.RECEIPTS}"]`, stanza).pop() !== undefined;
                if (requests_receipt && !is_me && !u.isCarbonMessage(stanza)) {
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
                        'id': message.get('edited') && u.getUniqueId() || message.get('msgid'),
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
                const origin_id = u.getUniqueId();
                return {
                    'id': origin_id,
                    'jid': this.get('jid'),
                    'nickname': this.get('nickname'),
                    'msgid': origin_id,
                    'origin_id': origin_id,
                    'fullname': _converse.xmppstatus.get('fullname'),
                    'from': _converse.bare_jid,
                    'is_only_emojis': text ? u.isOnlyEmojis(text) : false,
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
                    attrs.editable = !(attrs.file || attrs.retracted || 'oob_url' in attrs);
                } else if ((_converse.allow_message_corrections === 'last') &&
                           (send_time > this.get('time_sent'))) {
                    this.set({'time_sent': send_time});
                    const msg = this.messages.findWhere({'editable': true});
                    if (msg) {
                        msg.save({'editable': false});
                    }
                    attrs.editable = !(attrs.file || attrs.retracted || 'oob_url' in attrs);
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
                        'is_only_emojis':  attrs.is_only_emojis,
                        'origin_id': u.getUniqueId(),
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
                            'id': u.getUniqueId(),
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
                        'is_ephemeral': true
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
                        'is_ephemeral': true
                    });
                    return;
                }
                Array.from(files).forEach(file => {
                    if (!window.isNaN(max_file_size) && window.parseInt(file.size) > max_file_size) {
                        return this.messages.create({
                            'message': __('The size of your file, %1$s, exceeds the maximum allowed by your server, which is %2$s.',
                                file.name, filesize(max_file_size)),
                            'type': 'error',
                            'is_ephemeral': true
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

            /**
             * Parses a passed in message stanza and returns an object of attributes.
             * @private
             * @method _converse.ChatBox#getMessageAttributesFromStanza
             * @param { XMLElement } stanza - The message stanza
             * @param { XMLElement } original_stanza - The original stanza, that contains the
             *  message stanza, if it was contained, otherwise it's the message stanza itself.
             * @returns { Object }
             */
            getMessageAttributesFromStanza (stanza, original_stanza) {
                // XXX: Eventually we want to get rid of this pass-through
                // method but currently we still need it because converse-omemo
                // overrides it.
                return stanza_utils.getMessageAttributesFromStanza(stanza, original_stanza, this, _converse);
            },

            maybeShow () {
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
            log.warn(`Rejecting message stanza with the following reason: ${text}`);
            log.warn(stanza);
        }


        async function handleErrorMessage (stanza) {
            const from_jid =  Strophe.getBareJidFromJid(stanza.getAttribute('from'));
            if (utils.isSameBareJID(from_jid, _converse.bare_jid)) {
                return;
            }
            const chatbox = await _converse.api.chatboxes.get(from_jid);
            if (!chatbox) {
                return;
            }
            const should_show = await chatbox.shouldShowErrorMessage(stanza);
            if (!should_show) {
                return;
            }
            const attrs = await chatbox.getMessageAttributesFromStanza(stanza, stanza);
            await chatbox.messages.create(attrs);
        }


        /**
         * Handler method for all incoming single-user chat "message" stanzas.
         * @private
         * @method _converse#handleMessageStanza
         * @param { XMLElement } stanza - The incoming message stanza
         */
        _converse.handleMessageStanza = async function (stanza) {
            const original_stanza = stanza;
            let to_jid = stanza.getAttribute('to');
            const to_resource = Strophe.getResourceFromJid(to_jid);

            if (_converse.filter_by_resource && (to_resource && to_resource !== _converse.resource)) {
                return log.info(`onMessage: Ignoring incoming message intended for a different resource: ${to_jid}`);
            } else if (utils.isHeadlineMessage(_converse, stanza)) {
                // XXX: Prosody sends headline messages with the
                // wrong type ('chat'), so we need to filter them out here.
                return log.info(`onMessage: Ignoring incoming headline message from JID: ${stanza.getAttribute('from')}`);
            }

            const bare_forward = sizzle(`message > forwarded[xmlns="${Strophe.NS.FORWARD}"]`, stanza).length;
            if (bare_forward) {
                return rejectMessage(
                    stanza,
                    'Forwarded messages not part of an encapsulating protocol are not supported'
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
                    return log.warn(`onMessage: Ignoring alleged MAM message from ${stanza.getAttribute('from')}`);
                }
            }

            const from_bare_jid = Strophe.getBareJidFromJid(from_jid);
            const is_me = from_bare_jid === _converse.bare_jid;
            if (is_me && to_jid === null) {
                return log.error(`Don't know how to handle message stanza without 'to' attribute. ${stanza.outerHTML}`);
            }
            const contact_jid = is_me ? Strophe.getBareJidFromJid(to_jid) : from_bare_jid;
            const contact = await _converse.api.contacts.get(contact_jid);
            if (contact === undefined && !_converse.allow_non_roster_messaging) {
                log.error(`Blocking messaging with a JID not in our roster because allow_non_roster_messaging is false.`);
                return log.error(stanza);
            }
            // Get chat box, but only create when the message has something to show to the user
            const has_body = sizzle(`body, encrypted[xmlns="${Strophe.NS.OMEMO}"]`, stanza).length > 0;
            const roster_nick = get(contact, 'attributes.nickname');
            const chatbox = await _converse.api.chats.get(contact_jid, {'nickname': roster_nick}, has_body);
            chatbox && await chatbox.onMessage(stanza, original_stanza, from_jid);
            /**
             * Triggered when a message stanza is been received and processed.
             * @event _converse#message
             * @type { object }
             * @property { _converse.ChatBox | _converse.ChatRoom } chatbox
             * @property { XMLElement } stanza
             * @example _converse.api.listen.on('message', obj => { ... });
             */
            _converse.api.trigger('message', {'stanza': original_stanza, 'chatbox': chatbox});
        }


        function registerMessageHandlers () {
           _converse.connection.addHandler(stanza => {
               if (sizzle(`message > result[xmlns="${Strophe.NS.MAM}"]`, stanza).pop()) {
                   // MAM messages are handled in converse-mam.
                   // We shouldn't get MAM messages here because
                   // they shouldn't have a `type` attribute.
                   log.warn(`Received a MAM message with type "chat".`);
                   return true;
               }
               _converse.handleMessageStanza(stanza);
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
               _converse.handleMessageStanza(stanza);
               return true;
           }, Strophe.NS.RECEIPTS, 'message');

           _converse.connection.addHandler(stanza => {
               handleErrorMessage(stanza);
               return true;
           }, null, 'message', 'error');
        }


        function autoJoinChats () {
            // Automatically join private chats, based on the
            // "auto_join_private_chats" configuration setting.
            _converse.auto_join_private_chats.forEach(jid => {
                if (_converse.chatboxes.where({'jid': jid}).length) {
                    return;
                }
                if (isString(jid)) {
                    _converse.api.chats.open(jid);
                } else {
                    log.error('Invalid jid criteria specified for "auto_join_private_chats"');
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


        /************************ BEGIN Route Handlers ************************/
        function openChat (jid) {
            if (!utils.isValidJID(jid)) {
                return log.warn(`Invalid JID "${jid}" provided in URL fragment`);
            }
            _converse.api.chats.open(jid);
        }
        _converse.router.route('converse/chat?jid=:jid', openChat);
        /************************ END Route Handlers ************************/


        /************************ BEGIN Event Handlers ************************/
        _converse.api.listen.on('chatBoxesFetched', autoJoinChats);
        _converse.api.listen.on('presencesInitialized', registerMessageHandlers);

        _converse.api.listen.on('clearSession', () => {
            if (_converse.shouldClearCache()) {
                _converse.chatboxes.filter(c => c.messages && c.messages.clearStore({'silent': true}));
            }
        });
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
                        const chatbox = _converse.api.chats.get(jids, attrs, true);
                        if (!chatbox) {
                            log.error("Could not open chatbox for JID: "+jids);
                            return;
                        }
                        return chatbox;
                    }
                    if (Array.isArray(jids)) {
                        return Promise.all(jids.forEach(async jid => {
                            const contact = await _converse.api.contacts.get(jids);
                            attrs.fullname = get(contact, 'attributes.fullname');
                            return _converse.api.chats.get(jid, attrs, true).maybeShow();
                        }));
                    }
                    log.error("chats.create: You need to provide at least one JID");
                    return null;
                },

                /**
                 * Opens a new one-on-one chat.
                 *
                 * @method _converse.api.chats.open
                 * @param {String|string[]} name - e.g. 'buddy@example.com' or ['buddy1@example.com', 'buddy2@example.com']
                 * @param {Object} [attrs] - Attributes to be set on the _converse.ChatBox model.
                 * @param {Boolean} [attrs.minimized] - Should the chat be created in minimized state.
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
                 *         const _converse = this._converse;
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
                 *         const _converse = this._converse;
                 *         // Note, these users must first be in your contacts roster!
                 *         _converse.api.chats.open(['buddy1@example.com', 'buddy2@example.com']).then(chats => {
                 *             // Now you can do something with the chat models
                 *         });
                 *     }
                 * });
                 */
                async open (jids, attrs, force) {
                    if (isString(jids)) {
                        const chat = await _converse.api.chats.get(jids, attrs, true);
                        if (chat) {
                            return chat.maybeShow(force);
                        }
                        return chat;
                    } else if (Array.isArray(jids)) {
                        return Promise.all(
                            jids.map(j => _converse.api.chats.get(j, attrs, true).then(c => c && c.maybeShow(force)))
                                .filter(c => c)
                        );
                    }
                    const err_msg = "chats.open: You need to provide at least one JID";
                    log.error(err_msg);
                    throw new Error(err_msg);
                },

                /**
                 * Retrieves a chat or all chats.
                 *
                 * @method _converse.api.chats.get
                 * @param {String|string[]} jids - e.g. 'buddy@example.com' or ['buddy1@example.com', 'buddy2@example.com']
                 * @param {Object} [attrs] - Attributes to be set on the _converse.ChatBox model.
                 * @param {Boolean} [create=false] - Whether the chat should be created if it's not found.
                 * @returns { Promise<_converse.ChatBox> }
                 *
                 * @example
                 * // To return a single chat, provide the JID of the contact you're chatting with in that chat:
                 * const model = await _converse.api.chats.get('buddy@example.com');
                 *
                 * @example
                 * // To return an array of chats, provide an array of JIDs:
                 * const models = await _converse.api.chats.get(['buddy1@example.com', 'buddy2@example.com']);
                 *
                 * @example
                 * // To return all open chats, call the method without any parameters::
                 * const models = await _converse.api.chats.get();
                 *
                 */
                async get (jids, attrs={}, create=false) {
                    async function _get (jid) {
                        let model = await _converse.api.chatboxes.get(jid);
                        if (!model && create) {
                            model = await _converse.api.chatboxes.create(jid, attrs, _converse.ChatBox);
                        } else {
                            model = (model && model.get('type') === _converse.PRIVATE_CHAT_TYPE) ? model : null;
                            if (model && Object.keys(attrs).length) {
                                model.save(attrs);
                            }
                        }
                        return model;
                    }
                    if (jids === undefined) {
                        const chats = await _converse.api.chatboxes.get();
                        return chats.filter(c => (c.get('type') === _converse.PRIVATE_CHAT_TYPE));
                    } else if (isString(jids)) {
                        return _get(jids);
                    }
                    return Promise.all(jids.map(jid => _get(jid)));
                }
            }
        });
        /************************ END API ************************/

    }
});
