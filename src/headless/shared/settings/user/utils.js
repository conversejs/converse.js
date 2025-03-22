import _converse from '../../_converse.js';
import log from "@converse/log";
import { Model } from '@converse/skeletor';
import { initStorage } from '../../../utils/storage.js';

let user_settings; // User settings, populated via api.users.settings

/**
 * @returns {Promise<void>|void} A promise when the user settings object
 *  is created anew and it's contents fetched from storage.
 */
function initUserSettings () {
    const bare_jid = _converse.session.get('bare_jid');
    if (!bare_jid) {
        const msg = "No JID to fetch user settings for";
        log.error(msg);
        throw Error(msg);
    }
    const id = `converse.user-settings.${bare_jid}`;
    if (user_settings?.get('id') !== id) {
        user_settings = new Model({id});
        initStorage(user_settings, id);
        return user_settings.fetch({'promise': true});
    }
}

export async function getUserSettings () {
    await initUserSettings();
    return user_settings;
}

export async function updateUserSettings (data, options) {
    await initUserSettings();
    return user_settings.save(data, options);
}

export async function clearUserSettings () {
    const bare_jid = _converse.session.get('bare_jid');
    if (bare_jid) {
        await initUserSettings();
        return user_settings.clear();
    }
    user_settings = undefined;
}
