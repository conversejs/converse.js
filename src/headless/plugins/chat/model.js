/**
 * @typedef {import('./message.js').default} Message
 * @typedef {import('../muc/muc.js').default} MUC
 * @typedef {import('../muc/message.js').default} MUCMessage
 * @typedef {module:plugin-chat-parsers.MessageAttributes} MessageAttributes
 * @typedef {import('strophe.js/src/builder.js').Builder} Strophe.Builder
 */
import ModelWithContact from './model-with-contact.js';
import _converse from '../../shared/_converse.js';
import api, { converse } from '../../shared/api/index.js';
import isMatch from "lodash-es/isMatch";
import log from '../../log.js';
import pick from "lodash-es/pick";
import { Model } from '@converse/skeletor';
import { ACTIVE, PRIVATE_CHAT_TYPE, COMPOSING, INACTIVE, PAUSED, SUCCESS, GONE } from '@converse/headless/shared/constants.js';
import { TimeoutError } from '../../shared/errors.js';
import { debouncedPruneHistory, handleCorrection } from '../../shared/chat/utils.js';
import { filesize } from "filesize";
import { getMediaURLsMetadata } from '../../shared/parsers.js';
import { getOpenPromise } from '@converse/openpromise';
import { initStorage } from '../../utils/storage.js';
import { isEmptyMessage } from '../../utils/index.js';
import { isNewMessage } from './utils.js';
import { isUniView } from '../../utils/session.js';
import { parseMessage } from './parsers.js';
import { sendMarker } from '../../shared/actions.js';

const { Strophe, $msg, u } = converse.env;


/**
 * Represents an open/ongoing chat conversation.
 * @namespace ChatBox
 * @memberOf _converse
 */
class ChatBox extends ModelWithContact {

    defaults () {
        return {
            'bookmarked': false,
            'hidden': isUniView() && !api.settings.get('singleton'),
            'message_type': 'chat',
            'num_unread': 0,
            'time_opened': this.get('time_opened') || (new Date()).getTime(),
            'time_sent': (new Date(0)).toISOString(),
            'type': PRIVATE_CHAT_TYPE,
        }
    }

    constructor (attrs, options) {
        super(attrs, options);
        this.disable_mam = false;
    }

    async initialize () {
        super.initialize();
        this.initialized = getOpenPromise();

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
        this.initUI();
        this.initMessages();

        if (this.get('type') === PRIVATE_CHAT_TYPE) {
            const { presences } = _converse.state;
            this.presence = presences.get(jid) || presences.create({ jid });
            await this.setRosterContact(jid);
            this.presence.on('change:show', item => this.onPresenceChanged(item));
        }
        this.on('change:chat_state', this.sendChatState, this);
        this.ui.on('change:scrolled', this.onScrolledChanged, this);

        await this.fetchMessages();
        /**
         * Triggered once a {@link ChatBox} has been created and initialized.
         * @event _converse#chatBoxInitialized
         * @type { ChatBox}
         * @example _converse.api.listen.on('chatBoxInitialized', model => { ... });
         */
        await api.trigger('chatBoxInitialized', this, {'Synchronous': true});
        this.initialized.resolve();
    }

    getMessagesCollection () {
        return new _converse.exports.Messages();
    }

    getMessagesCacheKey () {
        return `converse.messages-${this.get('jid')}-${_converse.session.get('bare_jid')}`;
    }

    initMessages () {
        this.messages = this.getMessagesCollection();
        this.messages.fetched = getOpenPromise();
        this.messages.chatbox = this;
        initStorage(this.messages, this.getMessagesCacheKey());

        this.listenTo(this.messages, 'change:upload', m => this.onMessageUploadChanged(m));
        this.listenTo(this.messages, 'add', m => this.onMessageAdded(m));
    }

    initUI () {
        this.ui = new Model();
    }

    initNotifications () {
        this.notifications = new Model();
    }

    getNotificationsText () {
        const { __ } = _converse;
        if (this.notifications?.get('chat_state') === COMPOSING) {
            return __('%1$s is typing', this.getDisplayName());
        } else if (this.notifications?.get('chat_state') === PAUSED) {
            return __('%1$s has stopped typing', this.getDisplayName());
        } else if (this.notifications?.get('chat_state') === GONE) {
            return __('%1$s has gone away', this.getDisplayName());
        } else {
            return '';
        }
    }

    afterMessagesFetched () {
        this.pruneHistoryWhenScrolledDown();
        /**
         * Triggered whenever a { @link ChatBox } or ${ @link MUC }
         * has fetched its messages from the local cache.
         * @event _converse#afterMessagesFetched
         * @type { ChatBox| MUC }
         * @example _converse.api.listen.on('afterMessagesFetched', (chat) => { ... });
         */
        api.trigger('afterMessagesFetched', this);
    }

    fetchMessages () {
        if (this.messages.fetched_flag) {
            log.info(`Not re-fetching messages for ${this.get('jid')}`);
            return;
        }
        this.messages.fetched_flag = true;
        const resolve = this.messages.fetched.resolve;
        this.messages.fetch({
            'add': true,
            'success': () => { this.afterMessagesFetched(); resolve() },
            'error': () => { this.afterMessagesFetched(); resolve() }
        });
        return this.messages.fetched;
    }

    async handleErrorMessageStanza (stanza) {
        const { __ } = _converse;
        const attrs = await parseMessage(stanza);
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
    }

    /**
     * Queue an incoming `chat` message stanza for processing.
     * @async
     * @method ChatBox#queueMessage
     * @param {MessageAttributes} attrs - A promise which resolves to the message attributes
     */
    queueMessage (attrs) {
        this.msg_chain = (this.msg_chain || this.messages.fetched)
            .then(() => this.onMessage(attrs))
            .catch(e => log.error(e));
        return this.msg_chain;
    }

    /**
     * @async
     * @method ChatBox#onMessage
     * @param {Promise<MessageAttributes>} attrs_promise - A promise which resolves to the message attributes.
     */
    async onMessage (attrs_promise) {
        const attrs = await attrs_promise;
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
                const msg = await handleCorrection(this, attrs) || await this.createMessage(attrs);
                this.notifications.set({'chat_state': null});
                this.handleUnreadMessage(msg);
            }
        }
    }

    async onMessageUploadChanged (message) {
        if (message.get('upload') === SUCCESS) {
            const attrs = {
                'body': message.get('body'),
                'spoiler_hint': message.get('spoiler_hint'),
                'oob_url': message.get('oob_url')

            }
            await this.sendMessage(attrs);
            message.destroy();
        }
    }

    onMessageAdded (message) {
        if (api.settings.get('prune_messages_above') &&
            (api.settings.get('pruning_behavior') === 'scrolled' || !this.ui.get('scrolled')) &&
            !isEmptyMessage(message)
        ) {
            debouncedPruneHistory(this);
        }
    }

    async clearMessages () {
        try {
            await this.messages.clearStore();
        } catch (e) {
            this.messages.trigger('reset');
            log.error(e);
        } finally {
            // No point in fetching messages from the cache if it's been cleared.
            // Make sure to resolve the fetched promise to avoid freezes.
            this.messages.fetched.resolve();
        }
    }

    async close () {
        if (api.connection.connected()) {
            // Immediately sending the chat state, because the
            // model is going to be destroyed afterwards.
            this.setChatState(INACTIVE);
            this.sendChatState();
        }
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
        /**
         * Triggered once a chatbox has been closed.
         * @event _converse#chatBoxClosed
         * @type {ChatBox | MUC}
         * @example _converse.api.listen.on('chatBoxClosed', chat => { ... });
         */
        api.trigger('chatBoxClosed', this);
    }

    announceReconnection () {
        /**
         * Triggered whenever a `ChatBox` instance has reconnected after an outage
         * @event _converse#onChatReconnected
         * @type {ChatBox | MUC}
         * @example _converse.api.listen.on('onChatReconnected', chat => { ... });
         */
        api.trigger('chatReconnected', this);
    }

    async onReconnection () {
        if (api.settings.get('clear_messages_on_reconnection')) {
            await this.clearMessages();
        }
        this.announceReconnection();
    }

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
    }

    onScrolledChanged () {
        if (!this.ui.get('scrolled')) {
            this.clearUnreadMsgCounter();
            this.pruneHistoryWhenScrolledDown();
        }
    }

    pruneHistoryWhenScrolledDown () {
        if (
            api.settings.get('prune_messages_above') &&
            api.settings.get('pruning_behavior') === 'unscrolled' &&
            !this.ui.get('scrolled')
        ) {
            debouncedPruneHistory(this);
        }
    }

    validate (attrs) {
        if (!attrs.jid) {
            return 'Ignored ChatBox without JID';
        }
        const room_jids = api.settings.get('auto_join_rooms').map(s => (s instanceof Object) ? s.jid : s);
        const auto_join = api.settings.get('auto_join_private_chats').concat(room_jids);
        if (api.settings.get("singleton") && !auto_join.includes(attrs.jid) && !api.settings.get('auto_join_on_invite')) {
            const msg = `${attrs.jid} is not allowed because singleton is true and it's not being auto_joined`;
            log.warn(msg);
            return msg;
        }
    }

    getDisplayName () {
        if (this.contact) {
            return this.contact.getDisplayName();
        } else if (this.vcard) {
            return this.vcard.getDisplayName();
        } else {
            return this.get('jid');
        }
    }

    async createMessageFromError (error) {
        if (error instanceof TimeoutError) {
            const msg = await this.createMessage({
                'type': 'error',
                'message': error.message,
                'retry_event_id': error.retry_event_id,
                'is_ephemeral': 30000,
            });
            msg.error = error;
        }
    }

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
    }

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
    }

    getOldestMessage () {
        for (let i=0; i<this.messages.length; i++) {
            const message = this.messages.at(i);
            if (message.get('type') === this.get('message_type')) {
                return message;
            }
        }
    }

    getMostRecentMessage () {
        for (let i=this.messages.length-1; i>=0; i--) {
            const message = this.messages.at(i);
            if (message.get('type') === this.get('message_type')) {
                return message;
            }
        }
    }

    getUpdatedMessageAttributes (message, attrs) {
        if (!attrs.error_type && message.get('error_type') === 'Decryption') {
            // Looks like we have a failed decrypted message stored, and now
            // we have a properly decrypted version of the same message.
            // See issue: https://github.com/conversejs/converse.js/issues/2733#issuecomment-1035493594
            return Object.assign({}, attrs, {
                error_condition: undefined,
                error_message: undefined,
                error_text: undefined,
                error_type: undefined,
                is_archived: attrs.is_archived,
                is_ephemeral: false,
                is_error: false,
            });
        } else {
            return { is_archived: attrs.is_archived };
        }
    }

    updateMessage (message, attrs) {
        const new_attrs = this.getUpdatedMessageAttributes(message, attrs);
        new_attrs && message.save(new_attrs);
    }

    /**
     * Mutator for setting the chat state of this chat session.
     * Handles clearing of any chat state notification timeouts and
     * setting new ones if necessary.
     * Timeouts are set when the  state being set is COMPOSING or PAUSED.
     * After the timeout, COMPOSING will become PAUSED and PAUSED will become INACTIVE.
     * See XEP-0085 Chat State Notifications.
     * @private
     * @method ChatBox#setChatState
     * @param { string } state - The chat state (consts ACTIVE, COMPOSING, PAUSED, INACTIVE, GONE)
     */
    setChatState (state, options) {
        if (this.chat_state_timeout !== undefined) {
            window.clearTimeout(this.chat_state_timeout);
            delete this.chat_state_timeout;
        }
        if (state === COMPOSING) {
            this.chat_state_timeout = window.setTimeout(
                this.setChatState.bind(this),
                _converse.TIMEOUTS.PAUSED,
                PAUSED
            );
        } else if (state === PAUSED) {
            this.chat_state_timeout = window.setTimeout(
                this.setChatState.bind(this),
                _converse.TIMEOUTS.INACTIVE,
                INACTIVE
            );
        }
        this.set('chat_state', state, options);
        return this;
    }

    /**
     * Given an error `<message>` stanza's attributes, find the saved message model which is
     * referenced by that error.
     * @param {object} attrs
     */
    getMessageReferencedByError (attrs) {
        const id = attrs.msgid;
        return id && this.messages.models.find(m => [m.get('msgid'), m.get('retraction_id')].includes(id));
    }

    /**
     * @method ChatBox#shouldShowErrorMessage
     * @param {object} attrs
     * @returns {Promise<boolean>}
     */
    shouldShowErrorMessage (attrs) {
        const msg = this.getMessageReferencedByError(attrs);
        if (!msg && attrs.chat_state) {
            // If the error refers to a message not included in our store,
            // and it has a chat state tag, we assume that this was a
            // CSI message (which we don't store).
            // See https://github.com/conversejs/converse.js/issues/1317
            return;
        }
        // Gets overridden in MUC
        // Return promise because subclasses need to return promises
        return Promise.resolve(true);
    }

    /**
     * @param {string} jid1
     * @param {string} jid2
     */
    isSameUser (jid1, jid2) {
        return u.isSameBareJID(jid1, jid2);
    }

    /**
     * Looks whether we already have a retraction for this
     * incoming message. If so, it's considered "dangling" because it
     * probably hasn't been applied to anything yet, given that the
     * relevant message is only coming in now.
     * @private
     * @method ChatBox#findDanglingRetraction
     * @param { object } attrs - Attributes representing a received
     *  message, as returned by {@link parseMessage}
     * @returns { Message }
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
    }

    /**
     * Handles message retraction based on the passed in attributes.
     * @method ChatBox#handleRetraction
     * @param {object} attrs - Attributes representing a received
     *  message, as returned by {@link parseMessage}
     * @returns {Promise<Boolean>} Returns `true` or `false` depending on
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
    }

    /**
     * Returns an already cached message (if it exists) based on the
     * passed in attributes map.
     * @method ChatBox#getDuplicateMessage
     * @param {object} attrs - Attributes representing a received
     *  message, as returned by {@link parseMessage}
     * @returns {Message}
     */
    getDuplicateMessage (attrs) {
        const queries = [
                ...this.getStanzaIdQueryAttrs(attrs),
                this.getOriginIdQueryAttrs(attrs),
                this.getMessageBodyQueryAttrs(attrs)
            ].filter(s => s);
        const msgs = this.messages.models;
        return msgs.find(m => queries.reduce((out, q) => (out || isMatch(m.attributes, q)), false));
    }

    getOriginIdQueryAttrs (attrs) {
        return attrs.origin_id && {'origin_id': attrs.origin_id, 'from': attrs.from};
    }

    getStanzaIdQueryAttrs (attrs) {
        const keys = Object.keys(attrs).filter(k => k.startsWith('stanza_id '));
        return keys.map(key => {
            const by_jid = key.replace(/^stanza_id /, '');
            const query = {};
            query[`stanza_id ${by_jid}`] = attrs[key];
            return query;
        });
    }

    getMessageBodyQueryAttrs (attrs) {
        if (attrs.msgid) {
            const query = {
                'from': attrs.from,
                'msgid': attrs.msgid
            }
            // XXX: Need to take XEP-428 <fallback> into consideration
            if (!attrs.is_encrypted && attrs.body) {
                // We can't match the message if it's a reflected
                // encrypted message (e.g. via MAM or in a MUC)
                query['body'] =  attrs.body;
            }
            return query;
        }
    }

    /**
     * Retract one of your messages in this chat
     * @method ChatBoxView#retractOwnMessage
     * @param { Message } message - The message which we're retracting.
     */
    retractOwnMessage (message) {
        this.sendRetractionMessage(message)
        message.save({
            'retracted': (new Date()).toISOString(),
            'retracted_id': message.get('origin_id'),
            'retraction_id': message.get('id'),
            'is_ephemeral': true,
            'editable': false
        });
    }

    /**
     * Sends a message stanza to retract a message in this chat
     * @private
     * @method ChatBox#sendRetractionMessage
     * @param { Message } message - The message which we're retracting.
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
        return api.connection.get().send(msg);
    }

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
    }

    /**
     * Given the passed in message object, send a XEP-0333 chat marker.
     * @param { Message } msg
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
    }

    handleChatMarker (attrs) {
        const to_bare_jid = Strophe.getBareJidFromJid(attrs.to);
        if (to_bare_jid !== _converse.session.get('bare_jid')) {
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
    }

    sendReceiptStanza (to_jid, id) {
        const receipt_stanza = $msg({
            'from': api.connection.get().jid,
            'id': u.getUniqueId(),
            'to': to_jid,
            'type': 'chat',
        }).c('received', {'xmlns': Strophe.NS.RECEIPTS, 'id': id}).up()
        .c('store', {'xmlns': Strophe.NS.HINTS}).up();
        api.send(receipt_stanza);
    }

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
    }

    /**
     * Given a {@link Message} return the XML stanza that represents it.
     * @private
     * @method ChatBox#createMessageStanza
     * @param { Message } message - The message object
     */
    async createMessageStanza (message) {
        const stanza = $msg({
                'from': api.connection.get().jid,
                'to': this.get('jid'),
                'type': this.get('message_type'),
                'id': message.get('edited') && u.getUniqueId() || message.get('msgid'),
            }).c('body').t(message.get('body')).up()
              .c(ACTIVE, {'xmlns': Strophe.NS.CHATSTATES}).root();

        if (message.get('type') === 'chat') {
            stanza.c('request', {'xmlns': Strophe.NS.RECEIPTS}).root();
        }

        if (!message.get('is_encrypted')) {
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
        stanza.root();
        /**
         * *Hook* which allows plugins to update an outgoing message stanza
         * @event _converse#createMessageStanza
         * @param { ChatBox | MUC } chat - The chat from
         *      which this message stanza is being sent.
         * @param { Object } data - Message data
         * @param { Message | MUCMessage } data.message
         *      The message object from which the stanza is created and which gets persisted to storage.
         * @param { Strophe.Builder } data.stanza
         *      The stanza that will be sent out, as a Strophe.Builder object.
         *      You can use the Strophe.Builder functions to extend the stanza.
         *      See http://strophe.im/strophejs/doc/1.4.3/files/strophe-umd-js.html#Strophe.Builder.Functions
         */
        const data = await api.hook('createMessageStanza', this, { message, stanza });
        return data.stanza;
    }

    async getOutgoingMessageAttributes (attrs) {
        await api.emojis.initialize();
        const is_spoiler = !!this.get('composing_spoiler');
        const origin_id = u.getUniqueId();
        const text = attrs?.body;
        const body = text ? u.shortnamesToUnicode(text) : undefined;
        attrs = Object.assign({}, attrs, {
            'from': _converse.session.get('bare_jid'),
            'fullname': _converse.state.xmppstatus.get('fullname'),
            'id': origin_id,
            'is_only_emojis': text ? u.isOnlyEmojis(text) : false,
            'jid': this.get('jid'),
            'message': body,
            'msgid': origin_id,
            'nickname': this.get('nickname'),
            'sender': 'me',
            'time': (new Date()).toISOString(),
            'type': this.get('message_type'),
            body,
            is_spoiler,
            origin_id
        }, getMediaURLsMetadata(text));

        /**
         * *Hook* which allows plugins to update the attributes of an outgoing message.
         * These attributes get set on the {@link Message} or
         * {@link MUCMessage} and persisted to storage.
         * @event _converse#getOutgoingMessageAttributes
         * @param {ChatBox|MUC} chat
         *      The chat from which this message will be sent.
         * @param {MessageAttributes} attrs
         *      The message attributes, from which the stanza will be created.
         */
        attrs = await api.hook('getOutgoingMessageAttributes', this, attrs);
        return attrs;
    }

    /**
     * Responsible for setting the editable attribute of messages.
     * If api.settings.get('allow_message_corrections') is "last", then only the last
     * message sent from me will be editable. If set to "all" all messages
     * will be editable. Otherwise no messages will be editable.
     * @method ChatBox#setEditable
     * @memberOf ChatBox
     * @param {Object} attrs An object containing message attributes.
     * @param {String} send_time - time when the message was sent
     */
    setEditable (attrs, send_time) {
        if (attrs.is_headline || isEmptyMessage(attrs) || attrs.sender !== 'me') {
            return;
        }
        if (api.settings.get('allow_message_corrections') === 'all') {
            attrs.editable = !(attrs.file || attrs.retracted || 'oob_url' in attrs);
        } else if ((api.settings.get('allow_message_corrections') === 'last') && (send_time > this.get('time_sent'))) {
            this.set({'time_sent': send_time});
            this.messages.findWhere({'editable': true})?.save({'editable': false});
            attrs.editable = !(attrs.file || attrs.retracted || 'oob_url' in attrs);
        }
    }

    /**
     * Queue the creation of a message, to make sure that we don't run
     * into a race condition whereby we're creating a new message
     * before the collection has been fetched.
     * @method ChatBox#createMessage
     * @param {Object} attrs
     */
    async createMessage (attrs, options) {
        attrs.time = attrs.time || (new Date()).toISOString();
        await this.messages.fetched;
        return this.messages.create(attrs, options);
    }

    /**
     * Responsible for sending off a text message inside an ongoing chat conversation.
     * @method ChatBox#sendMessage
     * @memberOf ChatBox
     * @param {Object} [attrs] - A map of attributes to be saved on the message
     * @returns {Promise<Message>}
     * @example
     * const chat = api.chats.get('buddy1@example.org');
     * chat.sendMessage({'body': 'hello world'});
     */
    async sendMessage (attrs) {
        attrs = await this.getOutgoingMessageAttributes(attrs);
        let message = this.messages.findWhere('correcting')
        if (message) {
            const older_versions = message.get('older_versions') || {};
            const edited_time = message.get('edited') || message.get('time');
            older_versions[edited_time] = message.getMessageText();

            message.save({
                ...pick(attrs, ['body', 'is_only_emojis', 'media_urls', 'references', 'is_encrypted']),
                ...{
                    'correcting': false,
                    'edited': (new Date()).toISOString(),
                    'message': attrs.body,
                    'ogp_metadata': [],
                    'origin_id': u.getUniqueId(),
                    'received': undefined,
                    older_versions,
                    plaintext: attrs.is_encrypted ? attrs.message : undefined,
                }
            });
        } else {
            this.setEditable(attrs, (new Date()).toISOString());
            message = await this.createMessage(attrs);
        }

        try {
            const stanza = await this.createMessageStanza(message);
            api.send(stanza);
        } catch (e) {
            message.destroy();
            log.error(e);
            return;
        }

       /**
        * Triggered when a message is being sent out
        * @event _converse#sendMessage
        * @type { Object }
        * @param { Object } data
        * @property { (ChatBox | MUC) } data.chatbox
        * @property { (Message | MUCMessage) } data.message
        */
        api.trigger('sendMessage', {'chatbox': this, message});
        return message;
    }

    /**
     * Sends a message with the current XEP-0085 chat state of the user
     * as taken from the `chat_state` attribute of the {@link ChatBox}.
     * @method ChatBox#sendChatState
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
    }


    /**
     * @param {File[]} files
     */
    async sendFiles (files) {
        const { __, session } = _converse;
        const result = await api.disco.features.get(Strophe.NS.HTTPUPLOAD, session.get('domain'));
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
            /**
             * *Hook* which allows plugins to transform files before they'll be
             * uploaded. The main use-case is to encrypt the files.
             * @event _converse#beforeFileUpload
             * @param {ChatBox|MUC} chat - The chat from which this file will be uploaded.
             * @param {File} file - The file that will be uploaded
             */
            file = await api.hook('beforeFileUpload', this, file);

            if (!window.isNaN(max_file_size) && file.size > max_file_size) {
                return this.createMessage({
                    'message': __('The size of your file, %1$s, exceeds the maximum allowed by your server, which is %2$s.',
                        file.name, filesize(max_file_size)),
                    'type': 'error',
                    'is_ephemeral': true
                });
            } else {
                const initial_attrs = await this.getOutgoingMessageAttributes();
                const attrs = Object.assign(initial_attrs, {
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
    }

    /**
     * @param {boolean} force
     */
    maybeShow (force) {
        if (isUniView()) {
            const filter = (c) => !c.get('hidden') &&
                c.get('jid') !== this.get('jid') &&
                c.get('id') !== 'controlbox';
            const other_chats = _converse.state.chatboxes.filter(filter);
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
    }

    /**
     * Indicates whether the chat is hidden and therefore
     * whether a newly received message will be visible
     * to the user or not.
     * @returns {boolean}
     */
    isHidden () {
        return this.get('hidden') || this.isScrolledUp() || document.hidden;
    }

    /**
     * Given a newly received {@link Message} instance,
     * update the unread counter if necessary.
     * @method ChatBox#handleUnreadMessage
     * @param {Message} message
     */
    handleUnreadMessage (message) {
        if (!message?.get('body')) {
            return
        }
        if (isNewMessage(message)) {
            if (message.get('sender') === 'me') {
                // We remove the "scrolled" flag so that the chat area
                // gets scrolled down. We always want to scroll down
                // when the user writes a message as opposed to when a
                // message is received.
                this.ui.set('scrolled', false);
            } else if (this.isHidden()) {
                this.incrementUnreadMsgsCounter(message);
            } else {
                this.sendMarkerForMessage(message);
            }
        }
    }

    /**
     * @param {Message} message
     */
    incrementUnreadMsgsCounter (message) {
        const settings = {
            'num_unread': this.get('num_unread') + 1
        };
        if (this.get('num_unread') === 0) {
            settings['first_unread_id'] = message.get('id');
        }
        this.save(settings);
    }

    clearUnreadMsgCounter () {
        if (this.get('num_unread') > 0) {
            this.sendMarkerForMessage(this.messages.last());
        }
        u.safeSave(this, {'num_unread': 0});
    }

    isScrolledUp () {
        return this.ui.get('scrolled');
    }
}

export default ChatBox;
