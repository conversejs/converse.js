import { getOpenPromise } from '@converse/openpromise';
import { PRIVATE_CHAT_TYPE, INACTIVE } from '../../shared/constants.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from '../../log.js';
import { isUniView } from '../../utils/session.js';
import { sendChatState, sendMarker } from '../../shared/actions.js';
import ModelWithMessages from "../../shared/model-with-messages.js";
import ModelWithContact from '../../shared/model-with-contact.js';
import ColorAwareModel from '../../shared/color.js';
import ChatBoxBase from '../../shared/chatbox.js';

const { Strophe, u } = converse.env;


/**
 * Represents a one-on-one chat conversation.
 */
class ChatBox extends ModelWithMessages(ModelWithContact(ColorAwareModel(ChatBoxBase))) {
    /**
     * @typedef {import('./message.js').default} Message
     * @typedef {import('../muc/muc.js').default} MUC
     * @typedef {import('./parsers').MessageAttributes} MessageAttributes
     * @typedef {import('../../shared/parsers').StanzaParseError} StanzaParseError
     */

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
        const { presences } = _converse.state;
        this.presence = presences.get(jid) || presences.create({ jid });
        await this.setModelContact(jid);
        this.presence.on('change:show', (item) => this.onPresenceChanged(item));

        this.on('change:chat_state', () => sendChatState(this.get('jid'), this.get('chat_state')));
        this.on('change:hidden', () => (this.get('hidden') && this.setChatState(INACTIVE)));

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


    /**
     * @param {Promise<MessageAttributes|StanzaParseError>} attrs_promise
     */
    async onMessage (attrs_promise) {
        const attrs_or_error = await attrs_promise;
        if (u.isErrorObject(attrs_or_error)) {
            const { stanza, message } = /** @type {StanzaParseError} */(attrs_or_error);
            if (stanza) log.error(stanza);
            return log.error(message);
        }

        const attrs = /** @type {MessageAttributes} */(attrs_or_error);
        const message = this.getDuplicateMessage(attrs);
        if (message) {
            this.updateMessage(message, attrs);
        } else if (
                !this.handleReceipt(attrs) &&
                !this.handleChatMarker(attrs) && !(await this.handleRetraction(attrs))
        ) {
            this.setEditable(attrs, attrs.time);

            if (attrs['chat_state'] && attrs.sender === 'them') {
                this.notifications.set('chat_state', attrs.chat_state);
            }
            if (u.shouldCreateMessage(attrs)) {
                const msg = await this.handleCorrection(attrs) || await this.createMessage(attrs);
                this.notifications.set({'chat_state': null});
                this.handleUnreadMessage(msg);
            }
        }
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

    async close () {
        if (api.connection.connected()) {
            // Immediately sending the chat state, because the
            // model is going to be destroyed afterwards.
            this.setChatState(INACTIVE);
            sendChatState(this.get('jid'), this.get('chat_state'));
        }
        await super.close();
    }

    /**
     * @returns {string}
     */
    getDisplayName () {
        if (this.contact) {
            return this.contact.getDisplayName();
        } else if (this.vcard) {
            return this.vcard.getDisplayName();
        } else {
            return this.get('jid');
        }
    }

    /**
     * @param {string} jid1
     * @param {string} jid2
     */
    isSameUser (jid1, jid2) {
        return u.isSameBareJID(jid1, jid2);
    }

    /**
     * @param {MessageAttributes} attrs
     */
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

    /**
     * @param {MessageAttributes} [attrs]
     * @return {Promise<MessageAttributes>}
     */
    async getOutgoingMessageAttributes (attrs) {
        const is_spoiler = !!this.get('composing_spoiler');
        const origin_id = u.getUniqueId();
        const text = attrs?.body;
        const body = text ? u.shortnamesToUnicode(text) : undefined;
        attrs = Object.assign({}, attrs, {
            body,
            from: _converse.session.get('jid'),
            fullname: _converse.state.xmppstatus.get('fullname'),
            id: origin_id,
            is_spoiler,
            jid: this.get('jid'),
            message: body,
            msgid: origin_id,
            nick: this.get('nickname'),
            origin_id,
            sender: 'me',
            time: (new Date()).toISOString(),
            type: this.get('message_type'),
        }, u.getMediaURLsMetadata(text));

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

    canPostMessages () {
        return true;
    }
}

export default ChatBox;
