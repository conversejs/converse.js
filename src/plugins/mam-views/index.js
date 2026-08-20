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
        // Internal, deliberately undocumented setting. Auto-filling history gaps is
        // on by default and considered proven, so it's no longer offered as a public
        // toggle — but it's kept (and honoured by the placeholder) as a seam that lets
        // the test suite disable auto-fetching and drive the manual "load older" path
        // deterministically, without racing the IntersectionObserver.
        api.settings.extend({
            auto_fill_history_gaps: true,
        });
        api.listen.on('getMessageTemplate', getPlaceholderTemplate);
    }
});
