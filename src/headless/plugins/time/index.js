/**
 * @description
 * Converse.js plugin which adds support for XEP-0202 Entity Time.
 * @see https://xmpp.org/extensions/xep-0202.html
 * @copyright 2026, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import time_api from './api.js';
import { registerTimeHandler } from './utils.js';

const { Strophe } = converse.env;

Strophe.addNamespace('TIME', 'urn:xmpp:time');

converse.plugins.add('converse-time', {

    initialize() {
        api.settings.extend({
            'show_entity_time': true,
            'entity_time_warning_start': 22,
            'entity_time_warning_end': 7,
            'entity_time_min_diff_hours': 0,  // Minimum timezone difference to show warning (0 = any different timezone)
        });

        Object.assign(api, time_api);

        api.listen.on('connected', registerTimeHandler);
        api.listen.on('reconnected', registerTimeHandler);
    }
});
