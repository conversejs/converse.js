import log from "@converse/log";
import { settings_api } from "../shared/settings/api.js";

const settings = settings_api;

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
 * Will return false if URL is malformed or contains disallowed characters
 * @param {string} text
 * @returns {boolean}
 */
export function isValidURL(text) {
    try {
        if (text.startsWith("www.")) {
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
    return url.toLowerCase().startsWith("www.") ? getURL(`http://${url}`) : new URL(url);
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
    const filename = parsed_url.pathname.split("/").pop().toLowerCase();
    return !!types.filter((ext) => filename.endsWith(ext)).length;
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
 */
export function isGIFURL(url) {
    return checkFileTypes([".gif"], url);
}

/**
 * @param {string|URL} url
 */
export function isAudioURL(url) {
    return checkFileTypes([".ogg", ".mp3", ".m4a"], url);
}

/**
 * @param {string|URL} url
 */
export function isVideoURL(url) {
    return checkFileTypes([".mp4", ".webm"], url);
}

/**
 * @param {string|URL} url
 * @returns {boolean}
 */
export function isImageURL(url) {
    const regex = settings.get("image_urls_regex");
    return regex?.test(url) || isURLWithImageExtension(url);
}

/**
 * @param {string|URL} url
 */
export function isEncryptedFileURL(url) {
    return getURL(url).href.startsWith("aesgcm://");
}

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
function withinString(string, callback, options) {
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
            slice = slice.slice(0, parensEnd) + slice.slice(parensEnd).replace(_trim, "");
        } else {
            slice = slice.replace(_trim, "");
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
 * @param {string} text
 * @param {number} offset
 * @returns {{media_urls?: import("./types").MediaURLMetadata[]}}
 */
export function getMediaURLsMetadata(text, offset = 0) {
    const objs = [];
    if (!text) {
        return {};
    }
    try {
        withinString(
            text,
            /**
             * @param {string} url_text
             * @param {number} start
             * @param {number} end
             * @returns {string|undefined}
             */
            (url_text, start, end) => {
                if (url_text.startsWith("_")) {
                    url_text = url_text.slice(1);
                    start += 1;
                }
                if (url_text.endsWith("_")) {
                    url_text = url_text.slice(0, url_text.length - 1);
                    end -= 1;
                }

                const url = getURL(url_text);
                if (url) {
                    objs.push({ url_text, url, start: start + offset, end: end + offset });
                }
                return url_text;
            }
        );
    } catch (error) {
        log.debug(error);
    }

    const media_urls = objs.map((o) => ({
        ...o,
        is_audio: isAudioURL(o.url),
        is_image: isImageURL(o.url),
        is_video: isVideoURL(o.url),
        is_encrypted: isEncryptedFileURL(o.url_text),
    }));
    return media_urls.length ? { media_urls } : {};
}

/**
 * @param {Array<import("./types").MediaURLMetadata>} arr
 * @param {string} text
 * @returns {import("./types").MediaURLMetadata[]}
 */
export function getMediaURLs(arr, text) {
    return arr
        .map((o) => {
            if (o.start < 0 || o.start >= text.length) {
                return null;
            }
            const url_text = text.substring(o.start, o.end);
            let url = null;
            try {
                url = getURL(url_text);
            } catch (e) {
                log.error(e);
            }
            return {
                ...o,
                url_text,
                url,
            };
        })
        .filter((o) => o);
}

/**
 * @param {Array<import("./types").MediaURLMetadata>} arr
 * @param {string} text
 * @returns {import("./types").MediaURLMetadata[]}
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
            });
        })
        .filter((o) => o);
}
