/**
 * @typedef {module:headless-shared-chat-utils.MediaURLData} MediaURLData
 */
import { api, log, u } from '@converse/headless';

const { getURI } = u;

export function isDomainWhitelisted (whitelist, url) {
    const uri = getURI(url);
    const subdomain = uri.subdomain();
    const domain = uri.domain();
    const fulldomain = `${subdomain ? `${subdomain}.` : ''}${domain}`;
    return whitelist.includes(domain) || whitelist.includes(fulldomain);
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
 * Accepts a {@link MediaURLData} object and then checks whether its domain is
 * allowed for rendering in the chat.
 * @param {MediaURLData} o
 * @returns {boolean}
 */
export function isMediaURLDomainAllowed (o) {
    return o.is_audio && isDomainAllowed(o.url, 'allowed_audio_domains') ||
        o.is_video && isDomainAllowed(o.url, 'allowed_video_domains') ||
        o.is_image && isDomainAllowed(o.url, 'allowed_image_domains');
}

/**
 * Given a url, check whether the protocol being used is allowed for rendering
 * the media in the chat (as opposed to just rendering a URL hyperlink).
 * @param {string} url
 * @returns {boolean}
 */
function isAllowedProtocolForMedia (url) {
    const uri = getURI(url);
    const { protocol } = window.location;
    if (['chrome-extension:','file:'].includes(protocol)) {
        return true;
    }
    return (
        protocol === 'http:' ||
        (protocol === 'https:' && ['https', 'aesgcm'].includes(uri.protocol().toLowerCase()))
    );
}

/**
 * @param {string} url_text
 * @param {"audio"|"image"|"video"} type
 */
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
