import URI from 'urijs';
import log from '@converse/headless/log';
import { api } from '@converse/headless/core';

function checkTLS (uri) {
    const uri_protocol = uri.protocol().toLowerCase();
    return (
        window.location.protocol === 'http:' ||
        (window.location.protocol === 'https:' && ['https', 'aesgcm'].includes(uri_protocol))
    );
}

export function getURI (url) {
    try {
        return url instanceof URI ? url : new URI(url);
    } catch (error) {
        log.debug(error);
        return null;
    }
}

function checkFileTypes (types, url) {
    const uri = getURI(url);
    if (uri === null || !checkTLS(uri)) {
        return false;
    }
    const filename = uri.filename().toLowerCase();
    return !!types.filter(ext => filename.endsWith(ext)).length;
}

export function isDomainWhitelisted (whitelist, url) {
    const uri = getURI(url);
    const subdomain = uri.subdomain();
    const domain = uri.domain();
    const fulldomain = `${subdomain ? `${subdomain}.` : ''}${domain}`;
    return whitelist.includes(domain) || whitelist.includes(fulldomain);
}

export function shouldRenderMediaFromURL (url_text, type) {
    const may_render = api.settings.get('render_media');
    const is_domain_allowed = isDomainAllowed(url_text, `allowed_${type}_domains`);

    if (Array.isArray(may_render)) {
        return is_domain_allowed && isDomainWhitelisted (may_render, url_text);
    } else {
        return is_domain_allowed && may_render;
    }
}

export function filterQueryParamsFromURL (url) {
    const paramsArray = api.settings.get('filter_url_query_params');
    if (!paramsArray) return url;
    const parsed_uri = getURI(url);
    return parsed_uri.removeQuery(paramsArray).toString();
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
