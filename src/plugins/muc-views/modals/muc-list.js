import BaseModal from 'plugins/modal/modal.js';
import tplMUCList from '../templates/muc-list.js';
import { __ } from 'i18n';
import { api, converse, log, u } from '@converse/headless';

const { sizzle } = converse.env;
const { getAttributes } = u;

class MUCListModal extends BaseModal {
    /**
     * @typedef {import('shared/types').EventWithInputTarget} EventWithInputTarget
     */

    constructor(/** @type {import('@converse/skeletor').ModelOptions} */ options) {
        super(options);
        this.items = [];
        this.loading_items = false;
        /**
         * Expanded groupchat info, keyed by groupchat JID.
         * `null` means the info is still being fetched.
         * @type {Map<string, import('@converse/headless').MUCRoomInfo|null>}
         */
        this.room_info = new Map();
    }

    initialize() {
        super.initialize();
        this.listenTo(this.model, 'change:muc_domain', this.onDomainChange);
        this.listenTo(this.model, 'change:feedback_text', () => this.requestUpdate());

        this.addEventListener('shown.bs.modal', () => api.settings.get('locked_muc_domain') && this.updateRoomsList());

        this.model.save('feedback_text', '');
    }

    renderModal() {
        return tplMUCList(
            Object.assign(this.model.toJSON(), {
                'show_form': !api.settings.get('locked_muc_domain'),
                'server_placeholder': this.model.get('muc_domain') || __('conference.example.org'),
                'items': this.items,
                'loading_items': this.loading_items,
                'room_info': this.room_info,
                'openRoom': (/** @type {MouseEvent} */ ev) => this.openRoom(ev),
                'setDomainFromEvent': (/** @type {EventWithInputTarget} */ ev) => this.setDomainFromEvent(ev),
                'submitForm': (/** @type {Event} */ ev) => this.showRooms(ev),
                'toggleRoomInfo': (/** @type {MouseEvent} */ ev) => this.toggleRoomInfo(ev),
            }),
        );
    }

    getModalTitle() {
        return __('Query for Groupchats');
    }

    /**
     * @param {MouseEvent} ev
     */
    openRoom(ev) {
        ev.preventDefault();
        const el = /** @type {Element} */ (ev.target);
        const jid = el.getAttribute('data-room-jid');
        const name = el.getAttribute('data-room-name');
        this.modal.hide();
        api.trigger('openConversation', { view: 'room', jid, attrs: { name } });
    }

    /**
     * Show or hide extra information about a groupchat in the listing.
     * @param {MouseEvent} ev
     */
    async toggleRoomInfo(ev) {
        ev.preventDefault();
        const jid = /** @type {Element} */ (ev.currentTarget).getAttribute('data-room-jid');
        if (this.room_info.has(jid)) {
            this.room_info.delete(jid);
            this.requestUpdate();
            return;
        }
        this.room_info.set(jid, null);
        this.requestUpdate();
        try {
            const info = await api.rooms.info(jid);
            if (this.room_info.has(jid)) this.room_info.set(jid, info);
        } catch (e) {
            log.error(e);
            this.room_info.delete(jid);
        }
        this.requestUpdate();
    }

    onDomainChange() {
        if (api.settings.get('auto_list_rooms')) this.updateRoomsList();
    }

    /**
     * Handle the IQ stanza returned from the server, containing
     * all its public groupchats.
     * @method _converse.ChatRoomView#onRoomsFound
     * @param {Element} [iq]
     */
    onRoomsFound(iq) {
        this.loading_items = false;
        this.room_info.clear();
        const rooms = iq ? sizzle('query item', iq) : [];
        if (rooms.length) {
            this.model.set({ 'feedback_text': __('Groupchats found') }, { 'silent': true });
            this.items = rooms.map(getAttributes);
        } else {
            this.items = [];
            this.model.set({ 'feedback_text': __('No groupchats found') }, { 'silent': true });
        }
        this.requestUpdate();
        return true;
    }

    /**
     * Send an IQ stanza to the server asking for all groupchats
     * @private
     * @method _converse.ChatRoomView#updateRoomsList
     */
    updateRoomsList() {
        api.disco
            .items(this.model.get('muc_domain'))
            .then(/** @param {Element} iq */ (iq) => this.onRoomsFound(iq))
            .catch(() => this.onRoomsFound());
    }

    showRooms(/** @type {Event} */ ev) {
        ev.preventDefault();
        this.loading_items = true;
        this.requestUpdate();

        const data = new FormData(/** @type {HTMLFormElement} */ (ev.target));
        this.model.setDomain(data.get('server'));
        this.updateRoomsList();
    }

    /** @param {EventWithInputTarget} ev */
    setDomainFromEvent(ev) {
        this.model.setDomain(ev.target.value);
    }
    /** @param {EventWithInputTarget} ev */
    setNick(ev) {
        this.model.save({ nick: ev.target.value });
    }
}

api.elements.define('converse-muc-list-modal', MUCListModal);
