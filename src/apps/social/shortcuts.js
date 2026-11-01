/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Keyboard shortcuts for the lists of posts
 */
import { api } from '@converse/headless';
import { __ } from 'i18n';
import { isEditableTarget } from 'utils/html.js';
import { mounted_lists } from './windowed.js';

/**
 * Home and End jump to the top or bottom of the whole list. Skipped while a
 * text field (the compose box or a search input) has focus, so the keys
 * still move the caret there, and for Alt/Meta chords (OS/browser shortcuts).
 * @param {KeyboardEvent} ev
 * @param {string} key
 */
function isListKey(ev, key) {
    return ev.key === key && !ev.altKey && !ev.metaKey && !isEditableTarget(ev.target) && mounted_lists.size > 0;
}

export function addShortcuts() {
    api.shortcuts.add({
        id: 'social-newest',
        group: __('Social'),
        label: 'Home',
        description: __('Jump to the newest post'),
        matches: (ev) => isListKey(ev, 'Home'),
        handler: () => mounted_lists.forEach((el) => el.resetWindow()),
    });
    api.shortcuts.add({
        id: 'social-oldest',
        group: __('Social'),
        label: 'End',
        description: __('Jump to the oldest post'),
        matches: (ev) => isListKey(ev, 'End'),
        handler: () => mounted_lists.forEach((el) => el.resetToBottom()),
    });
}
