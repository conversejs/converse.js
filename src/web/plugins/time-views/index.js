/**
 * @description
 * Converse.js plugin which adds UI for XEP-0202 Entity Time: a warning above
 * the composer of a 1:1 chat when the user starts writing to a contact during
 * their "off-hours" (e.g. at night).
 * @copyright 2026, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api, constants, converse } from '@converse/headless';
import { html } from 'lit';
import EntityTimeAlert from './entity-time-alert.js';

import './styles/time-alert.scss';

const { CHATROOMS_TYPE } = constants;

// The off-hours warning's slot among the composer panels, smallest at the top.
const ENTITY_TIME_ALERT_ORDER = 100;

converse.plugins.add('converse-time-views', {
    dependencies: ['converse-time', 'converse-chatview'],

    initialize() {
        // Defined here rather than at module level so that blacklisting this
        // plugin actually disables the feature: the element is never defined,
        // and the panel below that would mount it is never added.
        api.elements.define('converse-entity-time-alert', EntityTimeAlert);

        api.listen.on('getComposerPanels', (container, panels) => {
            // A groupchat has no contact whose time there is to ask after.
            if (container.model.get('type') === CHATROOMS_TYPE) return panels;

            panels.push({
                name: 'entity-time-alert',
                order: ENTITY_TIME_ALERT_ORDER,
                template: html`<converse-entity-time-alert .model=${container.model}></converse-entity-time-alert>`,
            });
            return panels;
        });
    },
});
