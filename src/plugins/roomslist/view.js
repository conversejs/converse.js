import 'plugins/muc-views/modals/muc-details.js';
import RoomsListModel from './model.js';
import tplRoomslist from "./templates/roomslist.js";
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";
import { initStorage } from '@converse/headless/utils/storage.js';

const { Strophe, u } = converse.env;

export class RoomsList extends CustomElement {

    initialize () {
        const id = `converse.roomspanel${_converse.bare_jid}`;
        this.model = new RoomsListModel({ id });
        initStorage(this.model, id);
        this.model.fetch();

        this.listenTo(_converse.chatboxes, 'add', this.renderIfChatRoom);
        this.listenTo(_converse.chatboxes, 'remove', this.renderIfChatRoom);
        this.listenTo(_converse.chatboxes, 'destroy', this.renderIfChatRoom);
        this.listenTo(_converse.chatboxes, 'change', this.renderIfRelevantChange);
        this.listenTo(this.model, 'change', () => this.requestUpdate());

        this.requestUpdate();
    }

    render () {
        return tplRoomslist(this);
    }

    renderIfChatRoom (model) {
        u.isChatRoom(model) && this.requestUpdate();
    }

    renderIfRelevantChange (model) {
        const attrs = ['bookmarked', 'hidden', 'name', 'num_unread', 'num_unread_general', 'has_activity'];
        const changed = model.changed || {};
        if (u.isChatRoom(model) && Object.keys(changed).filter(m => attrs.includes(m)).length) {
            this.requestUpdate();
        }
    }

    showRoomDetailsModal (ev) { // eslint-disable-line class-methods-use-this
        const jid = ev.currentTarget.getAttribute('data-room-jid');
        const room = _converse.chatboxes.get(jid);
        ev.preventDefault();
        api.modal.show('converse-muc-details-modal', {'model': room}, ev);
    }

    async openRoom (ev) { // eslint-disable-line class-methods-use-this
        ev.preventDefault();
        const name = ev.target.textContent;
        const jid = ev.target.getAttribute('data-room-jid');
        const data = {
            'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)) || jid
        }
        await api.rooms.open(jid, data, true);
    }

    async closeRoom (ev) { // eslint-disable-line class-methods-use-this
        ev.preventDefault();
        const name = ev.currentTarget.getAttribute('data-room-name');
        const jid = ev.currentTarget.getAttribute('data-room-jid');
        const result = await api.confirm(__("Are you sure you want to leave the groupchat %1$s?", name));
        if (result) {
            const room = await api.rooms.get(jid);
            room.close();
        }
    }

    toggleRoomsList (ev) {
        ev?.preventDefault?.();
        const list_el = this.querySelector('.open-rooms-list');
        if (this.model.get('toggle_state') === _converse.CLOSED) {
            u.slideOut(list_el).then(() => this.model.save({'toggle_state': _converse.OPENED}));
        } else {
            u.slideIn(list_el).then(() => this.model.save({'toggle_state': _converse.CLOSED}));
        }
    }
}

api.elements.define('converse-rooms-list', RoomsList);
