import { html } from 'lit';
import { u } from '@converse/headless';
import { bracketing_directives, dont_escape, styling_directives, styling_map } from './constants';

const URL_REGEXES = {
    // valid "scheme://" or "www."
    start: /(\b|_)(?:([a-z][a-z0-9.+-]*:\/\/)|xmpp:|mailto:|www\.)/gi,
    // everything up to the next whitespace
    end: /[\s\r\n]|$/,
    // trim trailing punctuation captured by end RegExp
    trim: /[`!()\[\]{};:'".,<>?«»""„'']+$/,
    // balanced parens inclusion (), [], {}, <>
    parens: /(\([^\)]*\)|\[[^\]]*\]|\{[^}]*\}|<[^>]*>)/g,
};

/**
 * @param {any} s
 * @returns {boolean} - Returns true if the input is a string, otherwise false.
 */
export function isString(s) {
    return typeof s === 'string';
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isSpotifyTrack(url) {
    try {
        const { hostname, pathname } = u.getURL(url);
        return hostname === 'open.spotify.com' && pathname.startsWith('/track/');
    } catch (e) {
        console.debug(`Could not create URL object from ${url}`);
        return false;
    }
}

/**
 * @param {string} url
 * @returns {Promise<Headers>}
 */
export async function getHeaders(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.headers;
    } catch (e) {
        console.debug(`Error calling HEAD on url ${url}: ${e}`);
        return null;
    }
}

/**
 * We don't render more than two line-breaks, replace extra line-breaks with
 * the zero-width whitespace character
 * This takes into account other characters that may have been removed by
 * being replaced with a zero-width space, such as '> ' in the case of
 * multi-line quotes.
 * @param {string} text
 */
export function collapseLineBreaks(text) {
    return text.replace(/\n(\u200B*\n)+/g, (m) => {
        if (m.length > 2) {
            return `\n${'\u200B'.repeat(m.length - 2)}\n`;
        } else if (m.length === 2) {
            return '\n\u200B';
        } else if (m.length === 1) {
            return '\u200B';
        }
    });
}

export const tplMentionWithNick = (o) =>
    html`<span class="mention mention--self badge badge-info" data-uri="${o.uri}">${o.mention}</span>`;

export function tplMention(o) {
    return html`<span class="mention" data-uri="${o.uri}">${o.mention}</span>`;
}

/**
 * Checks whether a given character "d" at index "i" of "text" is a valid opening or closing directive.
 * @param {String} d - The potential directive
 * @param {import('./texture').Texture} text - The text in which  the directive appears
 * @param {Number} i - The directive index
 * @param {Boolean} opening - Check for a valid opening or closing directive
 * @returns {boolean}
 */
function isValidDirective(d, text, i, opening) {
    // Ignore directives that are parts of words
    // More info on the Regexes used here: https://javascript.info/regexp-unicode#unicode-properties-p
    if (opening) {
        const regex = RegExp(dont_escape.includes(d) ? `^(\\p{L}|\\p{N})${d}` : `^(\\p{L}|\\p{N})\\${d}`, 'u');
        if (i > 1 && regex.test(text.slice(i - 1))) {
            return false;
        }
        const is_quote = isQuoteDirective(d);
        if (is_quote && i > 0 && text[i - 1] !== '\n') {
            // Quote directives must be on newlines
            return false;
        } else if (bracketing_directives.includes(d) && text[i + 1] === d) {
            // Don't consider empty bracketing directives as valid (e.g. **, `` etc.)
            return false;
        }
    } else {
        const regex = RegExp(dont_escape.includes(d) ? `^${d}(\\p{L}|\\p{N})` : `^\\${d}(\\p{L}|\\p{N})`, 'u');
        if (i < text.length - 1 && regex.test(text.slice(i))) {
            return false;
        }
        if (bracketing_directives.includes(d) && text[i - 1] === d) {
            // Don't consider empty directives as valid (e.g. **, `` etc.)
            return false;
        }
    }
    return true;
}

/**
 * Given a specific index "i" of "text", return the directive it matches or null otherwise.
 * @param {import('./texture').Texture} text - The text in which  the directive appears
 * @param {Number} i - The directive index
 * @param {Boolean} opening - Whether we're looking for an opening or closing directive
 * @returns {string|null}
 */
function getDirective(text, i, opening = true) {
    let d;

    if (
        /(^```[\s,\u200B]*\n)|(^```[\s,\u200B]*$)/.test(text.slice(i)) &&
        (i === 0 || text[i - 1] === '>' || /\n\u200B{0,2}$/.test(text.slice(0, i)))
    ) {
        d = text.slice(i, i + 3);
    } else if (styling_directives.includes(text.slice(i, i + 1))) {
        d = text.slice(i, i + 1);
        if (!isValidDirective(d, text, i, opening)) return null;
    } else {
        return null;
    }
    return d;
}

/**
 * @param {import('./texture').Texture} text
 * @param {number} i
 */
export function getDirectiveAndLength(text, i) {
    const d = getDirective(text, i);
    const length = d ? getDirectiveLength(d, text, i) : 0;
    return length > 0 ? { d, length } : {};
}

/**
 * Given a directive "d", which occurs in "text" at index "i", check that it
 * has a valid closing directive and return the length from start to end of the
 * directive.
 * @param {String} d -The directive
 * @param {Number} i - The directive index
 * @param {import('./texture').Texture} text -The text in which the directive appears
 */
function getDirectiveLength(d, text, i) {
    if (!d) return 0;

    const begin = i;
    i += d.length;
    if (isQuoteDirective(d)) {
        i += text
            .slice(i)
            .split(/\n\u200B*[^>\u200B]/)
            .shift().length;
        return i - begin;
    } else if (styling_map[d].type === 'span') {
        const line = text.slice(i).split('\n').shift();
        let j = 0;
        let idx = line.indexOf(d);
        while (idx !== -1) {
            if (getDirective(text, i + idx, false) === d) {
                return idx + 2 * d.length;
            }
            idx = line.indexOf(d, j++);
        }
        return 0;
    } else {
        // block directives
        const substring = text.slice(i + 1);
        let j = 0;
        let idx = substring.indexOf(d);
        while (idx !== -1) {
            if (getDirective(text, i + 1 + idx, false) === d) {
                return idx + 1 + 2 * d.length;
            }
            idx = substring.indexOf(d, j++);
        }
        return 0;
    }
}

/**
 * @param {string} d
 */
export function isQuoteDirective(d) {
    return ['>', '&gt;'].includes(d);
}

/**
 * Detects URL ranges in a text string.
 * @param {string} string - The input string to search for URLs
 * @returns {Array<[number, number]>} - Array of [start, end] index pairs for detected URLs
 */
export function getURLRanges(string) {
    /** @type {Array<[number, number]>} */
    const ranges = [];
    const _start = URL_REGEXES.start;
    const _end = URL_REGEXES.end;
    const _trim = URL_REGEXES.trim;
    const _parens = URL_REGEXES.parens;

    _start.lastIndex = 0;
    while (true) {
        const match = _start.exec(string);
        if (!match) break;

        const start = match.index;
        let end = start + string.slice(start).search(_end);
        let slice = string.slice(start, end);
        let parensEnd = -1;

        while (true) {
            const parensMatch = _parens.exec(slice);
            if (!parensMatch) break;

            const parensMatchEnd = parensMatch.index + parensMatch[0].length;
            parensEnd = Math.max(parensEnd, parensMatchEnd);
        }

        if (parensEnd > -1) {
            slice = slice.slice(0, parensEnd) + slice.slice(parensEnd).replace(_trim, '');
        } else {
            slice = slice.replace(_trim, '');
        }

        if (slice.length <= match[0].length) continue;

        end = start + slice.length;
        ranges.push([start, end]);
        _start.lastIndex = end;
    }

    _start.lastIndex = 0;
    return ranges;
}

/**
 * @param {import('./texture').Texture} text
 * @returns {boolean}
 */
export function containsDirectives(text) {
    for (let i = 0; i < styling_directives.length; i++) {
        if (text.includes(styling_directives[i])) {
            return true;
        }
    }
    return false;
}
