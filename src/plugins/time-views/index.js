/**
 * @description
 * Converse.js plugin which adds UI for XEP-0202 Entity Time.
 * Shows an alert bar in chats when the contact is in "off-hours" (e.g., nighttime).
 * @copyright 2026, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { converse } from '@converse/headless';
import './entity-time-alert.js';

import './styles/time-alert.scss';

converse.plugins.add('converse-time-views', {

    dependencies: ['converse-time', 'converse-chatview'],

    initialize() {
        // Element is defined at module level in entity-time-alert.js
    }
});
