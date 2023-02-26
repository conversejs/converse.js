/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import './shared/constants.js';
import _converse from './shared/_converse';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import connection_api from './shared/connection/api.js';
import dayjs from 'dayjs';
import i18n from './shared/i18n';
import { settings_api } from './shared/settings/api.js';
import send_api from './shared/api/send.js';
import user_api from './shared/api/user.js';
import events_api from './shared/api/events.js';
import promise_api from './shared/api/promise.js';

export { converse } from './shared/api/public.js';
export { _converse };
export { i18n };

dayjs.extend(advancedFormat);

/**
 * ### The private API
 *
 * The private API methods are only accessible via the closured {@link _converse}
 * object, which is only available to plugins.
 *
 * These methods are kept private (i.e. not global) because they may return
 * sensitive data which should be kept off-limits to other 3rd-party scripts
 * that might be running in the page.
 *
 * @namespace _converse.api
 * @memberOf _converse
 */
export const api = _converse.api = {
    connection: connection_api,
    settings: settings_api,
    ...send_api,
    ...user_api,
    ...events_api,
    ...promise_api,
};


_converse.shouldClearCache = () => (
    !_converse.config.get('trusted') ||
    api.settings.get('clear_cache_on_logout') ||
    _converse.isTestEnv()
);
