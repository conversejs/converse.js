/**
 * @typedef {import('../chat/model.js').default} ChatBox
 */
import { Strophe } from 'strophe.js';
import log from '@converse/log';
import _converse from '../../shared/_converse.js';
import { shouldClearCache } from '../../utils/session.js';
import * as constants from '../../shared/constants.js';

export async function onClearSession() {
    if (shouldClearCache(_converse)) {
        const { chatboxes } = _converse.state;
        await Promise.all(chatboxes.map(/** @param {ChatBox} c */ (c) => c.messages?.clearStore({ 'silent': true })));
        chatboxes.clearStore(
            { silent: true },
            /** @param {import('../../shared/chatbox').default} o */ (o) => o.get('type') !== constants.CONTROLBOX_TYPE
        );
    }
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
