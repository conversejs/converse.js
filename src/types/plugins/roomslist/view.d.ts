export class RoomsList extends CustomElement {
    initialize(): void;
    model: RoomsListModel;
    render(): import("lit-html").TemplateResult<1>;
    renderIfChatRoom(model: any): void;
    renderIfRelevantChange(model: any): void;
    showRoomDetailsModal(ev: any): void;
    openRoom(ev: any): Promise<void>;
    closeRoom(ev: any): Promise<void>;
    toggleRoomsList(ev: any): void;
    toggleDomainList(ev: any, domain: any): void;
}
import { CustomElement } from "shared/components/element.js";
import RoomsListModel from "./model.js";
//# sourceMappingURL=view.d.ts.map