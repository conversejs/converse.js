/**
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description This is the form utilities module.
 */
import { toStanza } from './stanza.js';

/**
 * @param {string} name
 * @param {string|string[]} value
 */
const tplXformField = (name, value) => `<field var="${name}">${value}</field>`;

/** @param {string} value */
const tplXformValue = (value) => `<value>${value}</value>`;

/**
 * @param {HTMLSelectElement} select
 * @return {string[]}
 */
export function getSelectValues (select) {
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
export function webForm2xForm (field) {
    const name = field.getAttribute('name');
    if (!name) {
        return null; // See #1924
    }
    let value;
    if (field.getAttribute('type') === 'checkbox') {
        value = /** @type {HTMLInputElement} */ (field).checked && '1' || '0';
    } else if (field.tagName == 'TEXTAREA') {
        value = field.value.split('\n').filter((s) => s.trim());
    } else if (field.tagName == 'SELECT') {
        value = getSelectValues(/** @type {HTMLSelectElement} */ (field));
    } else {
        value = field.value;
    }
    return toStanza(tplXformField(name, Array.isArray(value) ? value.map(tplXformValue) : tplXformValue(value)));
}
