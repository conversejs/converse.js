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
    if (reconnecting) {
        onStatusInitialized(reconnecting);
    } else {
        const id = `converse.xmppstatus-${_converse.session.get('bare_jid')}`;
        _converse.state.profile = new _converse.exports.Profile({ id });
        _converse.state.xmppstatus = _converse.state.profile; // Deprecated
        Object.assign(_converse, { xmppstatus: _converse.state.profile }); // Deprecated
        initStorage(_converse.state.profile, id, 'session');
        _converse.state.profile.fetch({
            success: () => onStatusInitialized(reconnecting),
            error: () => onStatusInitialized(reconnecting),
            silent: true,
        });
    }
}
