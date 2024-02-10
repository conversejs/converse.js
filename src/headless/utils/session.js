import _converse from '../shared/_converse.js';
import log from '../log.js';
import { getOpenPromise } from '@converse/openpromise';
import { settings_api } from '../shared/settings/api.js';
import { getInitSettings } from '../shared/settings/utils.js';

/**
 * We distinguish between UniView and MultiView instances.
 *
 * UniView means that only one chat is visible, even though there might be multiple ongoing chats.
 * MultiView means that multiple chats may be visible simultaneously.
 */
export function isUniView () {
    return ['mobile', 'fullscreen', 'embedded'].includes(settings_api.get("view_mode"));
}

export function isTestEnv () {
    return getInitSettings()['bosh_service_url'] === 'montague.lit/http-bind';
}

export function getUnloadEvent () {
    if ('onpagehide' in window) {
        // Pagehide gets thrown in more cases than unload. Specifically it
        // gets thrown when the page is cached and not just
        // closed/destroyed. It's the only viable event on mobile Safari.
        // https://www.webkit.org/blog/516/webkit-page-cache-ii-the-unload-event/
        return 'pagehide';
    } else if ('onbeforeunload' in window) {
        return 'beforeunload';
    }
    return 'unload';
}

export function replacePromise (name) {
    const existing_promise = _converse.promises[name];
    if (!existing_promise) {
        throw new Error(`Tried to replace non-existing promise: ${name}`);
    }
    if (existing_promise.replace) {
        const promise = getOpenPromise();
        promise.replace = existing_promise.replace;
        _converse.promises[name] = promise;
    } else {
        log.debug(`Not replacing promise "${name}"`);
    }
}

export function shouldClearCache () {
    const { api } = _converse;
    return !_converse.state.config.get('trusted') ||
        api.settings.get('clear_cache_on_logout') ||
        isTestEnv();
}


export async function tearDown () {
    const { api } = _converse;
    await api.trigger('beforeTearDown', {'synchronous': true});
    api.trigger('afterTearDown');
    return _converse;
}


export function clearSession () {
    shouldClearCache() && _converse.api.user.settings.clear();
    _converse.initSession();
    /**
     * Synchronouse event triggered once the user session has been cleared,
     * for example when the user has logged out or when Converse has
     * disconnected for some other reason.
     * @event _converse#clearSession
     */
    return _converse.api.trigger('clearSession', {'synchronous': true});
}
