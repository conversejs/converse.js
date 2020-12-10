import { converse } from '@converse/headless/core';

const u = converse.env.utils;

export const helpers = {
    getElement (expr, el) {
        return typeof expr === 'string' ? (el || document).querySelector(expr) : expr || null;
    },

    bind (element, o) {
        if (element) {
            for (var event in o) {
                if (!Object.prototype.hasOwnProperty.call(o, event)) {
                    continue;
                }
                const callback = o[event];
                event.split(/\s+/).forEach(event => element.addEventListener(event, callback));
            }
        }
    },

    unbind (element, o) {
        if (element) {
            for (var event in o) {
                if (!Object.prototype.hasOwnProperty.call(o, event)) {
                    continue;
                }
                const callback = o[event];
                event.split(/\s+/).forEach(event => element.removeEventListener(event, callback));
            }
        }
    },

    regExpEscape (s) {
        return s.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
    },

    isMention (word, ac_triggers) {
        return (
            ac_triggers.includes(word[0]) ||
            (u.isMentionBoundary(word[0]) && ac_triggers.includes(word[1]))
        );
    }
};

export const FILTER_CONTAINS = function (text, input) {
    return RegExp(helpers.regExpEscape(input.trim()), 'i').test(text);
};

export const FILTER_STARTSWITH = function (text, input) {
    return RegExp('^' + helpers.regExpEscape(input.trim()), 'i').test(text);
};

const SORT_BY_LENGTH = function (a, b) {
    if (a.length !== b.length) {
        return a.length - b.length;
    }
    return a < b ? -1 : 1;
};

export const SORT_BY_QUERY_POSITION = function (a, b) {
    const query = a.query.toLowerCase();
    const x = a.label.toLowerCase().indexOf(query);
    const y = b.label.toLowerCase().indexOf(query);

    if (x === y) {
        return SORT_BY_LENGTH(a, b);
    }
    return (x === -1 ? Infinity : x) < (y === -1 ? Infinity : y) ? -1 : 1;
};

export const ITEM = (text, input) => {
    input = input.trim();
    const element = document.createElement('li');
    element.setAttribute('aria-selected', 'false');

    const regex = new RegExp('(' + input + ')', 'ig');
    const parts = input ? text.split(regex) : [text];
    parts.forEach(txt => {
        if (input && txt.match(regex)) {
            const match = document.createElement('mark');
            match.textContent = txt;
            element.appendChild(match);
        } else {
            element.appendChild(document.createTextNode(txt));
        }
    });
    return element;
};
