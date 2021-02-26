import RoomDetailsModal from 'modals/muc-details.js';
import tpl_rooms_list from "./templates/roomslist.js";
import { ElementView } from '@converse/skeletor/src/element.js';
import { Model } from '@converse/skeletor/src/model.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";
import { render } from 'lit-html';

const { Strophe } = converse.env;
const u = converse.env.utils;


const RoomsListModel = Model.extend({
    defaults: function () {
        return {
            'muc_domain': api.settings.get('muc_domain'),
            'nick': _converse.getDefaultMUCNickname(),
            'toggle-state':  _converse.OPENED,
        };
    },

    setDomain (jid) {
        if (!api.settings.get('locked_muc_domain')) {
            this.save('muc_domain', Strophe.getDomainFromJid(jid));
        }
    }
});


export class RoomsList extends ElementView {

    initialize () {
        const id = `converse.roomspanel${_converse.bare_jid}`;
        this.model = new (RoomsListModel.extend({
            id,
            'browserStorage': _converse.createStore(id)
        }))();
        this.model.fetch();

        this.listenTo(_converse.chatboxes, 'add', this.renderIfChatRoom)
        this.listenTo(_converse.chatboxes, 'remove', this.renderIfChatRoom)
        this.listenTo(_converse.chatboxes, 'destroy', this.renderIfChatRoom)
        this.listenTo(_converse.chatboxes, 'change', this.renderIfRelevantChange)

        this.render();
    }

    renderIfChatRoom (model) {
        u.isChatRoom(model) && this.render();
    }

    renderIfRelevantChange (model) {
        const attrs = ['bookmarked', 'hidden', 'name', 'num_unread', 'num_unread_general', 'has_activity'];
        const changed = model.changed || {};
        if (u.isChatRoom(model) && Object.keys(changed).filter(m => attrs.includes(m)).length) {
            this.render();
        }
    }

    render () {
        render(tpl_rooms_list({
            'addBookmark': ev => this.addBookmark(ev),
            'allow_bookmarks': _converse.allow_bookmarks && _converse.bookmarks,
            'closeRoom': ev => this.closeRoom(ev),
            'collapsed': this.model.get('toggle-state') !== _converse.OPENED,
            'currently_open': room => _converse.isUniView() && !room.get('hidden'),
            'model': this.model,
            'openRoom': ev => this.openRoom(ev),
            'removeBookmark': ev => this.removeBookmark(ev),
            'rooms': _converse.chatboxes.filter(m => m.get('type') === _converse.CHATROOMS_TYPE),
            'showRoomDetailsModal': ev => this.showRoomDetailsModal(ev),
            'toggleRoomsList': ev => this.toggleRoomsList(ev),
            'toggle_state': this.model.get('toggle-state')
        }), this);
    }

    showRoomDetailsModal (ev) { // eslint-disable-line class-methods-use-this
        const jid = ev.target.getAttribute('data-room-jid');
        const room = _converse.chatboxes.get(jid);
        ev.preventDefault();
        api.modal.show(RoomDetailsModal, {'model': room}, ev);
    }

    async openRoom (ev) { // eslint-disable-line class-methods-use-this
        ev.preventDefault();
        const name = ev.target.textContent;
        const jid = ev.target.getAttribute('data-room-jid');
        const data = {
            'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)) || jid
        }
        await api.rooms.open(jid, data, true);
        api.chatviews.get(jid).maybeFocus();
    }

    closeRoom (ev) { // eslint-disable-line class-methods-use-this
        ev.preventDefault();
        const name = ev.target.getAttribute('data-room-name');
        const jid = ev.target.getAttribute('data-room-jid');
        if (confirm(__("Are you sure you want to leave the groupchat %1$s?", name))) {
            // TODO: replace with API call
            _converse.chatboxviews.get(jid).close();
        }
    }

    removeBookmark (ev) { // eslint-disable-line class-methods-use-this
        _converse.removeBookmarkViaEvent(ev);
    }

    addBookmark (ev) { // eslint-disable-line class-methods-use-this
        _converse.addBookmarkViaEvent(ev);
    }

    toggleRoomsList (ev) {
        if (ev && ev.preventDefault) { ev.preventDefault(); }
        const icon_el = ev.target.matches('.fa') ? ev.target : ev.target.querySelector('.fa');
        if (icon_el.classList.contains("fa-caret-down")) {
            u.slideIn(this.el.querySelector('.open-rooms-list')).then(() => {
                this.model.save({'toggle-state': _converse.CLOSED});
                icon_el.classList.remove("fa-caret-down");
                icon_el.classList.add("fa-caret-right");
            });
        } else {
            u.slideOut(this.el.querySelector('.open-rooms-list')).then(() => {
                this.model.save({'toggle-state': _converse.OPENED});
                icon_el.classList.remove("fa-caret-right");
                icon_el.classList.add("fa-caret-down");
            });
        }
    }
}

api.elements.define('converse-rooms-list', RoomsList);
