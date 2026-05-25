export default class MUCListModal extends BaseModal {
    /**
     * @typedef {import('shared/types').EventWithInputTarget} EventWithInputTarget
     */
    constructor(options: import("@converse/skeletor").ModelOptions);
    items: any[];
    loading_items: boolean;
    renderModal(): import("lit-html").TemplateResult<1>;
    getModalTitle(): any;
    /**
     * @param {MouseEvent} ev
     */
    openRoom(ev: MouseEvent): void;
    /**
     * @param {MouseEvent} ev
     */
    toggleRoomInfo(ev: MouseEvent): void;
    onDomainChange(): void;
    /**
     * Handle the IQ stanza returned from the server, containing
     * all its public groupchats.
     * @method _converse.ChatRoomView#onRoomsFound
     * @param {Element} [iq]
     */
    onRoomsFound(iq?: Element): boolean;
    /**
     * Send an IQ stanza to the server asking for all groupchats
     * @private
     * @method _converse.ChatRoomView#updateRoomsList
     */
    private updateRoomsList;
    showRooms(ev: Event): void;
    /** @param {EventWithInputTarget} ev */
    setDomainFromEvent(ev: import("shared/types").EventWithInputTarget): void;
    /** @param {EventWithInputTarget} ev */
    setNick(ev: import("shared/types").EventWithInputTarget): void;
}
import BaseModal from 'plugins/modal/modal.js';
//# sourceMappingURL=muc-list.d.ts.map