import { __ } from 'i18n';
import { _converse, api, converse, constants, u } from '@converse/headless';

const { Strophe, $build } = converse.env;

/**
 * @param {string} stat
 */
export function getPrettyStatus(stat) {
    if (stat === 'chat') {
        return __('online');
    } else if (stat === 'dnd') {
        return __('busy');
    } else if (stat === 'xa') {
        return __('away for long');
    } else if (stat === 'away') {
        return __('away');
    } else if (stat === 'offline') {
        return __('offline');
    } else {
        return __(stat) || __('online');
    }
}

/**
 * For certain auth mechanisms, it doesn't make sense to show the password
 * form.
 */
export function shouldShowPasswordResetForm() {
    const conn = _converse.api.connection.get();
    const mechanism = conn._sasl_mechanism;
    if (mechanism && ['EXTERNAL', 'ANONYMOUS', 'X-OAUTH2', 'OAUTHBEARER'].includes[mechanism.mechname]) {
        return false;
    } else if (['external', 'anonymous'].includes(api.settings.get('authentication'))) {
        return false;
    }
    return true;
}

let auto_changed_status = false;
let inactive = false;

/**
 * Send out a Client State Indication (XEP-0352)
 * @function sendCSI
 * @param { String } stat - The user's chat status
 */
export function sendCSI(stat) {
    api.send($build(stat, { xmlns: Strophe.NS.CSI }));
    inactive = stat === constants.INACTIVE ? true : false;
}

/**
 * Resets counters and flags relating to CSI and auto_away/auto_xa
 */
export function onUserActivity() {
    api.user.idle.set({ seconds: 0 });

    if (!api.connection.get()?.authenticated) {
        // We can't send out any stanzas when there's no authenticated connection.
        // This can happen when the connection reconnects.
        return;
    }
    if (inactive) sendCSI(constants.ACTIVE);

    const { idle } = api.user.idle.get();
    if (idle) {
        api.user.idle.set({ idle: false });
        api.user.presence.send();
    }

    if (auto_changed_status === true) {
        auto_changed_status = false;
        // XXX: we should really remember the original state here, and
        // then set it back to that...
        _converse.state.profile.set('show', undefined);
    }
}

/**
 * An interval handler running every second.
 * Used for CSI and the auto_away and auto_xa features.
 */
export function onEverySecond() {
    if (!api.connection.get()?.authenticated) {
        // We can't send out any stanzas when there's no authenticated connection.
        // This can happen when the connection reconnects.
        return;
    }
    const { profile } = _converse.state;
    const show = profile.get('show');
    const idle_presence_timeout = api.settings.get('idle_presence_timeout');
    const csi_waiting_time = api.settings.get('csi_waiting_time');
    const idle_status = api.user.idle.get();
    let seconds = idle_status.seconds;
    let idle = idle_status.idle;

    seconds++;
    if (csi_waiting_time > 0 && seconds > csi_waiting_time && !inactive) {
        sendCSI(constants.INACTIVE);
    }

    if (idle_presence_timeout > 0 && seconds > idle_presence_timeout && !idle) {
        idle = true;
        api.user.presence.send();
    }
    if (
        api.settings.get('auto_away') > 0 &&
        seconds > api.settings.get('auto_away') &&
        show !== 'away' &&
        show !== 'xa' &&
        show !== 'dnd'
    ) {
        auto_changed_status = true;
        profile.set('show', 'away');
    } else if (
        api.settings.get('auto_xa') > 0 &&
        seconds > api.settings.get('auto_xa') &&
        show !== 'xa' &&
        show !== 'dnd'
    ) {
        auto_changed_status = true;
        profile.set('show', 'xa');
    }

    api.user.idle.set({ idle, seconds });
}

let everySecondTrigger;

/**
 * Set an interval of one second and register a handler for it.
 * Required for the auto_away, auto_xa and csi_waiting_time features.
 */
export function registerIntervalHandler() {
    if (
        api.settings.get('auto_away') < 1 &&
        api.settings.get('auto_xa') < 1 &&
        api.settings.get('csi_waiting_time') < 1 &&
        api.settings.get('idle_presence_timeout') < 1
    ) {
        // Waiting time of less then one second means features aren't used.
        return;
    }
    api.user.idle.set({ seconds: 0 });
    auto_changed_status = false; // Was the user's status changed by Converse?

    const { onUserActivity, onEverySecond } = _converse.exports;
    window.addEventListener('click', onUserActivity);
    window.addEventListener('focus', onUserActivity);
    window.addEventListener('keypress', onUserActivity);
    window.addEventListener('mousemove', onUserActivity);
    window.addEventListener(u.getUnloadEvent(), onUserActivity, { 'once': true, 'passive': true });
    everySecondTrigger = setInterval(onEverySecond, 1000);
}

export function tearDown() {
    const { onUserActivity } = _converse.exports;
    window.removeEventListener('click', onUserActivity);
    window.removeEventListener('focus', onUserActivity);
    window.removeEventListener('keypress', onUserActivity);
    window.removeEventListener('mousemove', onUserActivity);
    window.removeEventListener(u.getUnloadEvent(), onUserActivity);
    if (everySecondTrigger) {
        clearInterval(everySecondTrigger);
        everySecondTrigger = null;
    }
}
