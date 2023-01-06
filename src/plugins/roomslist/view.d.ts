export class RoomsList {
    initialize(): void;
    model: any;
    renderIfChatRoom(model: any): void;
    renderIfRelevantChange(model: any): void;
    render(): import("lit-html").TemplateResult<1>;
    showRoomDetailsModal(ev: any): void;
    openRoom(ev: any): Promise<void>;
    closeRoom(ev: any): Promise<void>;
    removeBookmark(ev: any): void;
    addBookmark(ev: any): void;
    toggleRoomsList(ev: any): void;
}
