/**
 * @typedef {import('../chat/model.js').default} ChatBox
 */
import { Strophe } from 'strophe.js';
import log from '@converse/log';
import _converse from '../../shared/_converse.js';
import { shouldClearCache } from '../../utils/session.js';
import * as constants from '../../shared/constants.js';

/**
 * @param {import('../../shared/types').ClearSessionReason} [reason]
 */
export async function onClearSession(reason) {
    const { chatboxes } = _converse.state;
    const isChat = /** @param {ChatBox} c */ (c) => c.get('type') !== constants.CONTROLBOX_TYPE;

    if (chatboxes.keepThrough(reason)) {
        // The rooms are kept as they are through an anonymous reconnection, to
        // be rejoined. Their cache is cleared once the session ends. The other
        // chats were had as the old account, which never comes back, so they
        // go, with what's stored of them.
        const dropped = chatboxes.filter((c) => isChat(c) && !c.survivesReset());
        await Promise.all(dropped.map((c) => c.clearCache()));
        dropped.forEach((c) => {
            c.destroy();
            c.unload();
        });
        return;
    }

    let cleared;
    if (shouldClearCache(_converse)) {
        await Promise.all(chatboxes.map(/** @param {ChatBox} c */ (c) => c.clearCache?.()));
        cleared = chatboxes.clearStore({ silent: true }, isChat);
    }

    // Whatever is left is kept in the cache, but not in memory, since the
    // session has ended.
    const chats = chatboxes.filter(isChat);
    chatboxes.remove(chats);
    chats.forEach((c) => c.unload());

    if (cleared) await cleared;

    // The store is let go of as well, until the next login. Saving what's
    // still in memory, such as the control box, would otherwise replace the
    // stored list of chats with one that leaves them out.
    chatboxes.trigger('unload');
    // Skeletor's `storage` setter only takes a store.
    chatboxes._storage = undefined;
}

/**
 * @param {string} jid
 * @param {Record<string, any>} attrs
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
