import { _converse, api, constants } from '@converse/headless';

const { CHATROOMS_TYPE, PRIVATE_CHAT_TYPE } = constants;

const LIVE_REGION_ID = 'converse-live-region';

/**
 * @returns {HTMLElement|null}
 */
function getLiveRegion() {
    const root = api.settings.get('root')?.querySelector('converse-root');
    if (!root) return null;

    let region = root.querySelector(`#${LIVE_REGION_ID}`);
    if (!region) {
        region = document.createElement('div');
        region.id = LIVE_REGION_ID;
        region.className = 'visually-hidden';
        region.setAttribute('role', 'status');
        region.setAttribute('aria-live', 'polite');
        region.setAttribute('aria-atomic', 'true');
        root.appendChild(region);
    }
    return /** @type {HTMLElement} */ (region);
}

export function removeLiveRegion() {
    api.settings.get('root')?.querySelector(`#${LIVE_REGION_ID}`)?.remove();
}

/**
 * Reads out the passed in text to screen reader users.
 * @param {string} text
 */
export function announce(text) {
    const region = getLiveRegion();
    if (!region) return;

    // Clear first, so that repeating the same text is announced again
    region.textContent = '';
    setTimeout(() => (region.textContent = text), 100);
}

/**
 * @returns {Array<import('@converse/headless').ChatBox|import('@converse/headless').MUC>}
 */
export function getChats() {
    return _converse.state.chatboxes?.filter((m) => [CHATROOMS_TYPE, PRIVATE_CHAT_TYPE].includes(m.get('type'))) ?? [];
}

/**
 * Returns the chat the user is in: the one that has focus, or else the most
 * recently opened one which is visible. In the "overlayed" view mode several
 * chats can be visible at once.
 * @returns {import('@converse/headless').ChatBox|import('@converse/headless').MUC|undefined}
 */
export function getActiveChat() {
    const visible = getChats().filter((m) => !m.get('hidden'));
    const focused = visible.find((m) =>
        _converse.state.chatboxviews?.get(m.get('jid'))?.contains(document.activeElement),
    );
    // Chatboxes are sorted by the time they were opened
    return focused ?? visible.at(-1);
}

/**
 * @param {import('@converse/headless').ChatBox|import('@converse/headless').MUC} chatbox
 * @returns {boolean}
 */
export function hasUnreadMessages(chatbox) {
    return chatbox.get('num_unread') > 0 || chatbox.get('num_unread_general') > 0;
}
