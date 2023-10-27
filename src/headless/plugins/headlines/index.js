/**
 * @module converse-headlines
 * @copyright 2022, the Converse.js contributors
 */
import HeadlinesFeed from './feed.js';
import _converse from '../../shared/_converse.js';
import api, { converse } from '../../shared/api/index.js';
import headlines_api from './api.js';
import { onHeadlineMessage } from './utils.js';
import { HEADLINES_TYPE } from '../../shared/constants.js';

converse.plugins.add('converse-headlines', {
    dependencies: ["converse-chat"],

    initialize () {
        /**
         * Shows headline messages
         * @class
         * @namespace _converse.HeadlinesFeed
         * @memberOf _converse
         */
        _converse.HeadlinesFeed = HeadlinesFeed;

        function registerHeadlineHandler () {
            api.connection.get()?.addHandler(m => {
                onHeadlineMessage(m);
                return true; // keep the handler
            }, null, 'message');
        }
        api.listen.on('connected', registerHeadlineHandler);
        api.listen.on('reconnected', registerHeadlineHandler);

        Object.assign(api, headlines_api);

        api.chatboxes.registry.add(HEADLINES_TYPE, HeadlinesFeed);
    }
});
