import URI from 'urijs';
import log from '../log.js';
import { settings_api } from '../shared/settings/api.js';

const settings = settings_api;

/**
 * Will return false if URL is malformed or contains disallowed characters
 * @param {string} text
 * @returns {boolean}
 */
export function isValidURL (text) {
    try {
        return !!(new URL(text));
    } catch (error) {
        log.error(error);
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
