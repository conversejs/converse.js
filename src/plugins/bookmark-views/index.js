/**
 * @description Converse.js plugin which adds views for XEP-0048 bookmarks
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import './modals/bookmark-list.js';
import './modals/bookmark-form.js';
import '@converse/headless/plugins/muc/index.js';
import BookmarkForm from './components/bookmark-form.js';
import BookmarksView from './components/bookmarks-list.js';
import { _converse, api, converse } from '@converse/headless';
import { bookmarkableChatRoomView } from './mixins.js';
import { getHeadingButtons, removeBookmarkViaEvent, addBookmarkViaEvent } from './utils.js';

import './styles/bookmarks.scss';


converse.plugins.add('converse-bookmark-views', {
    /* Plugin dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin.
     *
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found. By default it's
     * false, which means these plugins are only loaded opportunistically.
     */
    dependencies: ['converse-chatboxes', 'converse-muc', 'converse-muc-views'],

    initialize () {
        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        api.settings.extend({
            hide_open_bookmarks: true
        });

        const exports =  {
            removeBookmarkViaEvent,
            addBookmarkViaEvent,
            MUCBookmarkForm: BookmarkForm,
            BookmarksView,
        }

        Object.assign(_converse, exports); // DEPRECATED
        Object.assign(_converse.exports, exports);
        Object.assign(_converse.exports.ChatRoomView.prototype, bookmarkableChatRoomView);

        api.listen.on('getHeadingButtons', getHeadingButtons);
        api.listen.on('chatRoomViewInitialized', view => view.setBookmarkState());
    }
});
