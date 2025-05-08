import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { initStorage } from '../../utils/storage.js';
import { getUnloadEvent } from '../../utils/session.js';
import { ACTIVE, INACTIVE } from '../../shared/constants.js';

const { Strophe, $build } = converse.env;

function onStatusInitialized (reconnecting) {
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
export function initStatus (reconnecting) {
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
            silent: true
        });
    }
}

let idle_seconds = 0;
let idle = false;
let auto_changed_status = false;
let inactive = false;

export function isIdle () {
    return idle;
}

export function getIdleSeconds () {
    return idle_seconds;
}

/**
 * Resets counters and flags relating to CSI and auto_away/auto_xa
 */
export function onUserActivity () {
    if (idle_seconds > 0) {
        idle_seconds = 0;
    }
    if (!api.connection.get()?.authenticated) {
        // We can't send out any stanzas when there's no authenticated connection.
        // This can happen when the connection reconnects.
        return;
    }
    if (inactive) sendCSI(ACTIVE);

    if (idle) {
        idle = false;
        api.user.presence.send();
    }

    if (auto_changed_status === true) {
        auto_changed_status = false;
        // XXX: we should really remember the original state here, and
        // then set it back to that...
        _converse.state.profile.set('status', api.settings.get("default_state"));
    }
}

export function onEverySecond () {
    /* An interval handler running every second.
     * Used for CSI and the auto_away and auto_xa features.
     */
    if (!api.connection.get()?.authenticated) {
        // We can't send out any stanzas when there's no authenticated connection.
        // This can happen when the connection reconnects.
        return;
    }
    const { profile } = _converse.state;
    const stat = profile.get('status');
    idle_seconds++;
    if (api.settings.get("csi_waiting_time") > 0 &&
            idle_seconds > api.settings.get("csi_waiting_time") &&
            !inactive) {
        sendCSI(INACTIVE);
    }
    if (api.settings.get("idle_presence_timeout") > 0 &&
            idle_seconds > api.settings.get("idle_presence_timeout") &&
            !idle) {
        idle = true;
        api.user.presence.send();
    }
    if (api.settings.get("auto_away") > 0 &&
            idle_seconds > api.settings.get("auto_away") &&
            stat !== 'away' && stat !== 'xa' && stat !== 'dnd') {
        auto_changed_status = true;
        profile.set('status', 'away');
    } else if (api.settings.get("auto_xa") > 0 &&
            idle_seconds > api.settings.get("auto_xa") &&
            stat !== 'xa' && stat !== 'dnd') {
        auto_changed_status = true;
        profile.set('status', 'xa');
    }
}

/**
 * Send out a Client State Indication (XEP-0352)
 * @function sendCSI
 * @param { String } stat - The user's chat status
 */
export function sendCSI (stat) {
    api.send($build(stat, {xmlns: Strophe.NS.CSI}));
    inactive = (stat === INACTIVE) ? true : false;
}

let everySecondTrigger;

/**
 * Set an interval of one second and register a handler for it.
 * Required for the auto_away, auto_xa and csi_waiting_time features.
 */
export function registerIntervalHandler () {
    if (
        api.settings.get("auto_away") < 1 &&
        api.settings.get("auto_xa") < 1 &&
        api.settings.get("csi_waiting_time") < 1 &&
        api.settings.get("idle_presence_timeout") < 1
    ) {
        // Waiting time of less then one second means features aren't used.
        return;
    }
    idle_seconds = 0;
    auto_changed_status = false; // Was the user's status changed by Converse?

    const { onUserActivity, onEverySecond } = _converse.exports;
    window.addEventListener('click', onUserActivity);
    window.addEventListener('focus', onUserActivity);
    window.addEventListener('keypress', onUserActivity);
    window.addEventListener('mousemove', onUserActivity);
    window.addEventListener(getUnloadEvent(), onUserActivity, {'once': true, 'passive': true});
    everySecondTrigger = setInterval(onEverySecond, 1000);
}

export function tearDown () {
    const { onUserActivity } = _converse.exports;
    window.removeEventListener('click', onUserActivity);
    window.removeEventListener('focus', onUserActivity);
    window.removeEventListener('keypress', onUserActivity);
    window.removeEventListener('mousemove', onUserActivity);
    window.removeEventListener(getUnloadEvent(), onUserActivity);
    if (everySecondTrigger) {
        clearInterval(everySecondTrigger);
        everySecondTrigger = null;
    }
}
