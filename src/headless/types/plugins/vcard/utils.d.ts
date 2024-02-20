export function createStanza(type: any, jid: any, vcard_el: any): any;
/**
 * @param {ChatRoomOccupant} occupant
 */
export function onOccupantAvatarChanged(occupant: ChatRoomOccupant): void;
/**
 * @param {ModelWithContact} model
 */
export function setVCardOnModel(model: ModelWithContact): Promise<void>;
export function setVCardOnOccupant(occupant: any): Promise<void>;
export function setVCardOnMUCMessage(message: any): Promise<void>;
export function initVCardCollection(): Promise<void>;
export function clearVCardsSession(): void;
export function getVCard(jid: any): Promise<{
    image_hash: any;
} | {
    jid: any;
    stanza: any;
    vcard_error: string;
}>;
export type ChatRoomOccupant = import('../muc/occupant.js').default;
export type ModelWithContact = import('../chat/model-with-contact.js').default;
//# sourceMappingURL=utils.d.ts.map