import _converse from '../_converse.js';
import connection_api from '../connection/api.js';
import events_api from '../api/events.js';
import promise_api from '../api/promise.js';
import send_api from '../api/send.js';
import user_api from '../api/user.js';
import { settings_api } from '../settings/api.js';

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
const api = _converse.api = {
    connection: connection_api,
    settings: settings_api,
    ...send_api,
    ...user_api,
    ...events_api,
    ...promise_api,
};

export default api;
