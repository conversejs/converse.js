import { __ } from 'i18n';
import { _converse } from '@converse/headless';

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
 console.log('🔍 SASL Mechanism:', mechanism?.mechname, mechanism);
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

