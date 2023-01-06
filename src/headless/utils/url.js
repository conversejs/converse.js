import log from '@converse/headless/log';
import { api, converse } from '@converse/headless/core';

const { u } = converse.env;

export function getURL (url) {
    try {
        return url instanceof URL ? url : new URL(url);
    } catch (error) {
        log.debug(error);
        return null;
    }
}

/**
 * Given a url, check whether the protocol being used is allowed for rendering
 * the media in the chat (as opposed to just rendering a URL hyperlink).
 * @param { String } url
 * @returns { Boolean }
 */
function isAllowedProtocolForMedia(url) {
    const uri = getURL(url);
    const { protocol } = window.location;
    if (['chrome-extension:','file:'].includes(protocol)) {
        return true;
    }
    return (
        protocol === 'http:' ||
        (protocol === 'https:' && ['https', 'aesgcm'].includes(uri.protocol))
    );
}

/**
 * Given the an array of file extensions, check whether a URL points to a file
 * ending in one of them.
 * @param { String[] } types - An array of file extensions
 * @param { String } url
 * @returns { Boolean }
 * @example
 *  checkFileTypes(['.gif'], 'https://conversejs.org/cat.gif?foo=bar');
 */
function checkFileTypes (types, url) {
    url = getURL(url);
    if (url === null) return false;

    const filename = url.pathname.split('/').pop().toLowerCase();
    return !!types.filter(ext => filename.endsWith(ext)).length;
}

export function isDomainWhitelisted (whitelist, url) {
    url = getURL(url);
    if (url === null) return false;

    return whitelist.includes(url.host) || !!whitelist.find((i) => i.endsWith(url.host));
}

export function shouldRenderMediaFromURL (url_text, type) {
    if (!isAllowedProtocolForMedia(url_text)) {
        return false;
    }
    const may_render = api.settings.get('render_media');
    const is_domain_allowed = isDomainAllowed(url_text, `allowed_${type}_domains`);

    if (Array.isArray(may_render)) {
        return is_domain_allowed && isDomainWhitelisted (may_render, url_text);
    } else {
        return is_domain_allowed && may_render;
    }
}

export function filterQueryParamsFromURL (url) {
    let params = api.settings.get('filter_url_query_params');

    if (!params || (!Array.isArray(params) && typeof params !== 'string')) {
        return url;
    }

    if (typeof params === 'string') {
        params = [params];
    }

    const parsed_uri = getURL(url);
    params.forEach((p) => parsed_uri.searchParams.delete(p));

    return parsed_uri;
}

export function isDomainAllowed (url, setting) {
    const allowed_domains = api.settings.get(setting);
    if (!Array.isArray(allowed_domains)) {
        return true;
    }
    try {
        return isDomainWhitelisted(allowed_domains, url);
    } catch (error) {
        log.debug(error);
        return false;
    }
}

/**
 * Accepts a {@link MediaURL} object and then checks whether its domain is
 * allowed for rendering in the chat.
 * @param { MediaURL } o
 * @returns { Bool }
 */
export function isMediaURLDomainAllowed (o) {
    return o.is_audio && isDomainAllowed(o.url, 'allowed_audio_domains') ||
        o.is_video && isDomainAllowed(o.url, 'allowed_video_domains') ||
        o.is_image && isDomainAllowed(o.url, 'allowed_image_domains');
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
    const regex = api.settings.get('image_urls_regex');
    return regex?.test(url) || isURLWithImageExtension(url);
}

export function isEncryptedFileURL (url) {
    return url.startsWith('aesgcm://');
}

Object.assign(u, {
    isAudioURL,
    isGIFURL,
    isVideoURL,
    isImageURL,
    isURLWithImageExtension,
    checkFileTypes,
    getURL,
    shouldRenderMediaFromURL,
    isAllowedProtocolForMedia,
});
