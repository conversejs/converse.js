/**
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description This is the form utilities module.
 */
import u from "./core";

const tplXformField = (name, value) => `<field var="${name}">${ value }</field>`;

const tplXformValue = (value) => `<value>${value}</value>`;

/**
 * Takes an HTML DOM and turns it into an XForm field.
 * @private
 * @method u#webForm2xForm
 * @param { DOMElement } field - the field to convert
 */
export function webForm2xForm (field) {
    const name = field.getAttribute('name');
    if (!name) {
        return null; // See #1924
    }
    let value;
    if (field.getAttribute('type') === 'checkbox') {
        value = field.checked && 1 || 0;
    } else if (field.tagName == "TEXTAREA") {
        value = field.value.split('\n').filter(s => s.trim());
    } else if (field.tagName == "SELECT") {
        value = u.getSelectValues(field);
    } else {
        value = field.value;
    }
    return u.toStanza(tplXformField(
        name,
        Array.isArray(value) ? value.map(tplXformValue) : tplXformValue(value),
    ));
}

u.webForm2xForm = webForm2xForm;
