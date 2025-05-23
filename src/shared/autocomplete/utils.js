import { html } from 'lit';
import { converse } from '@converse/headless';

const u = converse.env.utils;

export const helpers = {
    getElement(expr, el) {
        return typeof expr === 'string' ? (el || document).querySelector(expr) : expr || null;
    },

    bind(element, o) {
        if (element) {
            for (var event in o) {
                if (!Object.prototype.hasOwnProperty.call(o, event)) {
                    continue;
                }
                const callback = o[event];
                event.split(/\s+/).forEach((event) => element.addEventListener(event, callback));
            }
        }
    },

    unbind(element, o) {
        if (element) {
            for (var event in o) {
                if (!Object.prototype.hasOwnProperty.call(o, event)) {
                    continue;
                }
                const callback = o[event];
                event.split(/\s+/).forEach((event) => element.removeEventListener(event, callback));
            }
        }
    },

    isMention(word, ac_triggers) {
        return ac_triggers.includes(word[0]) || (u.isMentionBoundary(word[0]) && ac_triggers.includes(word[1]));
    },
};

/**
 * Escapes special characters in a string to be used in a regular expression.
 * This function takes a string and returns a new string with all special characters
 * escaped, ensuring that the string can be safely used in a RegExp constructor.
 * @param {string} s - The string to escape.
 */
export function regExpEscape(s) {
    return s.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * @param {string} text
 * @param {string} input
 * @returns {boolean}
 */
export function FILTER_CONTAINS(text, input) {
    return RegExp(regExpEscape(input.trim()), 'i').test(text);
}

/**
 * @param {string} text
 * @param {string} input
 * @returns {boolean}
 */
export function FILTER_STARTSWITH(text, input) {
    return RegExp('^' + regExpEscape(input.trim()), 'i').test(text);
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function SORT_BY_LENGTH(a, b) {
    if (a.length !== b.length) {
        return a.length - b.length;
    }
    return a < b ? -1 : 1;
}

export const SORT_BY_QUERY_POSITION = function (a, b) {
    const query = a.query.toLowerCase();
    const x = a.label.toLowerCase().indexOf(query);
    const y = b.label.toLowerCase().indexOf(query);

    if (x === y) {
        return SORT_BY_LENGTH(a, b);
    }
    return (x === -1 ? Infinity : x) < (y === -1 ? Infinity : y) ? -1 : 1;
};

/**
 * Renders an item for display in a list.
 * @param {string} text - The text to display.
 * @param {string} input - The input string to highlight.
 * @returns {import('lit').TemplateResult} The rendered HTML for the item.
 */
export function getAutoCompleteItem(text, input) {
    input = input.trim();
    const regex = new RegExp('(' + regExpEscape(input) + ')', 'ig');
    const parts = input ? text.split(regex) : [text];

    return html`
        <li aria-selected="false">
            ${parts.map((txt) => (input && txt.match(regex) ? html`<mark>${txt}</mark>` : txt))}
        </li>
    `;
}
