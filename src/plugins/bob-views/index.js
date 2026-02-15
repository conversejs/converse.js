/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @module plugins-bob-views
 * @description
 * View plugin for XEP-0231 Bits of Binary
 * Handles rendering BOB images in message bodies
 */
import { api, converse } from '@converse/headless';
import { handleBOBImages } from './utils.js';

converse.plugins.add('converse-bob-views', {
    dependencies: ['converse-bob'],

    initialize() {
        api.listen.on('afterMessageBodyTransformed', handleBOBImages);
    },
});
