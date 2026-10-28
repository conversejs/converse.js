/**
 * @module accessibility/keyboard-shortcuts
 * @description Keyboard shortcuts for moving around Converse, following the
 *  conventions of other chat clients.
 */
import { api, constants } from '@converse/headless';
import { __ } from 'i18n';
import { announce, getActiveChat, getChats, hasUnreadMessages } from './utils.js';

const { CHATROOMS_TYPE } = constants;

const IS_MAC = ['Mac', 'iPhone', 'iPad'].some((p) => navigator.platform.startsWith(p));

/**
 * @returns {import('./types').KeyboardShortcut[]}
 */
export function getShortcuts() {
    return [
        {
            label: IS_MAC ? '⌘+/' : 'Ctrl+/',
            description: __('Show the keyboard shortcuts'),
            // Match on `key`, since some layouts need Shift to produce a slash
            matches: (ev) => isCtrlOrCmd(ev) && ev.key === '/',
            handler: () => api.modal.show('converse-keyboard-shortcuts-modal'),
        },
        {
            label: 'Alt+Shift+↓',
            description: __('Open the next chat with unread messages'),
            matches: (ev) => isAltShift(ev) && ev.key === 'ArrowDown',
            handler: () => openUnreadChat(1),
        },
        {
            label: 'Alt+Shift+↑',
            description: __('Open the previous chat with unread messages'),
            matches: (ev) => isAltShift(ev) && ev.key === 'ArrowUp',
            handler: () => openUnreadChat(-1),
        },
    ];
}

/**
 * Whether Ctrl is held, or Cmd on macOS, without Alt.
 * @param {KeyboardEvent} ev
 */
function isCtrlOrCmd(ev) {
    return (IS_MAC ? ev.metaKey && !ev.ctrlKey : ev.ctrlKey && !ev.metaKey) && !ev.altKey;
}

/**
 * @param {KeyboardEvent} ev
 */
function isAltShift(ev) {
    return ev.altKey && ev.shiftKey && !ev.ctrlKey && !ev.metaKey;
}

/**
 * @param {KeyboardEvent} ev
 */
export function onKeyDown(ev) {
    if (!api.settings.get('enable_keyboard_shortcuts')) return;

    const shortcut = getShortcuts().find((s) => s.matches(ev));
    if (shortcut) {
        ev.preventDefault();
        shortcut.handler();
    }
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
