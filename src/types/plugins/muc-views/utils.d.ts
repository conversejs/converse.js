/**
 * Presents a confirmation modal to the user asking them to accept or decline a
 * MUC invitation.
 * @async
 * @param {import('./types').MUCInvitationObj} obj
 */
export function confirmDirectMUCInvitation({ contact, jid, reason }: import("./types").MUCInvitationObj): any;
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
export function getNicknameRequiredTemplate(model: MUC): import("lit-html").TemplateResult<1>;
/**
 * @param {MUC} model
 */
export function getChatRoomBodyTemplate(model: MUC): import("lit-html").TemplateResult<1>;
/**
 * @param {MUC} muc
 * @param {Suggestion} text
 * @param {string} input
 * @returns {import('lit').TemplateResult} The rendered HTML for the item.
 */
export function getAutoCompleteListItem(muc: MUC, text: Suggestion, input: string): import("lit").TemplateResult;
export function getAutoCompleteList(): Promise<any[]>;
/**
 * @param {MUC} muc
 * @param {string} [affiliation]
 */
export function showModeratorToolsModal(muc: MUC, affiliation?: string): void;
/**
 * @param {Event} ev
 * @param {import('@converse/headless').MUCOccupant} model
 */
export function showOccupantModal(ev: Event, model: import("@converse/headless").MUCOccupant): void;
export function parseMessageForMUCCommands(data: any, handled: any): Promise<any>;
export type MUC = import("@converse/headless/types/plugins/muc/muc").default;
export type Avatar = import("shared/avatar/avatar").default;
export type Suggestion = import("shared/autocomplete/suggestion").default;
//# sourceMappingURL=utils.d.ts.map