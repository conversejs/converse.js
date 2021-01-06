import RoomDetailsModal from 'modals/muc-details.js';
import tpl_rooms_list from "./templates/roomslist.js";
import { ElementView } from '@converse/skeletor/src/element.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";

const { Strophe } = converse.env;
const u = converse.env.utils;


export class RoomsList extends ElementView {

    initialize () {
        this.model = _converse.chatboxes;
        this.listenTo(this.model, 'add', this.renderIfChatRoom)
        this.listenTo(this.model, 'remove', this.renderIfChatRoom)
        this.listenTo(this.model, 'destroy', this.renderIfChatRoom)
        this.listenTo(this.model, 'change', this.renderIfRelevantChange)

        const id = `converse.roomslist${_converse.bare_jid}`;
        this.list_model = new _converse.RoomsList({id});
        this.list_model.browserStorage = _converse.createStore(id);
        this.list_model.fetch();
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

    toHTML () {
        return tpl_rooms_list({
            '_converse': _converse,
            'addBookmark': ev => this.addBookmark(ev),
            'allow_bookmarks': _converse.allow_bookmarks && _converse.bookmarks,
            'closeRoom': ev => this.closeRoom(ev),
            'collapsed': this.list_model.get('toggle-state') !== _converse.OPENED,
            'currently_open': room => _converse.isUniView() && !room.get('hidden'),
            'openRoom': ev => this.openRoom(ev),
            'removeBookmark': ev => this.removeBookmark(ev),
            'rooms': this.model.filter(m => m.get('type') === _converse.CHATROOMS_TYPE),
            'showRoomDetailsModal': ev => this.showRoomDetailsModal(ev),
            'toggleRoomsList': ev => this.toggleRoomsList(ev),
            'toggle_state': this.list_model.get('toggle-state')
        });
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
                this.list_model.save({'toggle-state': _converse.CLOSED});
                icon_el.classList.remove("fa-caret-down");
                icon_el.classList.add("fa-caret-right");
            });
        } else {
            u.slideOut(this.el.querySelector('.open-rooms-list')).then(() => {
                this.list_model.save({'toggle-state': _converse.OPENED});
                icon_el.classList.remove("fa-caret-right");
                icon_el.classList.add("fa-caret-down");
            });
        }
    }
}

api.elements.define('converse-rooms-list', RoomsList);
