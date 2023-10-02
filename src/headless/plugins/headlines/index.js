/**
 * @module converse-headlines
 * @copyright 2022, the Converse.js contributors
 */
import HeadlinesFeed from './feed.js';
import _converse from '../../shared/_converse.js';
import api, { converse } from '../../shared/api/index.js';
import headlines_api from './api.js';
import { onHeadlineMessage } from './utils.js';


converse.plugins.add('converse-headlines', {
    dependencies: ["converse-chat"],

    overrides: {
        // Overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.

        ChatBoxes: {
            model (attrs, options) {
                const { _converse } = this.__super__;
                if (attrs.type == _converse.HEADLINES_TYPE) {
                    return new _converse.HeadlinesFeed(attrs, options);
                } else {
                    return this.__super__.model.apply(this, arguments);
                }
            },
        }
    },


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
    }
});
