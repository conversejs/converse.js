/**
 * @module accessibility/keyboard-shortcuts
 * @description Alt+Shift keyboard shortcuts for moving around Converse.
 */
import { _converse, api, constants } from '@converse/headless';
import { __ } from 'i18n';
import { announce, getActiveChat, getChats, hasUnreadMessages } from './utils.js';

const { CHATROOMS_TYPE } = constants;

/**
 * @returns {import('./types').KeyboardShortcut[]}
 */
export function getShortcuts() {
    return [
        {
            code: 'KeyH',
            label: 'Alt+Shift+H',
            description: __('Show the keyboard shortcuts'),
            handler: () => api.modal.show('converse-keyboard-shortcuts-modal'),
        },
        {
            code: 'KeyC',
            label: 'Alt+Shift+C',
            description: __('Focus the message composer of the open chat'),
            handler: focusComposer,
        },
        {
            code: 'KeyN',
            label: 'Alt+Shift+N',
            description: __('Open the next chat with unread messages'),
            handler: openNextUnreadChat,
        },
    ];
}

/**
 * @param {KeyboardEvent} ev
 */
export function onKeyDown(ev) {
    if (!api.settings.get('enable_keyboard_shortcuts')) return;
    if (!ev.altKey || !ev.shiftKey || ev.ctrlKey || ev.metaKey) return;

    // Match on `code`, since on macOS Option changes the produced `key`
    const shortcut = getShortcuts().find((s) => s.code === ev.code);
    if (shortcut) {
        ev.preventDefault();
        shortcut.handler();
    }
}

function focusComposer() {
    const chatbox = getActiveChat();
    const view = chatbox && _converse.state.chatboxviews?.get(chatbox.get('jid'));
    if (view) {
        view.focus();
    } else {
        announce(__('No chat is open'));
    }
}

function openNextUnreadChat() {
    const chats = getChats();
    const active = getActiveChat();
    // Start searching after the active chat, so that repeated presses cycle
    const start = chats.indexOf(active) + 1;
    const next = [...chats.slice(start), ...chats.slice(0, start)].find((m) => hasUnreadMessages(m) && m !== active);
    if (next) {
        const view = next.get('type') === CHATROOMS_TYPE ? 'room' : 'chat';
        api.trigger('openConversation', { view, jid: next.get('jid') });
    } else {
        announce(__('No chats with unread messages'));
    }
}
