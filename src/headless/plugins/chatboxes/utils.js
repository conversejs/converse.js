/**
 * @typedef {import('../chat/model.js').default} ChatBox
 */
import _converse from '../../shared/_converse.js';
import log from "@converse/log";
import { Strophe } from 'strophe.js';


/**
 * @param {string} jid
 * @param {object} attrs
 * @param {new (attrs: object, options: object) => ChatBox} Model
 */
export async function createChatBox (jid, attrs, Model) {
    jid = Strophe.getBareJidFromJid(jid.toLowerCase());
    Object.assign(attrs, {'jid': jid, 'id': jid});
    let chatbox;
    try {
        chatbox = new Model(attrs, {'collection': _converse.state.chatboxes});
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
