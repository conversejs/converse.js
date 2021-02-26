import { _converse, converse } from "../../core.js";
import log from "../../log";

const { Strophe } = converse.env;


export async function createChatBox (jid, attrs, Model) {
    jid = Strophe.getBareJidFromJid(jid.toLowerCase());
    Object.assign(attrs, {'jid': jid, 'id': jid});
    let chatbox;
    try {
        chatbox = new Model(attrs, {'collection': _converse.chatboxes});
    } catch (e) {
        log.error(e);
        return null;
    }
    await chatbox.initialized;
    if (!chatbox.isValid()) {
        chatbox.destroy();
        return null;
    }
    _converse.chatboxes.add(chatbox);
    return chatbox;
}
