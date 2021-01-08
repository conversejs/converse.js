/**
 * @module converse-bookmark-views
 * @description Converse.js plugin which adds views for XEP-0048 bookmarks
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import '@converse/headless/plugins/muc/index.js';
import BookmarkForm from './form.js';
import BookmarksView from './bookmarks-list.js';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless/core';
import { bookmarkableChatRoomView, eventMethods } from './mixins.js';
import { checkBookmarksSupport } from '@converse/headless/plugins/bookmarks/utils';


converse.plugins.add('converse-bookmark-views', {
    /* Plugin dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin.
     *
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found. By default it's
     * false, which means these plugins are only loaded opportunistically.
     *
     * NB: These plugins need to have already been loaded via require.js.
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

        Object.assign(_converse, eventMethods);
        Object.assign(_converse.ChatRoomView.prototype, bookmarkableChatRoomView);

        _converse.MUCBookmarkForm = BookmarkForm;
        _converse.BookmarksView = BookmarksView;

        /************************ BEGIN Event Handlers ************************/
        api.listen.on('getHeadingButtons', (view, buttons) => {
            if (_converse.allow_bookmarks && view.model.get('type') === _converse.CHATROOMS_TYPE) {
                const bookmarked = view.model.get('bookmarked');
                const data = {
                    'i18n_title': bookmarked ? __('Unbookmark this groupchat') : __('Bookmark this groupchat'),
                    'i18n_text': bookmarked ? __('Unbookmark') : __('Bookmark'),
                    'handler': ev => view.toggleBookmark(ev),
                    'a_class': 'toggle-bookmark',
                    'icon_class': 'fa-bookmark',
                    'name': 'bookmark'
                };
                const names = buttons.map(t => t.name);
                const idx = names.indexOf('details');
                const data_promise = checkBookmarksSupport().then(s => (s ? data : ''));
                return idx > -1
                    ? [...buttons.slice(0, idx), data_promise, ...buttons.slice(idx)]
                    : [data_promise, ...buttons];
            }
            return buttons;
        });

        api.listen.on('chatRoomViewInitialized', view => view.setBookmarkState());
    }
});
