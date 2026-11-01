/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Keyboard shortcuts which work anywhere in Converse. Apps add
 *  their own with `api.shortcuts.add`, and the help modal lists them all.
 */
import { api } from '@converse/headless';
import { __ } from 'i18n';

const IS_MAC = ['Mac', 'iPhone', 'iPad'].some((p) => navigator.platform.startsWith(p));

/** @type {Map<string, import('./types').KeyboardShortcut>} */
export const shortcuts = new Map();

/**
 * Whether Ctrl is held, or Cmd on macOS, without Alt.
 * @param {KeyboardEvent} ev
 */
export function isCtrlOrCmd(ev) {
    return (IS_MAC ? ev.metaKey && !ev.ctrlKey : ev.ctrlKey && !ev.metaKey) && !ev.altKey;
}

/**
 * @param {KeyboardEvent} ev
 */
export function isAltShift(ev) {
    return ev.altKey && ev.shiftKey && !ev.ctrlKey && !ev.metaKey;
}

export function addHelpShortcut() {
    api.shortcuts.add({
        id: 'help',
        group: __('General'),
        label: IS_MAC ? '⌘+/' : 'Ctrl+/',
        description: __('Show the keyboard shortcuts'),
        // Match on `key`, since some layouts need Shift to produce a slash
        matches: (ev) => isCtrlOrCmd(ev) && ev.key === '/',
        handler: () => api.modal.show('converse-keyboard-shortcuts-modal'),
    });
}

/**
 * @param {KeyboardEvent} ev
 */
export function onKeyDown(ev) {
    if (!api.settings.get('enable_keyboard_shortcuts')) return;

    const shortcut = [...shortcuts.values()].find((s) => s.matches(ev));
    if (shortcut) {
        ev.preventDefault();
        shortcut.handler();
    }
}
