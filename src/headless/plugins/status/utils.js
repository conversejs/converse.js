import { _converse, api, converse } from '@converse/headless/core';
import { initStorage } from '@converse/headless/utils/storage.js';

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

export function initStatus (reconnecting) {
    // If there's no xmppstatus obj, then we were never connected to
    // begin with, so we set reconnecting to false.
    reconnecting = _converse.xmppstatus === undefined ? false : reconnecting;
    if (reconnecting) {
        onStatusInitialized(reconnecting);
    } else {
        const id = `converse.xmppstatus-${_converse.bare_jid}`;
        _converse.xmppstatus = new _converse.XMPPStatus({ id });
        initStorage(_converse.xmppstatus, id, 'session');
        _converse.xmppstatus.fetch({
            'success': () => onStatusInitialized(reconnecting),
            'error': () => onStatusInitialized(reconnecting),
            'silent': true
        });
    }
}

export function onUserActivity () {
    /* Resets counters and flags relating to CSI and auto_away/auto_xa */
    if (_converse.idle_seconds > 0) {
        _converse.idle_seconds = 0;
    }
    if (!_converse.connection?.authenticated) {
        // We can't send out any stanzas when there's no authenticated connection.
        // This can happen when the connection reconnects.
        return;
    }
    if (_converse.inactive) {
        _converse.sendCSI(_converse.ACTIVE);
    }
    if (_converse.idle) {
        _converse.idle = false;
        api.user.presence.send();
    }
    if (_converse.auto_changed_status === true) {
        _converse.auto_changed_status = false;
        // XXX: we should really remember the original state here, and
        // then set it back to that...
        _converse.xmppstatus.set('status', api.settings.get("default_state"));
    }
}

export function onEverySecond () {
    /* An interval handler running every second.
     * Used for CSI and the auto_away and auto_xa features.
     */
    if (!_converse.connection?.authenticated) {
        // We can't send out any stanzas when there's no authenticated connection.
        // This can happen when the connection reconnects.
        return;
    }
    const stat = _converse.xmppstatus.get('status');
    _converse.idle_seconds++;
    if (api.settings.get("csi_waiting_time") > 0 &&
            _converse.idle_seconds > api.settings.get("csi_waiting_time") &&
            !_converse.inactive) {
        _converse.sendCSI(_converse.INACTIVE);
    }
    if (api.settings.get("idle_presence_timeout") > 0 &&
            _converse.idle_seconds > api.settings.get("idle_presence_timeout") &&
            !_converse.idle) {
        _converse.idle = true;
        api.user.presence.send();
    }
    if (api.settings.get("auto_away") > 0 &&
            _converse.idle_seconds > api.settings.get("auto_away") &&
            stat !== 'away' && stat !== 'xa' && stat !== 'dnd') {
        _converse.auto_changed_status = true;
        _converse.xmppstatus.set('status', 'away');
    } else if (api.settings.get("auto_xa") > 0 &&
            _converse.idle_seconds > api.settings.get("auto_xa") &&
            stat !== 'xa' && stat !== 'dnd') {
        _converse.auto_changed_status = true;
        _converse.xmppstatus.set('status', 'xa');
    }
}

/**
 * Send out a Client State Indication (XEP-0352)
 * @function sendCSI
 * @param { String } stat - The user's chat status
 */
export function sendCSI (stat) {
    api.send($build(stat, {xmlns: Strophe.NS.CSI}));
    _converse.inactive = (stat === _converse.INACTIVE) ? true : false;
}

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
    _converse.idle_seconds = 0;
    _converse.auto_changed_status = false; // Was the user's status changed by Converse?

    const { unloadevent } = _converse;
    window.addEventListener('click', _converse.onUserActivity);
    window.addEventListener('focus', _converse.onUserActivity);
    window.addEventListener('keypress', _converse.onUserActivity);
    window.addEventListener('mousemove', _converse.onUserActivity);
    window.addEventListener(unloadevent, _converse.onUserActivity, {'once': true, 'passive': true});
    _converse.everySecondTrigger = window.setInterval(_converse.onEverySecond, 1000);
}

export function addStatusToMUCJoinPresence (_, stanza) {
    const { xmppstatus } = _converse;

    const status = xmppstatus.get('status');
    if (['away', 'chat', 'dnd', 'xa'].includes(status)) {
        stanza.c('show').t(status).up();
    }
    const status_message = xmppstatus.get('status_message');
    if (status_message) {
        stanza.c('status').t(status_message).up();
    }
    return stanza;
}
