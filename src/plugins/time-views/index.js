/**
 * @description
 * Converse.js plugin which adds UI for XEP-0202 Entity Time: a warning above
 * the composer of a 1:1 chat when the user starts writing to a contact during
 * their "off-hours" (e.g. at night).
 * @copyright 2026, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api, converse } from '@converse/headless';
import EntityTimeAlert from './entity-time-alert.js';

import './styles/time-alert.scss';

converse.plugins.add('converse-time-views', {
    dependencies: ['converse-time', 'converse-chatview'],

    initialize() {
        // Defined here rather than at module level so that blacklisting this
        // plugin actually disables the feature. The chat template refers to the
        // tag unconditionally; left undefined it stays an inert unknown element.
        api.elements.define('converse-entity-time-alert', EntityTimeAlert);
    },
});
