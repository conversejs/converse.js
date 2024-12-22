import { Model } from '@converse/skeletor';
import log from '../../log';
import api from '../../shared/api/index.js';
import _converse from '../../shared/_converse.js';
import ColorAwareModel from '../../shared/color.js';
import ModelWithMessages from '../../shared/model-with-messages.js';
import { AFFILIATIONS, ROLES } from './constants.js';
import MUCMessages from './messages.js';
import u from '../../utils/index.js';
import { shouldCreateGroupchatMessage } from './utils';
import { sendChatState } from '../../shared/actions';

/**
 * Represents a participant in a MUC
 */
class MUCOccupant extends ModelWithMessages(ColorAwareModel(Model)) {
    /**
     * @typedef {import('../chat/types').MessageAttributes} MessageAttributes
     * @typedef {import('../../shared/errors').StanzaParseError} StanzaParseError
     */

    constructor(attributes, options) {
        super(attributes, options);
        this.vcard = null;
    }

    async initialize() {
        await super.initialize();
        await this.fetchMessages();
        this.on('change:nick', () => this.setColor());
        this.on('change:jid', () => this.setColor());
        this.on('change:chat_state', () => sendChatState(this.get('jid'), this.get('chat_state')));
    }

    defaults() {
        return {
            hats: [],
            show: 'offline',
            states: [],
            hidden: true,
            num_unread: 0,
        };
    }

    save(key, val, options) {
        let attrs;
        if (key == null) {
            // eslint-disable-line no-eq-null
            return super.save(key, val, options);
        } else if (typeof key === 'object') {
            attrs = key;
            options = val;
        } else {
            (attrs = {})[key] = val;
        }

        if (attrs.occupant_id) {
            attrs.id = attrs.occupant_id;
        }
        return super.save(attrs, options);
    }

    getMessagesCollection() {
        return new MUCMessages();
    }

    /**
     * Handler for all MUC private messages sent to this occupant.
     * This method houldn't be called directly, instead {@link MUC#queueMessage} should be called.
     * @param {MessageAttributes|StanzaParseError} attrs_or_error
     */
    async onMessage(attrs_or_error) {
        if (u.isErrorObject(attrs_or_error)) {
            const { stanza, message } = /** @type {StanzaParseError} */(attrs_or_error);
            if (stanza) log.error(stanza);
            return log.error(message);
        }

        const attrs = /** @type {MessageAttributes} */(attrs_or_error);
        if (attrs.type === 'error' && !(await this.shouldShowErrorMessage(attrs))) {
            return;
        }

        const message = this.getDuplicateMessage(attrs);
        if (message) {
            this.updateMessage(message, attrs);
            return;
        } else if (await this.handleRetraction(attrs)) {
            return;
        }

        this.setEditable(attrs, attrs.time);

        if (shouldCreateGroupchatMessage(attrs)) {
            const msg = (await this.handleCorrection(attrs)) || (await this.createMessage(attrs));
            this.handleUnreadMessage(msg);
        }
    }

    /**
     * @returns {string}
     */
    getDisplayName() {
        return this.get('nick') || this.get('jid') || '';
    }

    /**
     * Return roles which may be assigned to this occupant
     * @returns {typeof ROLES} - An array of assignable roles
     */
    getAssignableRoles() {
        let disabled = api.settings.get('modtools_disable_assign');
        if (!Array.isArray(disabled)) {
            disabled = disabled ? ROLES : [];
        }
        if (this.get('role') === 'moderator') {
            return ROLES.filter((r) => !disabled.includes(r));
        } else {
            return [];
        }
    }

    /**
     * Return affiliations which may be assigned by this occupant
     * @returns {typeof AFFILIATIONS} An array of assignable affiliations
     */
    getAssignableAffiliations() {
        let disabled = api.settings.get('modtools_disable_assign');
        if (!Array.isArray(disabled)) {
            disabled = disabled ? AFFILIATIONS : [];
        }
        if (this.get('affiliation') === 'owner') {
            return AFFILIATIONS.filter((a) => !disabled.includes(a));
        } else if (this.get('affiliation') === 'admin') {
            return AFFILIATIONS.filter((a) => !['owner', 'admin', ...disabled].includes(a));
        } else {
            return [];
        }
    }

    isMember() {
        return ['admin', 'owner', 'member'].includes(this.get('affiliation'));
    }

    isModerator() {
        return ['admin', 'owner'].includes(this.get('affiliation')) || this.get('role') === 'moderator';
    }

    isSelf() {
        return this.get('states').includes('110');
    }

    /**
     * @param {MessageAttributes} [attrs]
     * @return {Promise<MessageAttributes>}
     */
    async getOutgoingMessageAttributes (attrs) {
        const origin_id = u.getUniqueId();
        const text = attrs?.body;
        const body = text ? u.shortnamesToUnicode(text) : undefined;
        const muc = this.collection.chatroom;
        const own_occupant = muc.getOwnOccupant();
        attrs = Object.assign({}, attrs, {
            body,
            from: own_occupant.get('from'),
            fullname: _converse.state.xmppstatus.get('fullname'),
            id: origin_id,
            jid: this.get('jid'),
            message: body,
            msgid: origin_id,
            nick: own_occupant.get('nickname'),
            origin_id,
            sender: 'me',
            time: (new Date()).toISOString(),
            to: this.get('from') ?? `${muc.get('jid')}/${this.get('nick')}`,
            type: 'chat',
        }, u.getMediaURLsMetadata(text));

        /**
         * *Hook* which allows plugins to update the attributes of an outgoing message.
         * These attributes get set on the {@link Message} and persisted.
         * @event _converse#getOutgoingMessageAttributes
         * @param {MUCOccupant} chat
         *      The chat from which this message will be sent.
         * @param {MessageAttributes} attrs
         *      The message attributes, from which the stanza will be created.
         */
        attrs = await api.hook('getOutgoingMessageAttributes', this, attrs);
        return attrs;
    }
}

export default MUCOccupant;
