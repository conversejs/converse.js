/**
 * @module converse-headlines-view
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import '../chatview/index.js';
import HeadlinesBoxViewMixin from './view.js';
import { HeadlinesPanelMixin, HeadlinesPanel} from './panel.js';
import { _converse, api, converse } from '@converse/headless/core';

function onChatBoxViewsInitialized () {
    const views = _converse.chatboxviews;
    _converse.chatboxes.on('add', item => {
        if (!views.get(item.get('id')) && item.get('type') === _converse.HEADLINES_TYPE) {
            views.add(item.get('id'), new _converse.HeadlinesBoxView({ model: item }));
        }
    });
}

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
    dependencies: ['converse-headlines', 'converse-chatview'],

    overrides: {
        ControlBoxView: {
            renderControlBoxPane () {
                this.__super__.renderControlBoxPane.apply(this, arguments);
                this.renderHeadlinesPanel();
            }
        }
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        _converse.ControlBoxView && Object.assign(_converse.ControlBoxView.prototype, HeadlinesPanelMixin);
        _converse.HeadlinesBoxView = _converse.ChatBoxView.extend(HeadlinesBoxViewMixin);
        _converse.HeadlinesPanel = HeadlinesPanel;

        api.listen.on('chatBoxViewsInitialized', onChatBoxViewsInitialized);
    }
});
