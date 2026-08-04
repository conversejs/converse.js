/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * XEP-0147 (XMPP URI Scheme Query Components) dispatch: parses an `xmpp:` URI (via
 * the pure ./xmpp-uri.js helpers) and performs the corresponding in-app action.
 * State-mutating actions (roster / subscription changes) ask the user to confirm
 * first, per XEP-0147's Security Considerations.
 */
import { api, log } from '@converse/headless';
import { __ } from 'i18n';
import { parseXMPPURI, firstValue, HANDLED_ACTIONS } from './xmpp-uri.js';

/**
 * Show a confirmation dialog for a state-mutating action.
 * @param {string} message
 * @returns {Promise<boolean>}
 */
async function confirmAction(message) {
    const result = await api.confirm(__('Confirm'), message);
    return result !== false;
}

/**
 * Perform the in-app action for an `xmpp:` URI (XEP-0147). No-op (returns false)
 * for a URI whose action we don't handle. Errors are logged, never thrown.
 * @param {string} href
 * @returns {Promise<boolean>} Whether the URI was handled.
 */
export async function dispatchXMPPURI(href) {
    const { jid, action, params } = parseXMPPURI(href);
    if (!jid || !HANDLED_ACTIONS.includes(action)) return false;

    try {
        switch (action) {
            case 'message': {
                // XEP-0147 says a message action opens a compose interface, not send.
                // The `body` seeds the composer draft.
                const body = firstValue(params.body);
                if (body) {
                    // Seeding the draft would overwrite an unsent message the user is
                    // already composing to this JID; confirm before clobbering it.
                    const existing = await api.chats.get(jid);
                    const draft = existing?.get('draft');
                    if (
                        draft &&
                        draft !== body &&
                        !(await confirmAction(__('Replace your unsent message to %1$s?', jid)))
                    ) {
                        // Declined: open the chat but keep their draft, drop the body.
                        api.trigger('openConversation', { view: 'chat', jid });
                        break;
                    }
                }
                const attrs = body ? { draft: body } : {};
                api.trigger('openConversation', { view: 'chat', jid, attrs });
                break;
            }
            case 'join': {
                const attrs = {};
                const password = firstValue(params.password);
                const nick = firstValue(params.nick);
                if (password) attrs.password = password;
                if (nick) attrs.nick = nick;
                // Via `openConversation` too: the password/nick are seeded onto the
                // model and deliberately never enter the hash (XEP-0147 Security
                // Considerations).
                api.trigger('openConversation', { view: 'room', jid, attrs });
                break;
            }
            case 'roster': {
                // The plain roster action adds/edits a roster item without a presence
                // subscription (that's the separate `subscribe` action).
                if (!(await confirmAction(__('Add %1$s to your contacts?', jid)))) break;
                const groups = params.group ? [].concat(params.group) : [];
                await api.contacts.add({ jid, name: firstValue(params.name), groups }, true, false);
                break;
            }
            case 'subscribe': {
                if (!(await confirmAction(__('Send a contact request to %1$s?', jid)))) break;
                const message = firstValue(params.message) || '';
                const contact = await api.contacts.get(jid);
                if (contact) contact.subscribeToPresence(message);
                else await api.contacts.add({ jid }, true, true, message);
                break;
            }
            case 'remove': {
                if (!(await confirmAction(__('Remove %1$s from your contacts?', jid)))) break;
                await api.contacts.remove(jid, true);
                break;
            }
            case 'unsubscribe': {
                if (!(await confirmAction(__('Stop receiving presence updates from %1$s?', jid)))) break;
                await api.user.presence.send({ type: 'unsubscribe', to: jid });
                break;
            }
        }
    } catch (e) {
        log.error(e);
    }
    return true;
}
