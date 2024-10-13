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
/**
 * @param {string} jid
 */
export function clearHistory(jid: string): void;
/**
 * @param {MUC} model
 */
export function destroyMUC(model: MUC): Promise<any>;
/**
 * @param {MUC} model
 */
export function getNicknameRequiredTemplate(model: MUC): import("lit").TemplateResult<1>;
/**
 * @param {MUC} model
 */
export function getChatRoomBodyTemplate(model: MUC): import("lit").TemplateResult<1>;
/**
 * @param {MUC} muc
 * @param {Suggestion} text
 * @param {string} input
 * @returns {HTMLLIElement}
 */
export function getAutoCompleteListItem(muc: MUC, text: Suggestion, input: string): HTMLLIElement;
export function getAutoCompleteList(): Promise<any[]>;
/**
 * @param {MUC} muc
 * @param {string} [affiliation]
 */
export function showModeratorToolsModal(muc: MUC, affiliation?: string): void;
export function showOccupantModal(ev: any, occupant: any): void;
export function parseMessageForMUCCommands(data: any, handled: any): any;
export type MUC = import("@converse/headless/types/plugins/muc/muc.js").default;
export type Avatar = import("shared/avatar/avatar").default;
export type Suggestion = import("shared/autocomplete/suggestion").default;
//# sourceMappingURL=utils.d.ts.map