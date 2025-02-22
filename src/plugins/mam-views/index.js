/**
 * @description UI code for XEP-0313 Message Archive Management
 * @license Mozilla Public License (MPLv2)
 */
import './placeholder.js';
import { api, converse } from '@converse/headless';
import { getPlaceholderTemplate } from './utils.js';


converse.plugins.add('converse-mam-views', {
    dependencies: ['converse-mam', 'converse-chatview', 'converse-muc-views'],

    initialize () {
        api.settings.extend({
            auto_fill_history_gaps: true,
        });
        api.listen.on('getMessageTemplate', getPlaceholderTemplate);
    }
});
