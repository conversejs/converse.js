import './components/dragresize.js';
import {
    shouldDestroyOnClose,
    dragresizeOverIframeHandler,
    registerGlobalEventHandlers,
    unregisterGlobalEventHandlers,
} from './utils.js';
import { _converse, api, converse } from '@converse/headless';

converse.plugins.add('converse-dragresize', {
    initialize() {
        api.settings.extend({
            allow_dragresize: true,
            dragresize_top_margin: 0,
        });

        api.listen.on('registeredGlobalEventHandlers', registerGlobalEventHandlers);
        api.listen.on('unregisteredGlobalEventHandlers', unregisterGlobalEventHandlers);
        api.listen.on('startDiagonalResize', dragresizeOverIframeHandler);
        api.listen.on('startHorizontalResize', dragresizeOverIframeHandler);
        api.listen.on('startVerticalResize', dragresizeOverIframeHandler);
        api.listen.on('shouldDestroyOnClose', shouldDestroyOnClose);
    },
});
