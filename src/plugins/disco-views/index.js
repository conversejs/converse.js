/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { converse } from '@converse/headless';
import './disco-browser.js';

converse.plugins.add('converse-disco-views', {
    dependencies: ['converse-disco'],

    enabled() {
        return true;
    },

    initialize () {},
});
