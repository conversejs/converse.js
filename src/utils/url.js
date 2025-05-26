import { api, log, u } from "@converse/headless";

/**
 * @param {string[]} whitelist
 * @param {string|URL} url
 */
export function isDomainWhitelisted(whitelist, url) {
    const uri = u.getURL(url);
    const parts = uri.hostname.split('.');
    const domain = parts.slice(-2).join('.'); // Get the last two parts for domain and TLD
    const subdomain = parts.slice(0, -2).join('.'); // Get everything before the last two parts
    const fulldomain = `${subdomain ? `${subdomain}.` : ""}${domain}`;
    return whitelist.includes(domain) || whitelist.includes(fulldomain);
}

/**
 * @param {string|URL} url
 * @param {string} setting
 */
export function isDomainAllowed(url, setting) {
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
 * @param {import('@converse/headless/types/utils/types').MediaURLMetadata} o
 * @returns {boolean}
 */
export function isMediaURLDomainAllowed(o) {
    return (
        (o.is_audio && isDomainAllowed(o.url, "allowed_audio_domains")) ||
        (o.is_video && isDomainAllowed(o.url, "allowed_video_domains")) ||
        (o.is_image && isDomainAllowed(o.url, "allowed_image_domains"))
    );
}

/**
 * Given a url, check whether the protocol being used is allowed for rendering
 * the media in the chat (as opposed to just rendering a URL hyperlink).
 * @param {string} url
 * @returns {boolean}
 */
function isAllowedProtocolForMedia(url) {
    const { protocol } = window.location;
    if (["chrome-extension:", "file:"].includes(protocol)) {
        return true;
    }
    const uri = u.getURL(url);
    return (
        protocol === "http:" || (protocol === "https:" && ["https:", "aesgcm:"].includes(uri.protocol.toLowerCase()))
    );
}

/**
 * @param {string} url_text
 * @param {"audio"|"image"|"video"} type
 */
export function shouldRenderMediaFromURL(url_text, type) {
    if (!isAllowedProtocolForMedia(url_text)) {
        return false;
    }
    const may_render = api.settings.get("render_media");
    const is_domain_allowed = isDomainAllowed(url_text, `allowed_${type}_domains`);

    if (Array.isArray(may_render)) {
        return is_domain_allowed && isDomainWhitelisted(may_render, url_text);
    } else {
        return is_domain_allowed && may_render;
    }
}

/**
 * Takes the `filter_url_query_params` array from the settings and
 * removes any query strings from the URL that matches those values.
 * @param {string} url
 * @return {string}
 */
export function filterQueryParamsFromURL(url) {
    const setting = api.settings.get("filter_url_query_params");
    if (!setting) return url;

    const to_remove = Array.isArray(setting) ? setting : [setting];
    const url_obj = u.getURL(url);
    to_remove.forEach(/** @param {string} p */(p) => url_obj.searchParams.delete(p));

    return url_obj.toString();
}
