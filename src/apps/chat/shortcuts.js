/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Keyboard shortcuts for moving between chats with unread messages
 */
import { _converse, api, constants } from '@converse/headless';
import { __ } from 'i18n';
import { isAltShift } from 'plugins/rootview/shortcuts.js';
import { announce } from 'utils/accessibility.js';

const { CHATROOMS_TYPE, PRIVATE_CHAT_TYPE } = constants;

export function addShortcuts() {
    api.shortcuts.add({
        id: 'chat-next-unread',
        group: __('Chat'),
        label: 'Alt+Shift+↓',
        description: __('Open the next chat with unread messages'),
        matches: (ev) => isAltShift(ev) && ev.key === 'ArrowDown',
        handler: () => openUnreadChat(1),
    });
    api.shortcuts.add({
        id: 'chat-previous-unread',
        group: __('Chat'),
        label: 'Alt+Shift+↑',
        description: __('Open the previous chat with unread messages'),
        matches: (ev) => isAltShift(ev) && ev.key === 'ArrowUp',
        handler: () => openUnreadChat(-1),
    });
}

/**
 * @returns {Array<import('@converse/headless').ChatBox|import('@converse/headless').MUC>}
 */
function getChats() {
    return _converse.state.chatboxes?.filter((m) => [CHATROOMS_TYPE, PRIVATE_CHAT_TYPE].includes(m.get('type'))) ?? [];
}

/**
 * Returns the chat the user is in: the one that has focus, or else the most
 * recently opened one which is visible. In the "overlayed" view mode several
 * chats can be visible at once.
 * @returns {import('@converse/headless').ChatBox|import('@converse/headless').MUC|undefined}
 */
function getActiveChat() {
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
function hasUnreadMessages(chatbox) {
    return chatbox.get('num_unread') > 0 || chatbox.get('num_unread_general') > 0;
}

/**
 * Opens the next (or previous) chat with unread messages, counting from the
 * active chat, so that repeated presses cycle through them.
 * @param {1|-1} direction
 */
function openUnreadChat(direction) {
    const active = getActiveChat();
    const chats = direction > 0 ? getChats() : getChats().reverse();
    const start = chats.indexOf(active) + 1;
    const next = [...chats.slice(start), ...chats.slice(0, start)].find((m) => hasUnreadMessages(m) && m !== active);
    if (next) {
        const view = next.get('type') === CHATROOMS_TYPE ? 'room' : 'chat';
        api.trigger('openConversation', { view, jid: next.get('jid') });
    } else {
        announce(__('No chats with unread messages'));
    }
}
