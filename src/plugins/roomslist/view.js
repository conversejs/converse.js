import { _converse, api, converse, u, constants } from '@converse/headless';
import { __ } from 'i18n';
import 'plugins/muc-views/modals/muc-details.js';
import { CustomElement } from 'shared/components/element.js';
import RoomsListModel from './model.js';
import tplRoomslist from './templates/roomslist.js';

const { Strophe } = converse.env;
const { initStorage } = u;
const { CHATROOMS_TYPE, CLOSED, OPENED } = constants;

/**
 * Orders rooms by display name, falling back to the JID so that rooms with
 * the same name keep a stable order between renders.
 * @param {import('@converse/headless').MUC} a
 * @param {import('@converse/headless').MUC} b
 */
function compareRooms(a, b) {
    const name_a = a.getDisplayName().toLowerCase();
    const name_b = b.getDisplayName().toLowerCase();
    if (name_a !== name_b) return name_a < name_b ? -1 : 1;

    return a.get('jid') < b.get('jid') ? -1 : a.get('jid') > b.get('jid') ? 1 : 0;
}

export class RoomsList extends CustomElement {
    initialize() {
        const bare_jid = _converse.session.get('bare_jid');
        const id = `converse.roomspanel${bare_jid}`;
        this.model = new RoomsListModel({ id });
        _converse.state.roomslist = this.model;

        initStorage(this.model, id);
        this.model.fetch();

        this.addEventListeners();

        this.requestUpdate();
    }

    addEventListeners() {
        const { chatboxes } = _converse.state;
        this.listenTo(chatboxes, 'add', this.renderIfChatRoom);
        this.listenTo(chatboxes, 'remove', this.renderIfChatRoom);
        this.listenTo(chatboxes, 'destroy', this.renderIfChatRoom);
        this.listenTo(chatboxes, 'change', this.renderIfRelevantChange);
        this.listenTo(chatboxes, 'vcard:add', () => this.requestUpdate());
        this.listenTo(chatboxes, 'vcard:change', () => this.requestUpdate());
        this.listenTo(this.model, 'change', () => this.requestUpdate());
        this.listenTo(_converse, 'bookmarksInitialized', this.onBookmarksInitialized);
        this.onBookmarksInitialized(_converse.state.bookmarks);
    }

    /** @param {import('@converse/headless').Bookmarks} bookmarks */
    onBookmarksInitialized(bookmarks) {
        if (!bookmarks) return;
        this.stopListening(bookmarks, 'add remove change', this.onBookmarksChanged);
        this.listenTo(bookmarks, 'add remove change', this.onBookmarksChanged);
        this.requestUpdate();
    }

    onBookmarksChanged() {
        this.requestUpdate();
    }

    render() {
        return tplRoomslist(this);
    }

    /** @param {import('@converse/headless').Model} model */
    renderIfChatRoom(model) {
        u.muc.isChatRoom(model) && this.requestUpdate();
    }

    /** @param {import('@converse/headless').Model} model */
    renderIfRelevantChange(model) {
        const attrs = ['closed', 'hidden', 'name', 'num_unread', 'num_unread_general', 'has_activity'];
        const changed = model.changed || {};
        if (u.muc.isChatRoom(model) && Object.keys(changed).filter((m) => attrs.includes(m)).length) {
            this.requestUpdate();
        }
    }

    /**
     * Partitions the opened groupchats into pinned and unpinned rooms, each
     * sorted by display name. Every room is in exactly one partition.
     * @returns {{ pinned: import('@converse/headless').MUC[], unpinned: import('@converse/headless').MUC[] }}
     */
    getRoomPartitions() {
        const { chatboxes } = _converse.state;
        const rooms = chatboxes.filter((m) => m.get('type') === CHATROOMS_TYPE && !m.get('closed'));
        rooms.sort(compareRooms);

        const can_pin = this.canPinRooms();
        const pinned = [];
        const unpinned = [];
        for (const room of rooms) {
            if (can_pin && this.isRoomPinned(room)) {
                pinned.push(room);
            } else {
                unpinned.push(room);
            }
        }
        return { pinned, unpinned };
    }

    /** @returns {import('@converse/headless').Bookmarks|undefined} */
    getBookmarks() {
        return _converse.state.bookmarks;
    }

    canPinRooms() {
        return this.getBookmarks()?.supportsPinning() === true;
    }

    /** @param {import('@converse/headless').MUC} room */
    isRoomPinned(room) {
        return this.getBookmarks()?.get(room.get('jid'))?.get('pinned') === true;
    }

    /** @param {Event} ev */
    openRoom(ev) {
        ev.preventDefault();
        const target = u.ancestor(/** @type {HTMLElement} */ (ev.target), '.open-room');
        const name = target.getAttribute('data-room-name');
        const jid = target.getAttribute('data-room-jid');
        const data = {
            'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)) || jid,
        };
        api.trigger('openConversation', { view: 'room', jid, attrs: data });
    }

    /** @param {Event} ev */
    async closeRoom(ev) {
        ev.preventDefault();
        const target = /** @type {HTMLElement} */ (ev.currentTarget);
        const name = target.getAttribute('data-room-name');
        const jid = target.getAttribute('data-room-jid');
        const result = await api.confirm(__('Confirm'), __('Are you sure you want to leave the groupchat %1$s?', name));
        if (result) {
            const room = await api.rooms.get(jid);
            room.close();
        }
    }

    /** @param {Event} ev */
    pinRoom(ev) {
        ev.preventDefault();
        const bookmarks = this.getBookmarks();
        if (!bookmarks?.supportsPinning()) return;
        const target = /** @type {HTMLElement} */ (ev.currentTarget);
        const jid = target.getAttribute('data-room-jid');
        bookmarks.pinRoom(jid).catch(() => undefined);
    }

    /** @param {Event} ev */
    unpinRoom(ev) {
        ev.preventDefault();
        const bookmarks = this.getBookmarks();
        if (!bookmarks?.supportsPinning()) return;
        const target = /** @type {HTMLElement} */ (ev.currentTarget);
        const jid = target.getAttribute('data-room-jid');
        bookmarks.unpinRoom(jid).catch(() => undefined);
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
