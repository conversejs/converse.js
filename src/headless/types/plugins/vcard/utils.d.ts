/**
 * @param {"get"|"set"|"result"} type
 * @param {string} jid
 * @param {Element} [vcard_el]
 */
export function createStanza(type: "get" | "set" | "result", jid: string, vcard_el?: Element): any;
/**
 * @param {ChatRoomOccupant} occupant
 */
export function onOccupantAvatarChanged(occupant: ChatRoomOccupant): void;
/**
 * @param {ModelWithContact} model
 */
export function setVCardOnModel(model: ModelWithContact): Promise<void>;
/**
 * @param {ChatRoomOccupant} occupant
 */
export function setVCardOnOccupant(occupant: ChatRoomOccupant): Promise<void>;
/**
 * @param {MUCMessage} message
 */
export function setVCardOnMUCMessage(message: MUCMessage): Promise<void>;
export function initVCardCollection(): Promise<void>;
export function clearVCardsSession(): void;
/**
 * @param {string} jid
 */
export function getVCard(jid: string): Promise<{
    image_hash: any;
} | {
    jid: string;
    error: any;
    vcard: any;
    vcard_error: string;
}>;
export type ChatRoomOccupant = import('../muc/occupant.js').default;
export type ModelWithContact = import('../chat/model-with-contact.js').default;
export type XMPPStatus = import('../../plugins/status/status').default;
export type VCards = import('../../plugins/vcard/vcards').default;
export type MUCMessage = import('../../plugins/muc/message').default;
//# sourceMappingURL=utils.d.ts.map