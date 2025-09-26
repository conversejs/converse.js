import { html } from 'lit';
import { api } from '@converse/headless';
import { bracketing_directives, dont_escape, styling_directives, styling_map } from './constants';

/**
 * Will return false if URL is malformed or contains disallowed characters
 * @param {string} text
 * @returns {boolean}
 */
export function isValidURL(text) {
    try {
        if (text.startsWith('www.')) {
            return !!getURL(`http://${text}`);
        }
        return !!getURL(text);
    } catch {
        return false;
    }
}

/**
 * @param {string|URL} url
 * @returns {URL}
 */
export function getURL(url) {
    if (url instanceof URL) {
        return url;
    }
    return url.toLowerCase().startsWith('www.') ? getURL(`http://${url}`) : new URL(url);
}

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
        const { hostname, pathname } = getURL(url);
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

const URL_REGEXES = {
    // valid "scheme://" or "www."
    start: /(\b|_)(?:([a-z][a-z0-9.+-]*:\/\/)|xmpp:|mailto:|www\.)/gi,
    // everything up to the next whitespace
    end: /[\s\r\n]|$/,
    // trim trailing punctuation captured by end RegExp
    trim: /[`!()\[\]{};:'".,<>?«»“”„‘’]+$/,
    // balanced parens inclusion (), [], {}, <>
    parens: /(\([^\)]*\)|\[[^\]]*\]|\{[^}]*\}|<[^>]*>)/g,
};

/**
 * Processes a string to find and manipulate substrings based on a callback function.
 * This function searches for patterns defined by the provided start and end regular expressions,
 * and applies the callback to each matched substring, allowing for modifications
 * @copyright Copyright (c) 2011 Rodney Rehm
 *
 * @param {string} string - The input string to be processed.
 * @param {function} callback - A function that takes the matched substring and its start and end indices,
 *                              and returns a modified substring or undefined to skip modification.
 * @param {import("./types").ProcessStringOptions} [options]
 * @returns {string} The modified string after processing all matches.
 */
export function withinString(string, callback, options) {
    options = options || {};
    const _start = options.start || URL_REGEXES.start;
    const _end = options.end || URL_REGEXES.end;
    const _trim = options.trim || URL_REGEXES.trim;
    const _parens = options.parens || URL_REGEXES.parens;
    const _attributeOpen = /[a-z0-9-]=["']?$/i;

    _start.lastIndex = 0;
    while (true) {
        const match = _start.exec(string);
        if (!match) break;

        let start = match.index;
        if (options.ignoreHtml) {
            const attributeOpen = string.slice(Math.max(start - 3, 0), start);
            if (attributeOpen && _attributeOpen.test(attributeOpen)) {
                continue;
            }
        }

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
        if (options.ignore && options.ignore.test(slice)) continue;

        end = start + slice.length;
        const result = callback(slice, start, end);
        if (result === undefined) {
            _start.lastIndex = end;
            continue;
        }

        string = string.slice(0, start) + String(result) + string.slice(end);
        _start.lastIndex = start + String(result).length;
    }

    _start.lastIndex = 0;
    return string;
}

/**
 * Given the an array of file extensions, check whether a URL points to a file
 * ending in one of them.
 * @param {string[]} types - An array of file extensions
 * @param {string|URL} url
 * @returns {boolean}
 * @example
 *  checkFileTypes(['.gif'], 'https://conversejs.org/cat.gif?foo=bar');
 */
export function checkFileTypes(types, url) {
    let parsed_url;
    try {
        parsed_url = getURL(url);
    } catch (error) {
        throw new Error(`checkFileTypes: could not parse url ${url}`);
    }
    const filename = parsed_url.pathname.split('/').pop().toLowerCase();
    return !!types.filter((ext) => filename.endsWith(ext)).length;
}

/**
 * @param {string|URL} url
 */
export function isGIFURL(url) {
    return checkFileTypes(['.gif'], url);
}

/**
 * @param {string|URL} url
 * @param {Headers} [headers]
 */
export function isAudioURL(url, headers) {
    if (headers?.get('content-type')?.startsWith('audio')) {
        return true;
    }
    return checkFileTypes(['.ogg', '.mp3', '.m4a'], url);
}

/**
 * @param {string|URL} url
 * @param {Headers} [headers]
 */
export function isVideoURL(url, headers) {
    if (headers?.get('content-type')?.startsWith('video')) {
        return true;
    }
    return checkFileTypes(['.mp4', '.webm'], url);
}

/**
 * @param {string|URL} url
 * @returns {boolean}
 */
export function isURLWithImageExtension(url) {
    return checkFileTypes([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".svg"], url);
}

/**
 * @param {string|URL} url
 * @param {Headers} [headers]
 * @returns {boolean}
 */
export function isImageURL(url, headers) {
    if (headers?.get('content-type')?.startsWith('video')) {
        return true;
    }
    const regex = api.settings.get('image_urls_regex');
    return regex?.test(url) || isURLWithImageExtension(url);
}

/**
 * @param {string|URL} url
 */
export function isEncryptedFileURL(url) {
    return getURL(url).href.startsWith('aesgcm://');
}

/**
 * @param {import("./types").MediaURLIndexes} o
 * @returns {Promise<import("./types").MediaURLMetadata>}
 */
export async function getMetadataForURL(o) {
    const fetch_headers = api.settings.get('fetch_url_headers');
    const headers = fetch_headers ? await getHeaders(o.url) : null;
    return {
        ...o,
        is_gif: isGIFURL(o.url),
        is_audio: isAudioURL(o.url, headers),
        is_image: isImageURL(o.url, headers),
        is_video: isVideoURL(o.url, headers),
        is_encrypted: isEncryptedFileURL(o.url),
    };
}

/**
 * @param {string} text
 * @param {number} offset
 * @returns {Promise<{media_urls?: import("./types").MediaURLMetadata[]}>}
 */
export async function getMediaURLsMetadata(text, offset = 0) {
    const objs = [];
    if (!text) {
        return {};
    }
    try {
        withinString(
            text,
            /**
             * @param {string} url
             * @param {number} start
             * @param {number} end
             * @returns {string|undefined}
             */
            (url, start, end) => {
                if (url.startsWith('_')) {
                    url = url.slice(1);
                    start += 1;
                }
                if (url.endsWith('_')) {
                    url = url.slice(0, url.length - 1);
                    end -= 1;
                }

                if (isValidURL(url)) {
                    objs.push({ url, start: start + offset, end: end + offset });
                }
                return url;
            }
        );
    } catch (error) {
        console.debug(error);
    }

    const media_urls = await Promise.all(objs.map(getMetadataForURL));
    return media_urls.length ? { media_urls } : {};
}

/**
 * @param {Array<import("./types.ts").MediaURLMetadata>} arr
 * @param {string} text
 * @returns {import("./types.ts").MediaURLMetadata[]}
 */
export function addMediaURLsOffset(arr, text, offset = 0) {
    return arr
        .map((o) => {
            const start = o.start - offset;
            const end = o.end - offset;
            if (start < 0 || start >= text.length) {
                return null;
            }
            return Object.assign({}, o, {
                start,
                end,
                url: text.substring(o.start - offset, o.end - offset), // BBB
            });
        })
        .filter((o) => o);
}
