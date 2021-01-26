import { converse } from '@converse/headless/core';

const u = converse.env.utils;

/**
 * Mixin which adds the ability to a ControlBox to render a list of open groupchats
 * @mixin
 */
export const RoomsPanelViewMixin = {
    getRoomsPanel () {
        if (this.roomspanel && u.isInDOM(this.roomspanel.el)) {
            return this.roomspanel;
        } else {
            return this.renderRoomsPanel();
        }
    }
};
