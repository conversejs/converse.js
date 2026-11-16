import log from '@converse/log';
import { getOpenPromise } from '@converse/openpromise';
import { LOGIN, SESSION_ENDED } from '../shared/constants.js';
import { settings_api } from '../shared/settings/api.js';
import { getInitSettings } from '../shared/settings/utils.js';
import { forgetSession } from './remembered-session.js';

const settings = settings_api;

/**
 * We distinguish between UniView and MultiView instances.
 *
 * UniView means that only one chat is visible, even though there might be multiple ongoing chats.
 * MultiView means that multiple chats may be visible simultaneously.
 */
export function isUniView() {
    return ['fullscreen', 'embedded'].includes(settings.get('view_mode'));
}

export function isTestEnv() {
    return getInitSettings()['bosh_service_url'] === 'montague.lit/http-bind';
}

/**
 * @param {import('../shared/_converse.js').ConversePrivateGlobal} _converse
 * @param {string} name
 */
export function replacePromise(_converse, name) {
    const existing_promise = _converse.promises[name];
    if (!existing_promise) {
        throw new Error(`Tried to replace non-existing promise: ${name}`);
    }
    if (existing_promise.replace) {
        /** @type {import('../shared/types').ReplaceableOpenPromise} */
        const promise = getOpenPromise();
        promise.replace = existing_promise.replace;
        _converse.promises[name] = promise;
    } else {
        log.debug(`Not replacing promise "${name}"`);
    }
}

/**
 * Whether this device keeps a session's cache once the session has ended.
 * @param {import('../shared/_converse.js').ConversePrivateGlobal} _converse
 * @returns {boolean}
 */
export function isCacheKept(_converse) {
    const { api } = _converse;
    return !!_converse.state.config.get('trusted') && !api.settings.get('clear_cache_on_logout');
}

/**
 * Whether a session that this device remembers can be resumed from the cache
 * on a later start-up. Such a session is also kept through dropped
 * connections, retrying for as long as it's remembered.
 * @param {import('../shared/_converse.js').ConversePrivateGlobal} _converse
 * @returns {boolean}
 */
export function isResumable(_converse) {
    const { api } = _converse;
    return (
        api.settings.get('authentication') === LOGIN && isCacheKept(_converse) && !!api.settings.get('auto_reconnect')
    );
}

/**
 * Whether this session was resumed: loaded from the cache before it
 * connected, and not reconnected since. Plugins read it on the first
 * connection, to take over what they loaded rather than load it again.
 * @param {import('../shared/_converse.js').ConversePrivateGlobal} _converse
 * @returns {boolean}
 */
export function isResumed(_converse) {
    return !!_converse.api.connection.get()?.resumed_jid;
}

/**
 * Whether a session's cache is cleared once the session ends. Tests always
 * clear it, to keep them apart.
 * @param {import('../shared/_converse.js').ConversePrivateGlobal} _converse
 * @returns {boolean}
 */
export function shouldClearCache(_converse) {
    return !isCacheKept(_converse) || isTestEnv();
}

/**
 * @param {import('../shared/_converse.js').ConversePrivateGlobal} _converse
 * @returns {Promise<import('../shared/_converse.js').ConversePrivateGlobal>}
 */
export async function tearDown(_converse) {
    const { api } = _converse;
    await api.trigger('beforeTearDown', { 'synchronous': true });
    api.trigger('afterTearDown');
    return _converse;
}

/**
 * @param {import('../shared/_converse.js').ConversePrivateGlobal} _converse
 * @param {import('../shared/types').ClearSessionReason} [reason=SESSION_ENDED]
 */
export function clearSession(_converse, reason = SESSION_ENDED) {
    if (shouldClearCache(_converse)) {
        _converse.api.user.settings.clear();
        _converse.state.login_info?.destroy();
    }
    _converse.initSession();
    /**
     * Synchronous event triggered once the user session has been cleared.
     * Listeners are passed the reason:
     *
     * - `'ended'` (`constants.SESSION_ENDED`): the session is over, since
     *   the user has logged out or Converse has disconnected for good.
     * - `'anonymous-reset'` (`constants.ANONYMOUS_RESET`): the connection of
     *   an anonymous session dropped. The server gives out a new account on
     *   reconnecting, so what belonged to the old one is cleared, including
     *   its one-to-one chats. The visitor's session carries on though: its
     *   rooms are kept, to be rejoined.
     *
     * A listener that ignores the reason clears on both.
     * @event _converse#clearSession
     * @type {import('../shared/types').ClearSessionReason}
     * @example _converse.api.listen.on('clearSession', (reason) => { ... });
     */
    return _converse.api.trigger('clearSession', reason, { 'synchronous': true });
}

/**
 * Ends the session as logging out does, once there's no connection: the
 * promises are made anew for the next session, this device forgets the
 * session unless it's to be remembered, and `logout` is triggered.
 * @param {import('../shared/_converse.js').ConversePrivateGlobal} _converse
 * @param {object} [options]
 * @param {boolean} [options.remember=false] - Whether to keep remembering the session.
 * @param {string} [options.reason] - Why the session ended, when the user didn't end it.
 */
export async function endSession(_converse, { remember = false, reason } = {}) {
    Object.keys(_converse.promises).forEach((p) => replacePromise(_converse, p));
    // Otherwise the next start would resume it. See #2759
    if (!remember) await forgetSession();
    /**
     * Triggered once the session has ended, because the user logged out or
     * because it can't log in any more.
     * @event _converse#logout
     * @param {object} data
     * @param {string} [data.reason] - Why the session ended, for the user to
     *  read, when the user didn't end it.
     */
    _converse.api.trigger('logout', { reason });
}
