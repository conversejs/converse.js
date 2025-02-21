export default class MUCListModal extends BaseModal {
    constructor(options: any);
    items: any[];
    loading_items: boolean;
    renderModal(): import("lit").TemplateResult<1>;
    getModalTitle(): any;
    openRoom(ev: any): void;
    toggleRoomInfo(ev: any): void;
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
import BaseModal from "plugins/modal/modal.js";
//# sourceMappingURL=muc-list.d.ts.map