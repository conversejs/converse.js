/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import '../modal/index.js';
import './modals/chat-status.js';
import './modals/profile.js';
import './modals/user-settings.js';
import './statusview.js';
import '@converse/headless/plugins/status';
import '@converse/headless/plugins/vcard';
import { api, converse } from '@converse/headless/core';

converse.plugins.add('converse-profile', {
    dependencies: [
        'converse-status',
        'converse-modal',
        'converse-vcard',
        'converse-chatboxviews',
        'converse-adhoc-views',
    ],

    initialize () {
        api.settings.extend({
            'show_client_info': true,
        });
    },
});
