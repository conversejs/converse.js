/**
 * Presents a confirmation modal to the user asking them to accept or decline a
 * MUC invitation.
 * @async
 */
export function confirmDirectMUCInvitation({ contact, jid, reason }: {
    contact: any;
    jid: any;
    reason: any;
}): any;
export function clearHistory(jid: any): void;
export function destroyMUC(model: any): Promise<any>;
export function getNicknameRequiredTemplate(model: any): import("lit-html").TemplateResult<1>;
export function getChatRoomBodyTemplate(o: any): import("lit-html").TemplateResult<1>;
export function getAutoCompleteListItem(text: any, input: any): HTMLLIElement;
export function getAutoCompleteList(): Promise<any[]>;
export function showModeratorToolsModal(muc: any, affiliation: any): void;
export function showOccupantModal(ev: any, occupant: any): void;
export function parseMessageForMUCCommands(data: any, handled: any): any;
//# sourceMappingURL=utils.d.ts.map