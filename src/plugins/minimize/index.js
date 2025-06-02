/**
 * @module converse-minimize
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import debounce from 'lodash-es/debounce';
import { _converse, api, converse, constants, u } from '@converse/headless';
import MinimizedChatsToggle from './toggle.js';
import {
    addMinimizeButtonToChat,
    addMinimizeButtonToMUC,
    initializeChat,
    maximize,
    minimize,
    trimChats
} from './utils.js';

import './view.js';
import './minimized-chat.js';
import './styles/minimize.scss';

const { CHATROOMS_TYPE } = constants;


converse.plugins.add('converse-minimize', {
    /**
     * @typedef {import('@converse/headless').MUC} MUC
     * @typedef {import('@converse/headless').ChatBox} ChatBox
     */

    /* Optional dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin. They are called "optional" because they might not be
     * available, in which case any overrides applicable to them will be
     * ignored.
     */
    dependencies: [
        "converse-chatview",
        "converse-controlbox",
        "converse-muc-views",
        "converse-headlines-view",
        "converse-dragresize"
    ],

    enabled (_converse) {
        return _converse.api.settings.get("view_mode") === 'overlayed';
    },

    initialize () {
        api.settings.extend({'no_trimming': false});

        api.promises.add('minimizedChatsInitialized');

        const exports = { MinimizedChatsToggle };
        Object.assign(_converse, exports); // DEPRECATED
        Object.assign(_converse.exports, exports);
        Object.assign(_converse, { minimize: { trimChats, minimize, maximize }}); // DEPRECATED
        Object.assign(_converse.exports, { minimize: { trimChats, minimize, maximize }});
        Object.assign(u, { trimChats, minimize, maximize });

        api.listen.on('chatBoxViewInitialized', view => trimChats(view));
        api.listen.on('chatRoomViewInitialized', view => trimChats(view));
        api.listen.on('controlBoxInitialized', view => trimChats(view));
        api.listen.on('chatBoxInitialized', initializeChat);
        api.listen.on('chatRoomInitialized', initializeChat);

        api.listen.on('getHeadingButtons', (view, buttons) => {
            if (view.model.get('type') === CHATROOMS_TYPE) {
                return addMinimizeButtonToMUC(view, buttons);
            } else {
                return addMinimizeButtonToChat(view, buttons);
            }
        });

        const debouncedTrimChats = debounce(() => trimChats(), 250);
        api.listen.on('registeredGlobalEventHandlers', () => window.addEventListener("resize", debouncedTrimChats));
        api.listen.on('unregisteredGlobalEventHandlers', () => window.removeEventListener("resize", debouncedTrimChats));
    }
});
