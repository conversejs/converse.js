import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import { initStorage } from '../../utils/storage.js';
import { isResumed } from '../../utils/session.js';

/**
 * @param {boolean} reconnecting
 */
function onStatusInitialized(reconnecting) {
    /**
     * Triggered when the user's own chat status has been initialized.
     * @event _converse#statusInitialized
     * @example _converse.api.listen.on('statusInitialized', status => { ... });
     * @example _converse.api.waitUntil('statusInitialized').then(() => { ... });
     */
    api.trigger('statusInitialized', reconnecting);
}

/**
 * Loads the profile from the cache, before connecting.
 * @returns {Promise<void>}
 */
export async function loadCachedProfile() {
    if (!(await fetchProfile())) {
        // Read once connected instead.
        delete _converse.state.profile;
        delete _converse.state.xmppstatus; // Deprecated
        Object.assign(_converse, { xmppstatus: undefined }); // Deprecated
    }
}

/**
 * The user's profile, for reading. It's there before connecting if the
 * session was resumed, otherwise once the status has been initialized.
 * @returns {Promise<import('./profile').default>}
 */
export async function getProfile() {
    if (!isResumed(_converse) || !_converse.state.profile) await api.waitUntil('statusInitialized');
    return _converse.state.profile;
}

/**
 * @param {boolean} reconnecting
 */
export function initStatus(reconnecting) {
    // If there's no profile obj, then we were never connected to
    // begin with, so we set reconnecting to false.
    reconnecting = _converse.state.profile === undefined ? false : reconnecting;
    // A resumed session loaded its profile before connecting.
    const loaded = !reconnecting && isResumed(_converse) && !!_converse.state.profile;
    if (reconnecting || loaded) {
        onStatusInitialized(reconnecting);
    } else {
        fetchProfile().then(() => onStatusInitialized(reconnecting));
    }
}

/**
 * Creates the user's profile and loads what's cached of it.
 * @returns {Promise<boolean>} Whether the cache could be read.
 */
function fetchProfile() {
    const id = `converse.xmppstatus-${_converse.session.get('bare_jid')}`;
    _converse.state.profile = new _converse.exports.Profile({ id });
    _converse.state.xmppstatus = _converse.state.profile; // Deprecated
    Object.assign(_converse, { xmppstatus: _converse.state.profile }); // Deprecated
    initStorage(_converse.state.profile, id, 'session');
    return new Promise((resolve) => {
        _converse.state.profile.fetch({
            success: () => resolve(true),
            error: () => resolve(false),
            silent: true,
        });
    });
}
