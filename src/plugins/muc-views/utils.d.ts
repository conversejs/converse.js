export function clearHistory(jid: any): void;
export function destroyMUC(model: any): Promise<any>;
export function getNicknameRequiredTemplate(model: any): import("lit-html").TemplateResult<1>;
export function getChatRoomBodyTemplate(o: any): import("lit-html").TemplateResult<1>;
export function getAutoCompleteListItem(text: any, input: any): HTMLLIElement;
export function getAutoCompleteList(): Promise<any[]>;
export function showModeratorToolsModal(muc: any, affiliation: any): void;
export function showOccupantModal(ev: any, occupant: any): void;
export function parseMessageForMUCCommands(data: any, handled: any): any;
