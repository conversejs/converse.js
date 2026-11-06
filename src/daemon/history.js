/**
 * What the daemon counts as a conversation's history: which of the models
 * headless holds are messages, and whether the server's archive (XEP-0313 MAM)
 * has any with someone. Headless pages through the history itself
 * (`api.archive.page`).
 * @module @converse/daemon/history
 */
import { api, converse, MAMPlaceholderMessage } from '@converse/headless';
import { ownJID } from './session.js';

const { Strophe } = converse.env;

/**
 * Whether the server's archive holds any message exchanged with `jid`, so
 * that reading the history of someone who isn't a contact needn't open a
 * conversation with them to find out.
 * @param {string} jid
 */
export async function hasArchivedMessages(jid) {
    const own_jid = ownJID();
    if (!api.connection.connected() || !(await api.disco.supports(Strophe.NS.MAM, own_jid))) {
        return false;
    }
    try {
        const result = await api.archive.query({ mam: { with: jid }, rsm: { max: 1, before: '' } });
        return result.messages.length > 0;
    } catch {
        return false;
    }
}

/**
 * @param {import('@converse/headless').BaseMessage} model
 */
export function isMessage(model) {
    if (model instanceof MAMPlaceholderMessage) return false;
    // A retraction or reaction whose target hasn't arrived is held until it does. It's not a message.
    if (model.get('dangling_retraction') || model.get('dangling_reaction')) return false;
    // A message that couldn't be decrypted has no body, but the user still needs to see that it arrived.
    return !!model.get('body') || isUndecryptable(model);
}

/**
 * Whether a message arrived OMEMO-encrypted and couldn't be decrypted.
 * @param {import('@converse/headless').BaseMessage} message
 */
export function isUndecryptable(message) {
    return !!message.get('is_error') && message.get('error_type') === 'Decryption';
}
