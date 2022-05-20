import { __ } from 'i18n';
import { api } from '@converse/headless/core';

export function getPrettyStatus (stat) {
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

export async function logOut (ev) {
    ev?.preventDefault();
    const result = await api.confirm(__("Are you sure you want to log out?"));
    if (result) {
        api.user.logout();
    }
}
