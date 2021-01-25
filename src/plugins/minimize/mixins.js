import { _converse, api, converse } from '@converse/headless/core';

const u = converse.env.utils;

export const minimizableChatBox = {
    maximize () {
        u.safeSave(this, {
            'hidden': false,
            'minimized': false,
            'time_opened': new Date().getTime()
        });
    },

    minimize () {
        u.safeSave(this, {
            'hidden': true,
            'minimized': true,
            'time_minimized': new Date().toISOString()
        });
    }
};

export const minimizableChatBoxView = {
    /**
     * Handler which gets called when a {@link _converse#ChatBox} has it's
     * `minimized` property set to false.
     *
     * Will trigger {@link _converse#chatBoxMaximized}
     * @private
     * @returns {_converse.ChatBoxView|_converse.ChatRoomView}
     */
    onMaximized () {
        if (!this.model.isScrolledUp()) {
            this.model.clearUnreadMsgCounter();
        }
        this.model.setChatState(_converse.ACTIVE);
        this.show();
        /**
         * Triggered when a previously minimized chat gets maximized
         * @event _converse#chatBoxMaximized
         * @type { _converse.ChatBoxView }
         * @example _converse.api.listen.on('chatBoxMaximized', view => { ... });
         */
        api.trigger('chatBoxMaximized', this);
        return this;
    },

    /**
     * Handler which gets called when a {@link _converse#ChatBox} has it's
     * `minimized` property set to true.
     *
     * Will trigger {@link _converse#chatBoxMinimized}
     * @private
     * @returns {_converse.ChatBoxView|_converse.ChatRoomView}
     */
    onMinimized (ev) {
        if (ev && ev.preventDefault) {
            ev.preventDefault();
        }
        // save the scroll position to restore it on maximize
        if (this.model.collection && this.model.collection.browserStorage) {
            this.model.save({ 'scroll': this.content.scrollTop });
        } else {
            this.model.set({ 'scroll': this.content.scrollTop });
        }
        this.model.setChatState(_converse.INACTIVE);
        /**
         * Triggered when a previously maximized chat gets Minimized
         * @event _converse#chatBoxMinimized
         * @type { _converse.ChatBoxView }
         * @example _converse.api.listen.on('chatBoxMinimized', view => { ... });
         */
        api.trigger('chatBoxMinimized', this);
        return this;
    },

    /**
     * Minimizes a chat box.
     * @returns {_converse.ChatBoxView|_converse.ChatRoomView}
     */
    minimize (ev) {
        if (ev && ev.preventDefault) {
            ev.preventDefault();
        }
        this.model.minimize();
        return this;
    },

    onMinimizedChanged (item) {
        if (item.get('minimized')) {
            this.onMinimized();
        } else {
            this.onMaximized();
        }
    }
};
