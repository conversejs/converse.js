import { _converse, api, converse, log } from '@converse/headless';
import { isArchived, isHeadline, isServerMessage, } from '@converse/headless/shared/parsers';
import { parseMessage } from './parsers.js';
import { shouldClearCache } from '@converse/headless/utils/core.js';

const { Strophe, u } = converse.env;

export function openChat (jid) {
    if (!u.isValidJID(jid)) {
        return log.warn(`Invalid JID "${jid}" provided in URL fragment`);
    }
    api.chats.open(jid);
}

export async function onClearSession () {
    if (shouldClearCache()) {
        await Promise.all(
            _converse.chatboxes.map(c => c.messages && c.messages.clearStore({ 'silent': true }))
        );
        const filter = o => o.get('type') !== _converse.CONTROLBOX_TYPE;
        _converse.chatboxes.clearStore({ 'silent': true }, filter);
    }
}

async function handleErrorMessage (stanza) {
    const from_jid = Strophe.getBareJidFromJid(stanza.getAttribute('from'));
    if (u.isSameBareJID(from_jid, _converse.bare_jid)) {
        return;
    }
    const chatbox = await api.chatboxes.get(from_jid);
    if (chatbox?.get('type') === _converse.PRIVATE_CHAT_TYPE) {
        chatbox?.handleErrorMessageStanza(stanza);
    }
}

export function autoJoinChats () {
    // Automatically join private chats, based on the
    // "auto_join_private_chats" configuration setting.
    api.settings.get('auto_join_private_chats').forEach(jid => {
        if (_converse.chatboxes.where({ 'jid': jid }).length) {
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
    _converse.connection.addHandler(
        stanza => {
            if (
                ['groupchat', 'error'].includes(stanza.getAttribute('type')) ||
                isHeadline(stanza) ||
                isServerMessage(stanza) ||
                isArchived(stanza)
            ) {
                return true;
            }
            return _converse.handleMessageStanza(stanza) || true;
        },
        null,
        'message',
    );

    _converse.connection.addHandler(
        stanza => handleErrorMessage(stanza) || true,
        null,
        'message',
        'error'
    );
}


/**
 * Handler method for all incoming single-user chat "message" stanzas.
 * @param { MessageAttributes } attrs - The message attributes
 */
export async function handleMessageStanza (stanza) {
    stanza = stanza.tree?.() ?? stanza;

    if (isServerMessage(stanza)) {
        // Prosody sends headline messages with type `chat`, so we need to filter them out here.
        const from = stanza.getAttribute('from');
        return log.info(`handleMessageStanza: Ignoring incoming server message from JID: ${from}`);
    }
    let attrs;
    try {
        attrs = await parseMessage(stanza);
    } catch (e) {
        return log.error(e);
    }
    if (u.isErrorObject(attrs)) {
        attrs.stanza && log.error(attrs.stanza);
        return log.error(attrs.message);
    }
    // XXX: Need to take XEP-428 <fallback> into consideration
    const has_body = !!(attrs.body || attrs.plaintext)
    const chatbox = await api.chats.get(attrs.contact_jid, { 'nickname': attrs.nick }, has_body);
    await chatbox?.queueMessage(attrs);
    /**
     * @typedef { Object } MessageData
     * An object containing the original message stanza, as well as the
     * parsed attributes.
     * @property { Element } stanza
     * @property { MessageAttributes } stanza
     * @property { ChatBox } chatbox
     */
    const data = { stanza, attrs, chatbox };
    /**
     * Triggered when a message stanza is been received and processed.
     * @event _converse#message
     * @type { object }
     * @property { module:converse-chat~MessageData } data
     */
    api.trigger('message', data);
}

/**
 * Ask the XMPP server to enable Message Carbons
 * See [XEP-0280](https://xmpp.org/extensions/xep-0280.html#enabling)
 * @param { Boolean } reconnecting
 */
export async function enableCarbons () {
    const domain = Strophe.getDomainFromJid(_converse.bare_jid);
    const supported = await api.disco.supports(Strophe.NS.CARBONS, domain);

    if (!supported) {
        log.warn("Not enabling carbons because it's not supported!");
        return;
    }

    const iq = new Strophe.Builder('iq', {
        'from': _converse.connection.jid,
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
