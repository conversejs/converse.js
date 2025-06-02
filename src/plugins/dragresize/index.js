import './components/dragresize.js';
import {
    shouldDestroyOnClose,
    initializeDragResize,
    dragresizeOverIframeHandler,
    registerGlobalEventHandlers,
    unregisterGlobalEventHandlers,
} from './utils.js';
import DragResizableMixin from './mixin.js';
import { _converse, api, converse } from '@converse/headless';

converse.plugins.add('converse-dragresize', {
    /* Plugin dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin.
     */
    dependencies: ['converse-chatview', 'converse-headlines-view', 'converse-muc-views'],

    enabled() {
        return api.settings.get('view_mode') == 'overlayed';
    },

    initialize() {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        api.settings.extend({
            allow_dragresize: true,
            dragresize_top_margin: 0,
        });

        Object.assign(_converse.exports.ChatView?.prototype ?? {}, DragResizableMixin);
        Object.assign(_converse.exports.MUCView?.prototype ?? {}, DragResizableMixin);
        Object.assign(_converse.exports.HeadlinesFeedView?.prototype ?? {}, DragResizableMixin);
        Object.assign(_converse.exports.ControlBoxView?.prototype ?? {}, DragResizableMixin);

        api.listen.on('headlinesFeedInitialized', initializeDragResize);
        api.listen.on('chatBoxInitialized', initializeDragResize);
        api.listen.on('chatRoomInitialized', initializeDragResize);
        api.listen.on('registeredGlobalEventHandlers', registerGlobalEventHandlers);
        api.listen.on('unregisteredGlobalEventHandlers', unregisterGlobalEventHandlers);
        api.listen.on('beforeShowingChatView', (view) => view.initDragResize().setDimensions());
        api.listen.on('startDiagonalResize', dragresizeOverIframeHandler);
        api.listen.on('startHorizontalResize', dragresizeOverIframeHandler);
        api.listen.on('startVerticalResize', dragresizeOverIframeHandler);
        api.listen.on('shouldDestroyOnClose', shouldDestroyOnClose);
    },
});
