/**
 * @module:headless-plugins-chat-utils
 * @typedef {import('./model.js').default} ChatBox
 * @typedef {import('./types.ts').MessageAttributes} MessageAttributes
 * @typedef {import('../../shared/errors').StanzaParseError} StanzaParseError
 * @typedef {import('strophe.js').Builder} Builder
 */
import sizzle from "sizzle";
import { Model } from '@converse/skeletor';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from "../../shared/api/public.js";
import log from '../../log.js';
import { isArchived, isHeadline, isMUCPrivateMessage, isServerMessage, } from '../../shared/parsers';
import { parseMessage } from './parsers.js';
import { shouldClearCache } from '../../utils/session.js';
import { CONTROLBOX_TYPE, PRIVATE_CHAT_TYPE } from "../../shared/constants.js";

const { Strophe, u } = converse.env;

export function routeToChat (event) {
    if (!location.hash.startsWith('#converse/chat?jid=')) {
        return;
    }
    event?.preventDefault();
    const jid = location.hash.split('=').pop();
    if (!u.isValidJID(jid)) {
        return log.warn(`Invalid JID "${jid}" provided in URL fragment`);
    }
    api.chats.open(jid);
}

export async function onClearSession () {
    if (shouldClearCache(_converse)) {
        const { chatboxes } = _converse.state;
        await Promise.all(
            chatboxes.map(/** @param {ChatBox} c */(c) => c.messages?.clearStore({ 'silent': true }))
        );
        chatboxes.clearStore(
            { 'silent': true },
            /** @param {Model} o */(o) => o.get('type') !== CONTROLBOX_TYPE);
    }
}

/**
 * Given a stanza, determine whether it's a new
 * message, i.e. not a MAM archived one.
 * @param {Element|Model|object} message
 */
export function isNewMessage (message) {
    if (message instanceof Element) {
        return !(
            sizzle(`result[xmlns="${Strophe.NS.MAM}"]`, message).length &&
            sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, message).length
        );
    } else if (message instanceof Model) {
        message = message.attributes;
    }
    return !(message['is_delayed'] && message['is_archived']);
}

/**
 * @param {Element} stanza
 */
async function handleErrorMessage (stanza) {
    const from_jid = Strophe.getBareJidFromJid(stanza.getAttribute('from'));
    const bare_jid = _converse.session.get('bare_jid');
    if (u.isSameBareJID(from_jid, bare_jid)) {
        return;
    }
    const chatbox = await api.chatboxes.get(from_jid);
    if (chatbox?.get('type') === PRIVATE_CHAT_TYPE) {
        chatbox?.handleErrorMessageStanza(stanza);
    }
}

export function autoJoinChats () {
    // Automatically join private chats, based on the
    // "auto_join_private_chats" configuration setting.
    api.settings.get('auto_join_private_chats').forEach(/** @param {string} jid */(jid) => {
        if (_converse.state.chatboxes.where({ 'jid': jid }).length) {
            return;
        }
        if (typeof jid === 'string') {
            api.chats.open(jid);
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
    api.trigger('privateChatsAutoJoined');
}

export function registerMessageHandlers () {
    api.connection.get().addHandler(
        /** @param {Element} stanza */
        (stanza) => {
            if (
                ['groupchat', 'error'].includes(stanza.getAttribute('type')) ||
                isHeadline(stanza) ||
                isServerMessage(stanza) ||
                isArchived(stanza)
            ) {
                return true;
            }
            return _converse.exports.handleMessageStanza(stanza) || true;
        },
        null,
        'message',
    );

    api.connection.get().addHandler(
        /** @param {Element} stanza */
        (stanza) => {
            handleErrorMessage(stanza);
            return true;
        },
        null,
        'message',
        'error'
    );
}


/**
 * Handler method for all incoming single-user chat "message" stanzas.
 * @param {Element|Builder} stanza
 */
export async function handleMessageStanza (stanza) {
    stanza = (stanza instanceof Element) ? stanza : stanza.tree();

    if (isServerMessage(stanza)) {
        // Prosody sends headline messages with type `chat`, so we need to filter them out here.
        const from = stanza.getAttribute('from');
        return log.info(`handleMessageStanza: Ignoring incoming server message from JID: ${from}`);
    }
    if (await isMUCPrivateMessage(stanza)) {
        return true;
    }

    let attrs;
    try {
        attrs = await parseMessage(stanza);
    } catch (e) {
        return log.error(e);
    }
    if (u.isErrorObject(attrs)) {
        const { stanza, message } = /** @type {StanzaParseError} */(attrs);
        if (stanza) log.error(stanza);
        return log.error(message);
    }

    const { body, plaintext, contact_jid, nick } = /** @type {MessageAttributes} */(attrs);

    // XXX: Need to take XEP-428 <fallback> into consideration
    const has_body = !!(body || plaintext);
    const chatbox = await api.chats.get(contact_jid, { nickname: nick }, has_body);
    await chatbox?.queueMessage(attrs);
    /**
     * @typedef {Object} MessageData
     * An object containing the original message stanza, as well as the
     * parsed attributes.
     * @property {Element} stanza
     * @property {MessageAttributes} stanza
     * @property {ChatBox} chatbox
     */
    const data = { stanza, attrs, chatbox };
    /**
     * Triggered when a message stanza is been received and processed.
     * @event _converse#message
     * @type {MessageData} data
     */
    api.trigger('message', data);
}

/**
 * Ask the XMPP server to enable Message Carbons
 * See [XEP-0280](https://xmpp.org/extensions/xep-0280.html#enabling)
 */
export async function enableCarbons () {
    const bare_jid = _converse.session.get('bare_jid');
    const domain = Strophe.getDomainFromJid(bare_jid);
    const supported = await api.disco.supports(Strophe.NS.CARBONS, domain);

    if (!supported) {
        log.warn("Not enabling carbons because it's not supported!");
        return;
    }

    const iq = new Strophe.Builder('iq', {
        'from': api.connection.get().jid,
        'type': 'set'
    }).c('enable', {xmlns: Strophe.NS.CARBONS});

    const result = await api.sendIQ(iq, null, false);
    if (result === null) {
        log.warn(`A timeout occurred while trying to enable carbons`);
    } else if (u.isErrorStanza(result)) {
        log.warn('An error occurred while trying to enable message carbons.');
        log.error(result);
    } else {
        log.debug('Message carbons have been enabled.');
    }
}
