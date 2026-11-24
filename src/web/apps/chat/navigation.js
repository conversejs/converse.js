/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * The user-initiated "open a conversation" entry point for the Chat app. It is
 * driven by the `openConversation` event (see ./index.js), which the app's building
 * blocks (roster, roomslist, occupant lists, bookmarks, join modals) trigger rather
 * than importing this module directly, so the dependency arrow stays app -> plugin.
 *
 * When URL routing is on and the view mode is fullscreen, it pushes a history entry
 * so browser Back/Forward walks the stack of opened conversations, and lets the Chat
 * app's router open the box from the resulting `hashchange`. Otherwise (routing off,
 * or overlayed mode where several boxes are open at once) it opens the box directly,
 * exactly as before.
 */
import { api } from '@converse/headless';
import { isURLRoutingEnabled } from 'plugins/rootview/routing.js';
import { buildChatRoute } from './routing.js';

/**
 * Open a 1:1 chat or MUC as a user-initiated navigation.
 *
 * Any `attrs` (e.g. a MUC `nick`/`password`) are applied to the model first,
 * without foregrounding, so the subsequent route-driven open honours them; they
 * are deliberately never encoded in the hash (a password in the address
 * bar/history would leak, per XEP-0147 Security Considerations).
 *
 * @param {'chat'|'room'} view
 * @param {string} jid
 * @param {object} [attrs={}]
 * @returns {Promise<void>}
 */
export async function openConversationRouted(view, jid, attrs = {}) {
    if (isURLRoutingEnabled() && api.settings.get('view_mode') === 'fullscreen') {
        const hash = buildChatRoute({ view, jid });
        if (hash) {
            if (Object.keys(attrs).length) {
                // Seed nick/password/etc. onto the model without showing it.
                await (view === 'room' ? api.rooms.get(jid, attrs, true) : api.chats.get(jid, attrs, true));
            }
            if (hash === location.hash) {
                // Already the current route: ensure the box is actually foregrounded.
                await (view === 'room' ? api.rooms.open(jid, {}, true) : api.chats.open(jid, {}, true));
            } else {
                // Pushes a history entry and fires `hashchange` -> the router opens it.
                location.hash = hash;
            }
            return;
        }
    }
    await (view === 'room' ? api.rooms.open(jid, attrs, true) : api.chats.open(jid, attrs, true));
}
