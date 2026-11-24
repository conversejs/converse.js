/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Logs in with passwords from the browser's credential store
 *  (the Credential Management API).
 */
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { getLoginCredentials, hasCredentialsAPI } from './utils.js';

converse.plugins.add('converse-browser-credentials', {
    enabled() {
        // Off a browser, for example under Node, there's no credential store.
        return hasCredentialsAPI();
    },

    initialize() {
        api.listen.on('fallbackLoginCredentials', getLoginCredentials);
    },
});
