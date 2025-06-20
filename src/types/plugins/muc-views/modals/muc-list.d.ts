export default class MUCListModal extends BaseModal {
    constructor(options: any);
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
     * @param {HTMLElement} [iq]
     */
    onRoomsFound(iq?: HTMLElement): boolean;
    /**
     * Send an IQ stanza to the server asking for all groupchats
     * @private
     * @method _converse.ChatRoomView#updateRoomsList
     */
    private updateRoomsList;
    showRooms(ev: any): void;
    setDomainFromEvent(ev: any): void;
    setNick(ev: any): void;
}
import BaseModal from 'plugins/modal/modal.js';
//# sourceMappingURL=muc-list.d.ts.map