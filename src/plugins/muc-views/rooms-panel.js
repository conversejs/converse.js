import AddMUCModal from 'modals/add-muc.js';
import tpl_room_panel from 'templates/room_panel.js';
import { View } from '@converse/skeletor/src/view.js';
import MUCListModal from 'modals/muc-list.js';
import { _converse, api, converse } from '@converse/headless/core';
import { __ } from 'i18n';

const u = converse.env.utils;

/**
 * View which renders MUC section of the control box.
 * @class
 * @namespace _converse.RoomsPanel
 * @memberOf _converse
 */
export const RoomsPanel = View.extend({
    tagName: 'div',
    className: 'controlbox-section',
    id: 'chatrooms',
    events: {
        'click a.controlbox-heading__btn.show-add-muc-modal': 'showAddRoomModal',
        'click a.controlbox-heading__btn.show-list-muc-modal': 'showMUCListModal'
    },

    toHTML () {
        return tpl_room_panel({
            'heading_chatrooms': __('Groupchats'),
            'title_new_room': __('Add a new groupchat'),
            'title_list_rooms': __('Query for groupchats')
        });
    },

    showAddRoomModal (ev) {
        api.modal.show(AddMUCModal, { 'model': this.model }, ev);
    },

    showMUCListModal (ev) {
        api.modal.show(MUCListModal, { 'model': this.model }, ev);
    }
});

/**
 * Mixin which adds the ability to a ControlBox to render a list of open groupchats
 * @mixin
 */
export const RoomsPanelViewMixin = {
    renderRoomsPanel () {
        if (this.roomspanel && u.isInDOM(this.roomspanel.el)) {
            return this.roomspanel;
        }
        const id = `converse.roomspanel${_converse.bare_jid}`;

        this.roomspanel = new _converse.RoomsPanel({
            'model': new (_converse.RoomsPanelModel.extend({
                id,
                'browserStorage': _converse.createStore(id)
            }))()
        });
        this.roomspanel.model.fetch();
        this.querySelector('.controlbox-pane').insertAdjacentElement('beforeEnd', this.roomspanel.render().el);

        /**
         * Triggered once the section of the { @link _converse.ControlBoxView }
         * which shows gropuchats has been rendered.
         * @event _converse#roomsPanelRendered
         * @example _converse.api.listen.on('roomsPanelRendered', () => { ... });
         */
        api.trigger('roomsPanelRendered');
        return this.roomspanel;
    },

    getRoomsPanel () {
        if (this.roomspanel && u.isInDOM(this.roomspanel.el)) {
            return this.roomspanel;
        } else {
            return this.renderRoomsPanel();
        }
    }
};
