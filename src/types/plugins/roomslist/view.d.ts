export class RoomsList extends CustomElement {
    initialize(): void;
    model: RoomsListModel;
    render(): import("lit-html").TemplateResult<1>;
    /** @param {Model} model */
    renderIfChatRoom(model: Model): void;
    /** @param {Model} model */
    renderIfRelevantChange(model: Model): void;
    /** @param {Event} ev */
    showRoomDetailsModal(ev: Event): void;
    /** @param {Event} ev */
    openRoom(ev: Event): Promise<void>;
    /** @param {Event} ev */
    closeRoom(ev: Event): Promise<void>;
    /** @param {Event} [ev] */
    toggleRoomsList(ev?: Event): void;
    /**
     * @param {Event} ev
     * @param {string} domain
     */
    toggleDomainList(ev: Event, domain: string): void;
}
export type Model = import('@converse/skeletor').Model;
import { CustomElement } from "shared/components/element.js";
import RoomsListModel from "./model.js";
//# sourceMappingURL=view.d.ts.map