import ModelWithContact from './model-with-contact.js';
import filesize from "filesize";
import isMatch from "lodash/isMatch";
import isObject from "lodash/isObject";
import log from '@converse/headless/log';
import pick from "lodash/pick";
import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api, converse } from "../../core.js";
import { parseMessage } from './parsers.js';
import { sendMarker } from '@converse/headless/shared/actions';

const { Strophe, $msg } = converse.env;

const u = converse.env.utils;

/**
 * Represents an open/ongoing chat conversation.
 *
 * @class
 * @namespace _converse.ChatBox
 * @memberOf _converse
 */
const ChatBox = ModelWithContact.extend({

    defaults () {
        return {
            'bookmarked': false,
            'chat_state': undefined,
            'hidden': _converse.isUniView() && !api.settings.get('singleton'),
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
        this.set({'box_id': `box-${jid}`});
        this.initNotifications();
        this.initMessages();

        if (this.get('type') === _converse.PRIVATE_CHAT_TYPE) {
            this.presence = _converse.presences.findWhere({'jid': jid}) || _converse.presences.create({'jid': jid});
            await this.setRosterContact(jid);
            this.presence.on('change:show', item => this.onPresenceChanged(item));
        }
        this.on('change:chat_state', this.sendChatState, this);


        await this.fetchMessages();
        /**
         * Triggered once a {@link _converse.ChatBox} has been created and initialized.
         * @event _converse#chatBoxInitialized
         * @type { _converse.ChatBox}
         * @example _converse.api.listen.on('chatBoxInitialized', model => { ... });
         */
        await api.trigger('chatBoxInitialized', this, {'Synchronous': true});
        this.initialized.resolve();
    },

    getMessagesCollection () {
        return new _converse.Messages();
    },

    getMessagesCacheKey () {
        return `converse.messages-${this.get('jid')}-${_converse.bare_jid}`;
    },

    initMessages () {
        this.messages = this.getMessagesCollection();
        this.messages.fetched = u.getResolveablePromise();
        this.messages.fetched.then(() => {
            /**
             * Triggered whenever a `_converse.ChatBox` instance has fetched its messages from
             * `sessionStorage` but **NOT** from the server.
             * @event _converse#afterMessagesFetched
             * @type {_converse.ChatBoxView | _converse.ChatRoomView}
             * @example _converse.api.listen.on('afterMessagesFetched', view => { ... });
             */
            api.trigger('afterMessagesFetched', this);
        });
        this.messages.chatbox = this;
        this.messages.browserStorage = _converse.createStore(this.getMessagesCacheKey());
        this.listenTo(this.messages, 'change:upload', message => {
            if (message.get('upload') === _converse.SUCCESS) {
                api.send(this.createMessageStanza(message));
            }
        });
    },

    initNotifications () {
        this.notifications = new Model();
    },

    getNotificationsText () {
        const { __ } = _converse;
        if (this.notifications?.get('chat_state') === _converse.COMPOSING) {
            return __('%1$s is typing', this.getDisplayName());
        } else if (this.notifications?.get('chat_state') === _converse.PAUSED) {
            return __('%1$s has stopped typing', this.getDisplayName());
        } else if (this.notifications?.get('chat_state') === _converse.GONE) {
            return __('%1$s has gone away', this.getDisplayName());
        } else {
            return '';
        }
    },

    afterMessagesFetched (messages) {
        this.most_recent_cached_message = messages ? this.getMostRecentMessage(messages) : null;
        /**
         * Triggered whenever a `_converse.ChatBox` instance has fetched its messages from
         * `sessionStorage` but **NOT** from the server.
         * @event _converse#afterMessagesFetched
         * @type {_converse.ChatBox | _converse.ChatRoom}
         * @example _converse.api.listen.on('afterMessagesFetched', view => { ... });
         */
        api.trigger('afterMessagesFetched', this);
    },

    fetchMessages () {
        if (this.messages.fetched_flag) {
            log.info(`Not re-fetching messages for ${this.get('jid')}`);
            return;
        }
        this.most_recent_cached_message = null;
        this.messages.fetched_flag = true;
        const resolve = this.messages.fetched.resolve;
        this.messages.fetch({
            'add': true,
            'success': msgs => { this.afterMessagesFetched(msgs); resolve() },
            'error': () => { this.afterMessagesFetched(); resolve() }
        });
        return this.messages.fetched;
    },

    async handleErrorMessageStanza (stanza) {
        const { __ } = _converse;
        const attrs = await parseMessage(stanza, _converse);
        if (!await this.shouldShowErrorMessage(attrs)) {
            return;
        }
        const message = this.getMessageReferencedByError(attrs);
        if (message) {
            const new_attrs = {
                'error': attrs.error,
                'error_condition': attrs.error_condition,
                'error_text': attrs.error_text,
                'error_type': attrs.error_type,
                'editable': false,
            };
            if (attrs.msgid === message.get('retraction_id')) {
                // The error message refers to a retraction
                new_attrs.retraction_id = undefined;
                if (!attrs.error) {
                    if (attrs.error_condition === 'forbidden') {
                        new_attrs.error = __("You're not allowed to retract your message.");
                    } else {
                        new_attrs.error = __('Sorry, an error occurred while trying to retract your message.');
                    }
                }
            } else if (!attrs.error) {
                if (attrs.error_condition === 'forbidden') {
                    new_attrs.error = __("You're not allowed to send a message.");
                } else {
                    new_attrs.error = __('Sorry, an error occurred while trying to send your message.');
                }
            }
            message.save(new_attrs);
        } else {
            this.createMessage(attrs);
        }
    },

    /**
     * Queue an incoming `chat` message stanza for processing.
     * @async
     * @private
     * @method _converse.ChatRoom#queueMessage
     * @param { Promise<MessageAttributes> } attrs - A promise which resolves to the message attributes
     */
    queueMessage (attrs) {
        this.msg_chain = (this.msg_chain || this.messages.fetched)
            .then(() => this.onMessage(attrs))
            .catch(e => log.error(e));
        return this.msg_chain;
    },

    /**
     * @async
     * @private
     * @method _converse.ChatRoom#onMessage
     * @param { MessageAttributes } attrs_promse - A promise which resolves to the message attributes.
     */
    async onMessage (attrs) {
        attrs = await attrs;
        if (u.isErrorObject(attrs)) {
            attrs.stanza && log.error(attrs.stanza);
            return log.error(attrs.message);
        }
        const message = this.getDuplicateMessage(attrs);
        if (message) {
            this.updateMessage(message, attrs);
        } else if (
                !this.handleReceipt(attrs) &&
                !this.handleChatMarker(attrs) &&
                !(await this.handleRetraction(attrs))
        ) {
            this.setEditable(attrs, attrs.time);

            if (attrs['chat_state'] && attrs.sender === 'them') {
                this.notifications.set('chat_state', attrs.chat_state);
            }
            if (u.shouldCreateMessage(attrs)) {
                const msg = this.handleCorrection(attrs) || await this.createMessage(attrs);
                this.notifications.set({'chat_state': null});
                this.handleUnreadMessage(msg);
            }
        }
    },

    async clearMessages () {
        try {
            await this.messages.clearStore();
        } catch (e) {
            this.messages.trigger('reset');
            log.error(e);
        } finally {
            delete this.msg_chain;
            delete this.messages.fetched_flag;
            this.messages.fetched = u.getResolveablePromise();
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
            if (api.settings.get('clear_messages_on_reconnection')) {
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
        api.trigger('chatReconnected', this);
    },

    async onReconnection () {
        if (api.settings.get('clear_messages_on_reconnection')) {
            await this.clearMessages();
        }
        this.announceReconnection();
    },

    onPresenceChanged (item) {
        const { __ } = _converse;
        const show = item.get('show');
        const fullname = this.getDisplayName();
        let text;
        if (show === 'offline') {
            text = __('%1$s has gone offline', fullname);
        } else if (show === 'away') {
            text = __('%1$s has gone away', fullname);
        } else if (show === 'dnd') {
            text = __('%1$s is busy', fullname);
        } else if (show === 'online') {
            text = __('%1$s is online', fullname);
        }
        text && this.createMessage({ 'message': text, 'type': 'info' });
    },

    validate (attrs) {
        if (!attrs.jid) {
            return 'Ignored ChatBox without JID';
        }
        const room_jids = api.settings.get('auto_join_rooms').map(s => isObject(s) ? s.jid : s);
        const auto_join = api.settings.get('auto_join_private_chats').concat(room_jids);
        if (api.settings.get("singleton") && !auto_join.includes(attrs.jid) && !api.settings.get('auto_join_on_invite')) {
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

    async createMessageFromError (error) {
        if (error instanceof _converse.TimeoutError) {
            const msg = await this.createMessage({
                'type': 'error',
                'message': error.message,
                'retry_event_id': error.retry_event_id
            });
            msg.error = error;
        }
    },

    editEarlierMessage () {
        let message;
        let idx = this.messages.findLastIndex('correcting');
        if (idx >= 0) {
            this.messages.at(idx).save('correcting', false);
            while (idx > 0) {
                idx -= 1;
                const candidate = this.messages.at(idx);
                if (candidate.get('editable')) {
                    message = candidate;
                    break;
                }
            }
        }
        message =
            message ||
            this.messages.filter({ 'sender': 'me' })
                .reverse()
                .find(m => m.get('editable'));
        if (message) {
            message.save('correcting', true);
        }
    },

    editLaterMessage () {
        let message;
        let idx = this.messages.findLastIndex('correcting');
        if (idx >= 0) {
            this.messages.at(idx).save('correcting', false);
            while (idx < this.messages.length - 1) {
                idx += 1;
                const candidate = this.messages.at(idx);
                if (candidate.get('editable')) {
                    message = candidate;
                    message.save('correcting', true);
                    break;
                }
            }
        }
        return message;
    },

    getOldestMessage () {
        for (let i=0; i<this.messages.length; i++) {
            const message = this.messages.at(i);
            if (message.get('type') === this.get('message_type')) {
                return message;
            }
        }
    },

    getMostRecentMessage (messages) {
        messages = messages || this.messages;
        for (let i=messages.length-1; i>=0; i--) {
            const message = messages.at(i);
            if (message.get('type') === this.get('message_type')) {
                return message;
            }
        }
    },

    getUpdatedMessageAttributes (message, attrs) {
        // Filter the attrs object, restricting it to only the `is_archived` key.
        return (({ is_archived }) => ({ is_archived }))(attrs)
    },

    updateMessage (message, attrs) {
        const new_attrs = this.getUpdatedMessageAttributes(message, attrs);
        new_attrs && message.save(new_attrs);
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
     * Given an error `<message>` stanza's attributes, find the saved message model which is
     * referenced by that error.
     * @param { Object } attrs
     */
    getMessageReferencedByError (attrs) {
        const id = attrs.msgid;
        return id && this.messages.models.find(m => [m.get('msgid'), m.get('retraction_id')].includes(id));
    },

    /**
     * @private
     * @method _converse.ChatBox#shouldShowErrorMessage
     * @returns {boolean}
     */
    shouldShowErrorMessage (attrs) {
        const msg = this.getMessageReferencedByError(attrs);
        if (!msg && !attrs.body) {
            // If the error refers to a message not included in our store,
            // and it doesn't have a <body> tag, we assume that this was a
            // CSI message (which we don't store).
            // See https://github.com/conversejs/converse.js/issues/1317
            return;
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
     *  message, as returned by {@link parseMessage}
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
     *  message, as returned by {@link parseMessage}
     * @returns { Boolean } Returns `true` or `false` depending on
     *  whether a message was retracted or not.
     */
    async handleRetraction (attrs) {
        const RETRACTION_ATTRIBUTES = ['retracted', 'retracted_id', 'editable'];
        if (attrs.retracted) {
            if (attrs.is_tombstone) {
                return false;
            }
            const message = this.messages.findWhere({'origin_id': attrs.retracted_id, 'from': attrs.from});
            if (!message) {
                attrs['dangling_retraction'] = true;
                await this.createMessage(attrs);
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
     *  message, as returned by {@link parseMessage}
     * @returns { _converse.Message|undefined } Returns the corrected
     *  message or `undefined` if not applicable.
     */
    handleCorrection (attrs) {
        if (!attrs.replace_id || !attrs.from) {
            return;
        }
        const message = this.messages.findWhere({'msgid': attrs.replace_id, 'from': attrs.from});
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
            if(Object.keys(older_versions).length) {
                older_versions[message.get('edited')] = message.get('message');
            }else {
                older_versions[message.get('time')] = message.get('message');
            }
            attrs = Object.assign(attrs, {'older_versions': older_versions});
            delete attrs['id']; // Delete id, otherwise a new cache entry gets created
            attrs['time'] = message.get('time');
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
     *  message, as returned by {@link parseMessage}
     * @returns {Promise<_converse.Message>}
     */
    getDuplicateMessage (attrs) {
        const queries = [
                ...this.getStanzaIdQueryAttrs(attrs),
                this.getOriginIdQueryAttrs(attrs),
                this.getMessageBodyQueryAttrs(attrs)
            ].filter(s => s);
        const msgs = this.messages.models;
        return msgs.find(m => queries.reduce((out, q) => (out || isMatch(m.attributes, q)), false));
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
            const query = {
                'from': attrs.from,
                'msgid': attrs.msgid
            }
            if (!attrs.is_encrypted) {
                // We can't match the message if it's a reflected
                // encrypted message (e.g. via MAM or in a MUC)
                query['message'] =  attrs.message;
            }
            return query;
        }
    },

    /**
     * Retract one of your messages in this chat
     * @private
     * @method _converse.ChatBoxView#retractOwnMessage
     * @param { _converse.Message } message - The message which we're retracting.
     */
    retractOwnMessage(message) {
        this.sendRetractionMessage(message)
        message.save({
            'retracted': (new Date()).toISOString(),
            'retracted_id': message.get('origin_id'),
            'retraction_id': message.get('id'),
            'is_ephemeral': true,
            'editable': false
        });
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


    /**
     * Finds the last eligible message and then sends a XEP-0333 chat marker for it.
     * @param { ('received'|'displayed'|'acknowledged') } [type='displayed']
     * @param { Boolean } force - Whether a marker should be sent for the
     *  message, even if it didn't include a `markable` element.
     */
    sendMarkerForLastMessage (type='displayed', force=false) {
        const msgs = Array.from(this.messages.models);
        msgs.reverse();
        const msg = msgs.find(m => m.get('sender') === 'them' && (force || m.get('is_markable')));
        msg && this.sendMarkerForMessage(msg, type, force);
    },

    /**
     * Given the passed in message object, send a XEP-0333 chat marker.
     * @param { _converse.Message } msg
     * @param { ('received'|'displayed'|'acknowledged') } [type='displayed']
     * @param { Boolean } force - Whether a marker should be sent for the
     *  message, even if it didn't include a `markable` element.
     */
    sendMarkerForMessage (msg, type='displayed', force=false) {
        if (!msg || !api.settings.get('send_chat_markers').includes(type)) {
            return;
        }
        if (msg?.get('is_markable') || force) {
            const from_jid = Strophe.getBareJidFromJid(msg.get('from'));
            sendMarker(from_jid, msg.get('msgid'), type, msg.get('type'));
        }
    },

    handleChatMarker (attrs) {
        const to_bare_jid = Strophe.getBareJidFromJid(attrs.to);
        if (to_bare_jid !== _converse.bare_jid) {
            return false;
        }
        if (attrs.is_markable) {
            if (this.contact && !attrs.is_archived && !attrs.is_carbon) {
                sendMarker(attrs.from, attrs.msgid, 'received');
            }
            return false;
        } else if (attrs.marker_id) {
            const message = this.messages.findWhere({'msgid': attrs.marker_id});
            const field_name = `marker_${attrs.marker}`;
            if (message && !message.get(field_name)) {
                message.save({field_name: (new Date()).toISOString()});
            }
            return true;
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
        api.send(receipt_stanza);
    },

    handleReceipt (attrs) {
        if (attrs.sender === 'them') {
            if (attrs.is_valid_receipt_request) {
                this.sendReceiptStanza(attrs.from, attrs.msgid);
            } else if (attrs.receipt_id) {
                const message = this.messages.findWhere({'msgid': attrs.receipt_id});
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
        const body = text ? u.httpToGeoUri(u.shortnamesToUnicode(text), _converse) : undefined;
        return {
            'from': _converse.bare_jid,
            'fullname': _converse.xmppstatus.get('fullname'),
            'id': origin_id,
            'is_only_emojis': text ? u.isOnlyEmojis(text) : false,
            'jid': this.get('jid'),
            'message': body,
            'msgid': origin_id,
            'nickname': this.get('nickname'),
            'sender': 'me',
            'spoiler_hint': is_spoiler ? spoiler_hint : undefined,
            'time': (new Date()).toISOString(),
            'type': this.get('message_type'),
            body,
            is_spoiler,
            origin_id
        }
    },

    /**
     * Responsible for setting the editable attribute of messages.
     * If api.settings.get('allow_message_corrections') is "last", then only the last
     * message sent from me will be editable. If set to "all" all messages
     * will be editable. Otherwise no messages will be editable.
     * @method _converse.ChatBox#setEditable
     * @memberOf _converse.ChatBox
     * @param { Object } attrs An object containing message attributes.
     * @param { String } send_time - time when the message was sent
     */
    setEditable (attrs, send_time) {
        if (attrs.is_headline || u.isEmptyMessage(attrs) || attrs.sender !== 'me') {
            return;
        }
        if (api.settings.get('allow_message_corrections') === 'all') {
            attrs.editable = !(attrs.file || attrs.retracted || 'oob_url' in attrs);
        } else if ((api.settings.get('allow_message_corrections') === 'last') && (send_time > this.get('time_sent'))) {
            this.set({'time_sent': send_time});
            const msg = this.messages.findWhere({'editable': true});
            if (msg) {
                msg.save({'editable': false});
            }
            attrs.editable = !(attrs.file || attrs.retracted || 'oob_url' in attrs);
        }
    },

    /**
     * Queue the creation of a message, to make sure that we don't run
     * into a race condition whereby we're creating a new message
     * before the collection has been fetched.
     * @async
     * @private
     * @method _converse.ChatRoom#queueMessageCreation
     * @param { Object } attrs
     */
    async createMessage (attrs, options) {
        attrs.time = attrs.time || (new Date()).toISOString();
        await this.messages.fetched;
        const p = this.messages.create(attrs, Object.assign({'wait': true, 'promise':true}, options));
        return p;
    },

    /**
     * Responsible for sending off a text message inside an ongoing chat conversation.
     * @private
     * @method _converse.ChatBox#sendMessage
     * @memberOf _converse.ChatBox
     * @param { String } text - The chat message text
     * @param { String } spoiler_hint - An optional hint, if the message being sent is a spoiler
     * @returns { _converse.Message }
     * @example
     * const chat = api.chats.get('buddy1@example.com');
     * chat.sendMessage('hello world');
     */
    async sendMessage (text, spoiler_hint) {
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
            message = await this.createMessage(attrs);
        }
        api.send(this.createMessageStanza(message));

       /**
        * Triggered when a message is being sent out
        * @event _converse#sendMessage
        * @type { Object }
        * @param { Object } data
        * @property { (_converse.ChatBox | _converse.ChatRoom) } data.chatbox
        * @property { (_converse.Message | _converse.ChatRoomMessage) } data.message
        */
        api.trigger('sendMessage', {'chatbox': this, message});
        return message;
    },

    /**
     * Sends a message with the current XEP-0085 chat state of the user
     * as taken from the `chat_state` attribute of the {@link _converse.ChatBox}.
     * @private
     * @method _converse.ChatBox#sendChatState
     */
    sendChatState () {
        if (api.settings.get('send_chat_state_notifications') && this.get('chat_state')) {
            const allowed = api.settings.get('send_chat_state_notifications');
            if (Array.isArray(allowed) && !allowed.includes(this.get('chat_state'))) {
                return;
            }
            api.send(
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
        const { __ } = _converse;
        const result = await api.disco.features.get(Strophe.NS.HTTPUPLOAD, _converse.domain);
        const item = result.pop();
        if (!item) {
            this.createMessage({
                'message': __("Sorry, looks like file upload is not supported by your server."),
                'type': 'error',
                'is_ephemeral': true
            });
            return;
        }
        const data = item.dataforms.where({'FORM_TYPE': {'value': Strophe.NS.HTTPUPLOAD, 'type': "hidden"}}).pop();
        const max_file_size = window.parseInt((data?.attributes || {})['max-file-size']?.value);
        const slot_request_url = item?.id;

        if (!slot_request_url) {
            this.createMessage({
                'message': __("Sorry, looks like file upload is not supported by your server."),
                'type': 'error',
                'is_ephemeral': true
            });
            return;
        }
        Array.from(files).forEach(async file => {
            if (!window.isNaN(max_file_size) && window.parseInt(file.size) > max_file_size) {
                return this.createMessage({
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
                const message = await this.createMessage(attrs, {'silent': true});
                message.file = file;
                this.messages.trigger('add', message);
                message.getRequestSlotURL();
            }
        });
    },

    maybeShow (force) {
        if (_converse.isUniView()) {
            const filter = c => !c.get('hidden') &&
                c.get('jid') !== this.get('jid') &&
                c.get('id') !== 'controlbox';
            const other_chats = _converse.chatboxes.filter(filter);
            if (force || other_chats.length === 0) {
                // We only have one chat visible at any one time.
                // So before opening a chat, we make sure all other chats are hidden.
                other_chats.forEach(c => u.safeSave(c, {'hidden': true}));
                u.safeSave(this, {'hidden': false});
            }
            return;
        }
        u.safeSave(this, {'hidden': false});
        this.trigger('show');
        return this;
    },

    /**
     * Indicates whether the chat is hidden and therefore
     * whether a newly received message will be visible
     * to the user or not.
     * @returns {boolean}
     */
    isHidden () {
        // Note: This methods gets overridden by converse-minimize
        const hidden = _converse.isUniView() && this.get('hidden');
        return hidden || this.isScrolledUp() || _converse.windowState === 'hidden';
    },

    /**
     * Given a newly received {@link _converse.Message} instance,
     * update the unread counter if necessary.
     * @private
     * @param {_converse.Message} message
     */
    handleUnreadMessage (message) {
        if (!message?.get('body')) {
            return
        }
        if (u.isNewMessage(message)) {
            if (this.isHidden()) {
                const settings = {
                    'num_unread': this.get('num_unread') + 1
                };
                if (this.get('num_unread') === 0) {
                    settings['first_unread_id'] = message.get('id');
                }
                this.save(settings);
            } else {
                this.sendMarkerForMessage(message);
            }
        }
    },

    clearUnreadMsgCounter() {
        if (this.get('num_unread') > 0) {
            this.sendMarkerForMessage(this.messages.last());
        }
        u.safeSave(this, {'num_unread': 0});
    },

    isScrolledUp () {
        return this.get('scrolled', true);
    }
});

export default ChatBox;
