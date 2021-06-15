/**
 * @description UI code XEP-0313 Message Archive Management
 * @copyright 2021, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import './placeholder.js';
import { api, converse } from '@converse/headless/core';
import { fetchMessagesOnScrollUp, getPlaceholderTemplate } from './utils.js';


converse.plugins.add('converse-mam-views', {
    dependencies: ['converse-mam', 'converse-chatview', 'converse-muc-views'],

    initialize () {
        api.listen.on('chatBoxScrolledUp', fetchMessagesOnScrollUp);
        api.listen.on('getMessageTemplate', getPlaceholderTemplate);
    }
});
