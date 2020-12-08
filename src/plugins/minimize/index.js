/**
 * @module converse-minimize
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import './components/minimized-chat.js';
import 'plugins/chatview/index.js';
import MinimizedChats from './view.js';
import MinimizedChatsToggle from './toggle.js';
import { _converse, api, converse } from '@converse/headless/core';
import { addMinimizeButtonToChat, addMinimizeButtonToMUC, initMinimizedChats, trimChats } from './utils.js';
import { debounce } from 'lodash-es';
import { minimizableChatBox, minimizableChatBoxView } from './mixins.js';

const { dayjs } = converse.env;


converse.plugins.add('converse-minimize', {
    /* Optional dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin. They are called "optional" because they might not be
     * available, in which case any overrides applicable to them will be
     * ignored.
     *
     * It's possible however to make optional dependencies non-optional.
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found.
     *
     * NB: These plugins need to have already been loaded via require.js.
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

    overrides: {
        // Overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        //
        // New functions which don't exist yet can also be added.

        ChatBox: {
            initialize () {
                this.__super__.initialize.apply(this, arguments);
                this.on('show', this.maximize, this);

                if (this.get('id') === 'controlbox') {
                    return;
                }
                this.save({
                    'minimized': this.get('minimized') || false,
                    'time_minimized': this.get('time_minimized') || dayjs(),
                });
            },

            maybeShow (force) {
                if (!force && this.get('minimized')) {
                    // Must return the chatbox
                    return this;
                }
                return this.__super__.maybeShow.apply(this, arguments);
            },

            isHidden () {
                return this.__super__.isHidden.call(this) || this.get('minimized');
            }
        },

        ChatBoxView: {
            show () {
                const { _converse } = this.__super__;
                if (_converse.api.settings.get("view_mode") === 'overlayed' && this.model.get('minimized')) {
                    this.model.minimize();
                    return this;
                } else {
                    return this.__super__.show.apply(this, arguments);
                }
            },

            isNewMessageHidden () {
                return this.model.get('minimized') ||
                    this.__super__.isNewMessageHidden.apply(this, arguments);
            },

            setChatBoxHeight (height) {
                if (!this.model.get('minimized')) {
                    return this.__super__.setChatBoxHeight.call(this, height);
                }
            },

            setChatBoxWidth (width) {
                if (!this.model.get('minimized')) {
                    return this.__super__.setChatBoxWidth.call(this, width);
                }
            }
        }
    },


    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by Converse.js's plugin machinery.
         */

        api.settings.extend({'no_trimming': false});

        Object.assign(_converse.ChatBox.prototype, minimizableChatBox);
        Object.assign(_converse.ChatBoxView.prototype, minimizableChatBoxView);

        api.promises.add('minimizedChatsInitialized');

        _converse.MinimizedChatsToggle = MinimizedChatsToggle;
        _converse.MinimizedChats = MinimizedChats;

        _converse.minimize = {};
        _converse.minimize.trimChats = trimChats;


        /************************ BEGIN Event Handlers ************************/
        api.listen.on('chatBoxViewInitialized', view => _converse.minimize.trimChats(view));
        api.listen.on('chatRoomViewInitialized', view => _converse.minimize.trimChats(view));
        api.listen.on('connected', () => initMinimizedChats());
        api.listen.on('controlBoxOpened', view => _converse.minimize.trimChats(view));
        api.listen.on('chatBoxViewInitialized', v => v.listenTo(v.model, 'change:minimized', v.onMinimizedChanged));

        api.listen.on('chatRoomViewInitialized', view => {
            view.listenTo(view.model, 'change:minimized', view.onMinimizedChanged)
            view.model.get('minimized') && view.hide();
        });

        api.listen.on('getHeadingButtons', (view, buttons) => {
            if (view.model.get('type') === _converse.CHATROOMS_TYPE) {
                return addMinimizeButtonToMUC(view, buttons);
            } else {
                return addMinimizeButtonToChat(view, buttons);
            }
        });

        const debouncedTrimChats = debounce(() => _converse.minimize.trimChats(), 250);
        api.listen.on('registeredGlobalEventHandlers', () => window.addEventListener("resize", debouncedTrimChats));
        api.listen.on('unregisteredGlobalEventHandlers', () => window.removeEventListener("resize", debouncedTrimChats));
    }
});
