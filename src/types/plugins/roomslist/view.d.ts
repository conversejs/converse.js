export class RoomsList extends CustomElement {
    initialize(): void;
    model: RoomsListModel;
    render(): import("lit-html").TemplateResult<1>;
    /** @param {import('@converse/headless').Model} model */
    renderIfChatRoom(model: import("@converse/headless").Model): void;
    /** @param {import('@converse/headless').Model} model */
    renderIfRelevantChange(model: import("@converse/headless").Model): void;
    /** @returns {import('@converse/headless').MUC[]} */
    getRoomsToShow(): import("@converse/headless").MUC[];
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
import { CustomElement } from 'shared/components/element.js';
import RoomsListModel from './model.js';
//# sourceMappingURL=view.d.ts.map