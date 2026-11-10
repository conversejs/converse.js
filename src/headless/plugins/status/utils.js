import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import { initStorage } from '../../utils/storage.js';

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
 * @param {boolean} reconnecting
 */
export function initStatus(reconnecting) {
    // If there's no profile obj, then we were never connected to
    // begin with, so we set reconnecting to false.
    reconnecting = _converse.state.profile === undefined ? false : reconnecting;
    if (reconnecting || (_converse.state.session_cache_loaded && _converse.state.profile)) {
        onStatusInitialized(reconnecting);
    } else {
        fetchProfile().then(() => onStatusInitialized(reconnecting));
    }
}

/**
 * Creates the user's profile and loads what's cached of it.
 * @returns {Promise<void>}
 */
export function fetchProfile() {
    const id = `converse.xmppstatus-${_converse.session.get('bare_jid')}`;
    _converse.state.profile = new _converse.exports.Profile({ id });
    _converse.state.xmppstatus = _converse.state.profile; // Deprecated
    Object.assign(_converse, { xmppstatus: _converse.state.profile }); // Deprecated
    initStorage(_converse.state.profile, id, 'session');
    return new Promise((resolve) => {
        _converse.state.profile.fetch({
            success: () => resolve(),
            error: () => resolve(),
            silent: true,
        });
    });
}
