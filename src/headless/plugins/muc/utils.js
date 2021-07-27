import { ROLES } from '@converse/headless/plugins/muc/index.js';
import { _converse, api } from '@converse/headless/core.js';

/**
 * Given an occupant model, see which roles may be assigned to that user.
 * @param { Model } occupant
 * @returns { ('moderator', 'participant', 'visitor')[] } - An array of assignable roles
 */
export function getAssignableRoles (occupant) {
    let disabled = api.settings.get('modtools_disable_assign');
    if (!Array.isArray(disabled)) {
        disabled = disabled ? ROLES : [];
    }
    if (occupant.get('role') === 'moderator') {
        return ROLES.filter(r => !disabled.includes(r));
    } else {
        return [];
    }
}

Object.assign(_converse, { getAssignableRoles });
