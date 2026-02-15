/**
 * @copyright the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description This is the form utilities module.
 */
import { Strophe, toStanza } from 'strophe.js';

/**
 * @param {string} name
 * @param {string|string[]} value
 */
const tplXformField = (name, value) => `<field var="${name}">${value}</field>`;

/** @param {string} value */
const tplXformValue = (value) => `<value>${Strophe.xmlescape(value)}</value>`;

/**
 * @param {HTMLSelectElement} select
 * @return {string[]}
 */
export function getSelectValues(select) {
    const result = [];
    const options = select?.options;
    for (let i = 0, iLen = options.length; i < iLen; i++) {
        const opt = options[i];
        if (opt.selected) {
            result.push(opt.value || opt.text);
        }
    }
    return result;
}

/**
 * Takes an HTML DOM and turns it into an XForm field.
 * @param {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} field - the field to convert
 * @return {Element}
 */
export function webForm2xForm(field) {
    const name = field.getAttribute('name');
    if (!name) {
        return null; // See #1924
    }
    let value;
    if (field.getAttribute('type') === 'checkbox') {
        const checkbox = /** @type {HTMLInputElement} */ (field);
        value = (checkbox.checked && '1') || '0';
    } else if (field.tagName == 'TEXTAREA') {
        value = field.value.split('\n').filter((s) => s.trim());
    } else if (field.tagName == 'SELECT') {
        value = getSelectValues(/** @type {HTMLSelectElement} */ (field));
    } else {
        value = field.value;
    }
    return toStanza(tplXformField(name, Array.isArray(value) ? value.map(tplXformValue) : tplXformValue(value)));
}

/**
 * Returns the current word being written in the input element
 * @method u#getCurrentWord
 * @param {HTMLInputElement|HTMLTextAreaElement} input - The HTMLElement in which text is being entered
 * @param {number} [index] - An optional rightmost boundary index. If given, the text
 *  value of the input element will only be considered up until this index.
 * @param {string|RegExp} [delineator] - An optional string delineator to
 *  differentiate between words.
 */
export function getCurrentWord(input, index, delineator) {
    if (!index) {
        index = input.selectionEnd || undefined;
    }
    let [word] = input.value.slice(0, index).split(/\s/).slice(-1);
    if (delineator) {
        [word] = word.split(delineator).slice(-1);
    }
    return word;
}

/**
 * @param {string} s
 */
export function isMentionBoundary(s) {
    return s !== '@' && RegExp(`(\\p{Z}|\\p{P})`, 'u').test(s);
}

/**
 * @param {HTMLInputElement} input - The HTMLElement in which text is being entered
 * @param {string} new_value
 */
export function replaceCurrentWord(input, new_value) {
    const caret = input.selectionEnd || undefined;
    const current_word = input.value.slice(0, caret).split(/\s/).pop();
    const value = input.value;
    const mention_boundary = isMentionBoundary(current_word[0]) ? current_word[0] : '';
    input.value = value.slice(0, caret - current_word.length) + mention_boundary + `${new_value} ` + value.slice(caret);
    const selection_end = caret - current_word.length + new_value.length + 1;
    input.selectionEnd = mention_boundary ? selection_end + 1 : selection_end;
}

/**
 * @param {HTMLTextAreaElement} textarea
 */
export function placeCaretAtEnd(textarea) {
    if (textarea !== document.activeElement) {
        textarea.focus();
    }
    // Double the length because Opera is inconsistent about whether a carriage return is one character or two.
    const len = textarea.value.length * 2;
    // Timeout seems to be required for Blink
    setTimeout(() => textarea.setSelectionRange(len, len), 1);
    // Scroll to the bottom, in case we're in a tall textarea
    // (Necessary for Firefox and Chrome)
    textarea.scrollTop = 999999;
}
