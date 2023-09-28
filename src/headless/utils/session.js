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

export function saveWindowState (ev) {
    // XXX: eventually we should be able to just use
    // document.visibilityState (when we drop support for older
    // browsers).
    let state;
    const event_map = {
        'focus': "visible",
        'focusin': "visible",
        'pageshow': "visible",
        'blur': "hidden",
        'focusout': "hidden",
        'pagehide': "hidden"
    };
    ev = ev || document.createEvent('Events');
    if (ev.type in event_map) {
        state = event_map[ev.type];
    } else {
        state = document.hidden ? "hidden" : "visible";
    }
    _converse.windowState = state;
    /**
     * Triggered when window state has changed.
     * Used to determine when a user left the page and when came back.
     * @event _converse#windowStateChanged
     * @type { object }
     * @property{ string } state - Either "hidden" or "visible"
     * @example _converse.api.listen.on('windowStateChanged', obj => { ... });
     */
    _converse.api.trigger('windowStateChanged', {state});
}

export function setUnloadEvent () {
    if ('onpagehide' in window) {
        // Pagehide gets thrown in more cases than unload. Specifically it
        // gets thrown when the page is cached and not just
        // closed/destroyed. It's the only viable event on mobile Safari.
        // https://www.webkit.org/blog/516/webkit-page-cache-ii-the-unload-event/
        _converse.unloadevent = 'pagehide';
    } else if ('onbeforeunload' in window) {
        _converse.unloadevent = 'beforeunload';
    } else if ('onunload' in window) {
        _converse.unloadevent = 'unload';
    }
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
    return !_converse.config.get('trusted') ||
        api.settings.get('clear_cache_on_logout') ||
        isTestEnv();
}


export async function tearDown () {
    const { api } = _converse;
    await api.trigger('beforeTearDown', {'synchronous': true});
    window.removeEventListener('click', _converse.onUserActivity);
    window.removeEventListener('focus', _converse.onUserActivity);
    window.removeEventListener('keypress', _converse.onUserActivity);
    window.removeEventListener('mousemove', _converse.onUserActivity);
    window.removeEventListener(_converse.unloadevent, _converse.onUserActivity);
    window.clearInterval(_converse.everySecondTrigger);
    api.trigger('afterTearDown');
    return _converse;
}


export function clearSession () {
    _converse.session?.destroy();
    delete _converse.session;
    shouldClearCache() && _converse.api.user.settings.clear();
    /**
     * Synchronouse event triggered once the user session has been cleared,
     * for example when the user has logged out or when Converse has
     * disconnected for some other reason.
     * @event _converse#clearSession
     */
    return _converse.api.trigger('clearSession', {'synchronous': true});
}
