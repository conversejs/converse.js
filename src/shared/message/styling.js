/**
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Utility functions to help with parsing XEP-393 message styling hints
 * @todo Other parsing helpers can be made more abstract and placed here.
 */
import { html } from 'lit-element';
import { renderStylingDirectiveBody } from '../../templates/directives/styling.js';


const styling_directives = ['*', '_', '~', '`', '```', '>'];
const styling_map = {
    '*': {'name': 'strong', 'type': 'span'},
    '_': {'name': 'emphasis', 'type': 'span'},
    '~': {'name': 'strike', 'type': 'span'},
    '`': {'name': 'preformatted', 'type': 'span'},
    '```': {'name': 'preformatted_block', 'type': 'block'},
    '>': {'name': 'quote', 'type': 'block'}
};

const dont_escape = ['_', '>', '`', '~'];

const styling_templates = {
    // m is the chatbox model
    // i is the offset of this directive relative to the start of the original message
    'emphasis': (txt, m, i) => html`<span class="styling-directive">_</span><i>${renderStylingDirectiveBody(txt, m, i)}</i><span class="styling-directive">_</span>`,
    'preformatted': txt => html`<span class="styling-directive">\`</span><code>${txt}</code><span class="styling-directive">\`</span>`,
    'preformatted_block': txt => html`<div class="styling-directive">\`\`\`</div><code class="block">${txt}</code><div class="styling-directive">\`\`\`</div>`,
    'quote': (txt, m, i) => html`<blockquote>${renderStylingDirectiveBody(txt, m, i)}</blockquote>`,
    'strike': (txt, m, i) => html`<span class="styling-directive">~</span><del>${renderStylingDirectiveBody(txt, m, i)}</del><span class="styling-directive">~</span>`,
    'strong': (txt, m, i) => html`<span class="styling-directive">*</span><b>${renderStylingDirectiveBody(txt, m, i)}</b><span class="styling-directive">*</span>`,
};


/**
 * Checks whether a given character "d" at index "i" of "text" is a valid opening or closing directive.
 * It's valid if it's not part of a word.
 * @param { String } d - The potential directive
 * @param { String } text - The text in which  the directive appears
 * @param { Number } i - The directive index
 * @param { Boolean } opening - Check for a valid opening or closing directive
 */
function isValidDirective (d, text, i, opening) {
    // Ignore directives that are parts of words
    // More info on the Regexes used here: https://javascript.info/regexp-unicode#unicode-properties-p
    if (opening) {
        const regex = RegExp(dont_escape.includes(d) ? `^(\\p{L}|\\p{N})${d}` : `^(\\p{L}|\\p{N})\\${d}`, 'u');
        if (i > 1 && regex.test(text.slice(i-1))) {
            return false;
        }
    } else {
        const regex = RegExp(dont_escape.includes(d) ? `^${d}(\\p{L}|\\p{N})` : `^\\${d}(\\p{L}|\\p{N})`, 'u');
        if (i < text.length-1 && regex.test(text.slice(i))) {
            return false;
        }
    }
    return true;
}

/**
 * Given a specific index "i" of "text", return the directive it matches or
 * null otherwise.
 * @param { String } text - The text in which  the directive appears
 * @param { Number } i - The directive index
 * @param { Boolean } opening - Whether we're looking for an opening or closing directive
 */
function getDirective (text, i, opening=true) {
    let d;
    if ((/(^```\s*\n|^```\s*$)/).test(text.slice(i)) && (i === 0 || text[i-1] === '\n' || text[i-1] === '>')) {
        d = text.slice(i, i+3);
    } else if (styling_directives.includes(text.slice(i, i+1)) && text[i] !== text[i+1]) {
        d = text.slice(i, i+1);
        if (!isValidDirective(d, text, i, opening)) return null;
    } else {
        return null;
    }
    return d;
}


/**
 * Given an opening directive "d", an index "i" and the text, check whether
 * we've found the closing directive.
 * @param { String } d -The directive
 * @param { Number } i - The directive index
 * @param { String } text -The text in which the directive appears
 */
function isDirectiveEnd (d, i, text) {
    const dtype = styling_map[d].type; // directive type
    return i === text.length || getDirective(text, i, false) === d || (dtype === 'span' && text[i] === '\n');
}


/**
 * Given a directive "d", which occurs in "text" at index "i", check that it
 * has a valid closing directive and return the length from start to end of the
 * directive.
 * @param { String } d -The directive
 * @param { Number } i - The directive index
 * @param { String } text -The text in which the directive appears
 */
function getDirectiveLength (d, text, i) {
    if (!d) { return 0; }
    const begin = i;
    i += d.length;
    if (isQuoteDirective(d)) {
        i += text.slice(i).split(/\n[^>]/).shift().length;
        return i-begin;
    } else if (styling_map[d].type === 'span') {
        const line = text.slice(i+1).split('\n').shift();
        let j = 0;
        let idx = line.indexOf(d);
        while (idx !== -1) {
            if (isDirectiveEnd(d, i+1+idx, text)) return idx+1+2*d.length;
            idx = line.indexOf(d, j++);
        }
        return 0;
    } else {
        const substring = text.slice(i+1);
        let j;
        let idx = substring.indexOf(d);
        while (idx !== -1) {
            if (isDirectiveEnd(d, i+1+idx, text)) return idx+1+2*d.length;
            idx = substring.indexOf(d, j++);
        }
        return 0;
    }
}


export function getDirectiveAndLength (text, i) {
    const d = getDirective(text, i);
    const length = d ? getDirectiveLength(d, text, i) : 0;
    return length > 0 ? { d, length } : {};
}


export const isQuoteDirective = (d) => ['>', '&gt;'].includes(d);


export function getDirectiveTemplate (d, text, model, offset) {
    const template = styling_templates[styling_map[d].name];
    if (isQuoteDirective(d)) {
        return template(text.replace(/\n>/g, '\n'), model, offset);
    } else {
        return template(text, model, offset);
    }
}


export function containsDirectives (text) {
    for (let i=0; i<styling_directives.length; i++) {
        if (text.includes(styling_directives[i])) {
            return true;
        }
    }
}
