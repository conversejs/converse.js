/**
 * @module converse-headlines-view
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import '../chatview/index.js';
import HeadlinesFeedView from './view.js';
import { HeadlinesFeedsList } from './feed-list.js';
import { _converse, converse } from '@converse/headless';

import './styles/headlines.scss';
import './styles/headlines-head.scss';


converse.plugins.add('converse-headlines-view', {
    /* Plugin dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin.
     *
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found. By default it's
     * false, which means these plugins are only loaded opportunistically.
     *
     * NB: These plugins need to have already been loaded by the bundler
     */
    dependencies: ['converse-headlines', 'converse-dragresize', 'converse-chatview'],

    initialize () {
        const exports =  {
            HeadlinesFeedView,
            HeadlinesFeedsList,
            HeadlinesPanel: HeadlinesFeedsList, // DEPRECATED
        }
        Object.assign(_converse, exports); // DEPRECATED
        Object.assign(_converse.exports, exports);
    }
});
