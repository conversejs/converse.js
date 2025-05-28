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
    if (
        mechanism.mechname === 'EXTERNAL' ||
        mechanism.mechname === 'ANONYMOUS' ||
        mechanism.mechname === 'X-OAUTH2' ||
        mechanism.mechname === 'OAUTHBEARER'
    ) {
        return false;
    }
    return true;
}

/**
 * @param {MouseEvent} ev
 */
export async function logOut(ev) {
    ev?.preventDefault();
    const result = await api.confirm(__('Confirm'), __('Are you sure you want to log out?'));
    if (result) {
        api.user.logout();
    }
}
