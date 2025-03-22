import URI from 'urijs';
import log from "@converse/log";
import { settings_api } from '../shared/settings/api.js';
import { URL_PARSE_OPTIONS } from '../shared/constants.js';

const settings = settings_api;

/**
 * Will return false if URL is malformed or contains disallowed characters
 * @param {string} text
 * @returns {boolean}
 */
export function isValidURL (text) {
    try {
        return !!(new URL(text));
    } catch {
        return false;
    }
}

/**
 * @param {string|URI} url
 */
export function getURI (url) {
    try {
        return url instanceof URI ? url : new URI(url);
    } catch (error) {
        log.debug(error);
        return null;
    }
}

/**
 * Given the an array of file extensions, check whether a URL points to a file
 * ending in one of them.
 * @param {string[]} types - An array of file extensions
 * @param {string} url
 * @returns {boolean}
 * @example
 *  checkFileTypes(['.gif'], 'https://conversejs.org/cat.gif?foo=bar');
 */
export function checkFileTypes (types, url) {
    const uri = getURI(url);
    if (uri === null) {
        throw new Error(`checkFileTypes: could not parse url ${url}`);
    }
    const filename = uri.filename().toLowerCase();
    return !!types.filter(ext => filename.endsWith(ext)).length;
}

export function filterQueryParamsFromURL (url) {
    const paramsArray = settings.get('filter_url_query_params');
    if (!paramsArray) return url;
    const parsed_uri = getURI(url);
    return parsed_uri.removeQuery(paramsArray).toString();
}

export function isURLWithImageExtension (url) {
    return checkFileTypes(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.svg'], url);
}

export function isGIFURL (url) {
    return checkFileTypes(['.gif'], url);
}

export function isAudioURL (url) {
    return checkFileTypes(['.ogg', '.mp3', '.m4a'], url);
}

export function isVideoURL (url) {
    return checkFileTypes(['.mp4', '.webm'], url);
}

export function isImageURL (url) {
    const regex = settings.get('image_urls_regex');
    return regex?.test(url) || isURLWithImageExtension(url);
}

export function isEncryptedFileURL (url) {
    return url.startsWith('aesgcm://');
}

/**
 * @typedef {Object} MediaURLMetadata
 * An object representing the metadata of a URL found in a chat message
 * The actual URL is not saved, it can be extracted via the `start` and `end` indexes.
 * @property {boolean} [is_audio]
 * @property {boolean} [is_image]
 * @property {boolean} [is_video]
 * @property {boolean} [is_encrypted]
 * @property {number} [end]
 * @property {number} [start]
 */

/**
 * An object representing a URL found in a chat message
 * @typedef {MediaURLMetadata} MediaURLData
 * @property {string} url
 */

/**
 * @param {string} text
 * @param {number} offset
 * @returns {{media_urls?: MediaURLMetadata[]}}
 */
export function getMediaURLsMetadata (text, offset=0) {
    const objs = [];
    if (!text) {
        return {};
    }
    try {
        URI.withinString(
            text,
            (url, start, end) => {
                if (url.startsWith('_')) {
                    url = url.slice(1);
                    start += 1;
                }
                if (url.endsWith('_')) {
                    url = url.slice(0, url.length-1);
                    end -= 1;
                }
                objs.push({ url, 'start': start+offset, 'end': end+offset });
                return url;
            },
            URL_PARSE_OPTIONS
        );
    } catch (error) {
        log.debug(error);
    }

    const media_urls = objs
        .map(o => ({
            'end': o.end,
            'is_audio': isAudioURL(o.url),
            'is_image': isImageURL(o.url),
            'is_video': isVideoURL(o.url),
            'is_encrypted': isEncryptedFileURL(o.url),
            'start': o.start

        }));
    return media_urls.length ? { media_urls } : {};
}

/**
 * Given an array of {@link MediaURLMetadata} objects and text, return an
 * array of {@link MediaURL} objects.
 * @param {Array<MediaURLMetadata>} arr
 * @param {string} text
 * @returns {MediaURLData[]}
 */
export function getMediaURLs (arr, text, offset=0) {
    return arr.map(o => {
        const start = o.start - offset;
        const end = o.end - offset;
        if (start < 0 || start >= text.length) {
            return null;
        }
        return (Object.assign({}, o, {
            start,
            end,
            'url': text.substring(o.start-offset, o.end-offset),
        }));
    }).filter(o => o);
}
