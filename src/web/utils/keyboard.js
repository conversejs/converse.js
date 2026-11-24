/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Keyboard event helpers.
 */

/**
 * Whether this keydown belongs to an input method editor (IME) composition
 * (e.g. the Enter that picks a Japanese conversion candidate, or the Escape
 * that cancels one), rather than being meant for the app. Safari fires
 * `compositionend` before the confirming keydown, so `isComposing` is already
 * false there and only the legacy key code 229 tells.
 * @param {KeyboardEvent} ev
 * @returns {boolean}
 */
export function isComposing(ev) {
    return ev.isComposing || ev.keyCode === 229;
}
