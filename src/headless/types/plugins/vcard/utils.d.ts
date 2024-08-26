/**
 * @param {"get"|"set"|"result"} type
 * @param {string} jid
 * @param {Element} [vcard_el]
 */
export function createStanza(type: "get" | "set" | "result", jid: string, vcard_el?: Element): any;
/**
 * @param {MUCOccupant} occupant
 */
export function onOccupantAvatarChanged(occupant: MUCOccupant): void;
/**
 * @param {InstanceType<ReturnType<ModelWithContact>>} model
 */
export function setVCardOnModel(model: InstanceType<ReturnType<ModelWithContact>>): Promise<void>;
/**
 * @param {MUCOccupant} occupant
 */
export function setVCardOnOccupant(occupant: MUCOccupant): Promise<void>;
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
    stanza: any;
    error: any;
    vcard_error: string;
}>;
export type MUCMessage = import("../../plugins/muc/message").default;
export type XMPPStatus = import("../../plugins/status/status").default;
export type VCards = import("../../plugins/vcard/vcards").default;
export type ModelWithContact = typeof import("../../shared/model-with-contact.js").default;
export type MUCOccupant = import("../muc/occupant.js").default;
//# sourceMappingURL=utils.d.ts.map