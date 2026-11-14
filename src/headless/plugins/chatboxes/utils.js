/**
 * @typedef {import('../chat/model.js').default} ChatBox
 */
import { Strophe } from 'strophe.js';
import log from '@converse/log';
import _converse from '../../shared/_converse.js';
import { shouldClearCache } from '../../utils/session.js';
import * as constants from '../../shared/constants.js';

export async function onClearSession() {
    const { chatboxes } = _converse.state;
    if (shouldClearCache(_converse)) {
        await Promise.all(chatboxes.map(/** @param {ChatBox} c */ (c) => c.messages?.clearStore({ 'silent': true })));
        chatboxes.clearStore(
            { silent: true },
            /** @param {import('../../shared/chatbox').default} o */ (o) => o.get('type') !== constants.CONTROLBOX_TYPE,
        );
    }
    // An anonymous reconnection also clears the session, but keeps its chats
    // and rooms, to rejoin them.
    if (_converse.api.connection.get()?.reconnecting) return;

    // Whatever is left is kept in the cache, but not in memory, since the
    // session has ended.
    const chats = chatboxes.filter((c) => c.get('type') !== constants.CONTROLBOX_TYPE);
    chatboxes.remove(chats);
    chats.forEach((c) => c.unload());
}

/**
 * @param {string} jid
 * @param {object} attrs
 * @param {new (attrs: object, options: object) => ChatBox} Model
 */
export async function createChatBox(jid, attrs, Model) {
    jid = Strophe.getBareJidFromJid(jid.toLowerCase());
    Object.assign(attrs, { 'jid': jid, 'id': jid });
    let chatbox;
    try {
        chatbox = new Model(attrs, { 'collection': _converse.state.chatboxes });
    } catch (e) {
        log.error(e);
        return null;
    }
    await chatbox.initialized;
    if (!chatbox.isValid()) {
        chatbox.destroy();
        return null;
    }
    _converse.state.chatboxes.add(chatbox);
    return chatbox;
}
