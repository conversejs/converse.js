import { __ } from 'i18n';
import { _converse, api } from '@converse/headless';

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
