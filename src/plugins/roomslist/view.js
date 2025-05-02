/**
 * @typedef {import('@converse/skeletor').Model} Model
 */
import { _converse, api, converse, u, constants } from '@converse/headless';
import { __ } from 'i18n';
import 'plugins/muc-views/modals/muc-details.js';
import { CustomElement } from 'shared/components/element.js';
import RoomsListModel from './model.js';
import tplRoomslist from './templates/roomslist.js';

const { Strophe } = converse.env;
const { initStorage } = u;
const { CLOSED, OPENED } = constants;

export class RoomsList extends CustomElement {
    initialize() {
        const bare_jid = _converse.session.get('bare_jid');
        const id = `converse.roomspanel${bare_jid}`;
        this.model = new RoomsListModel({ id });
        _converse.state.roomslist = this.model;

        initStorage(this.model, id);
        this.model.fetch();

        const { chatboxes } = _converse.state;
        this.listenTo(chatboxes, 'add', this.renderIfChatRoom);
        this.listenTo(chatboxes, 'remove', this.renderIfChatRoom);
        this.listenTo(chatboxes, 'destroy', this.renderIfChatRoom);
        this.listenTo(chatboxes, 'change', this.renderIfRelevantChange);
        this.listenTo(chatboxes, 'vcard:add', () => this.requestUpdate());
        this.listenTo(chatboxes, 'vcard:change', () => this.requestUpdate());
        this.listenTo(this.model, 'change', () => this.requestUpdate());

        this.requestUpdate();
    }

    render() {
        return tplRoomslist(this);
    }

    /** @param {Model} model */
    renderIfChatRoom(model) {
        u.muc.isChatRoom(model) && this.requestUpdate();
    }

    /** @param {Model} model */
    renderIfRelevantChange(model) {
        const attrs = ['bookmarked', 'hidden', 'name', 'num_unread', 'num_unread_general', 'has_activity'];
        const changed = model.changed || {};
        if (u.muc.isChatRoom(model) && Object.keys(changed).filter((m) => attrs.includes(m)).length) {
            this.requestUpdate();
        }
    }

    /** @param {Event} ev */
    async openRoom(ev) {
        ev.preventDefault();
        const target = u.ancestor(/** @type {HTMLElement} */ (ev.target), '.open-room');
        const name = target.getAttribute('data-room-name');
        const jid = target.getAttribute('data-room-jid');
        const data = {
            'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)) || jid,
        };
        await api.rooms.open(jid, data, true);
    }

    /** @param {Event} ev */
    async closeRoom(ev) {
        ev.preventDefault();
        const target = /** @type {HTMLElement} */ (ev.currentTarget);
        const name = target.getAttribute('data-room-name');
        const jid = target.getAttribute('data-room-jid');
        const result = await api.confirm(
            __('Confirm'),
            __('Are you sure you want to leave the groupchat %1$s?', name)
        );
        if (result) {
            const room = await api.rooms.get(jid);
            room.close();
        }
    }

    /** @param {Event} [ev] */
    toggleRoomsList(ev) {
        ev?.preventDefault?.();
        const list_el = this.querySelector('.open-rooms-list');
        if (this.model.get('toggle_state') === CLOSED) {
            u.slideOut(list_el).then(() => this.model.save({ 'toggle_state': OPENED }));
        } else {
            u.slideIn(list_el).then(() => this.model.save({ 'toggle_state': CLOSED }));
        }
    }

    /**
     * @param {Event} ev
     * @param {string} domain
     */
    toggleDomainList(ev, domain) {
        ev?.preventDefault?.();
        const collapsed = this.model.get('collapsed_domains');
        if (collapsed.includes(domain)) {
            this.model.save({ 'collapsed_domains': collapsed.filter((d) => d !== domain) });
        } else {
            this.model.save({ 'collapsed_domains': [...collapsed, domain] });
        }
    }
}

api.elements.define('converse-rooms-list', RoomsList);
