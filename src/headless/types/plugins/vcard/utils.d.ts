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
 * @param {Model|MUCOccupant|MUCMessage} model
 * @param {boolean} [create=true]
 * @returns {Promise<VCard|null>}
 */
export function getVCardForModel(model: Model | MUCOccupant | MUCMessage, create?: boolean): Promise<VCard | null>;
/**
 * @param {MUCOccupant} occupant
 * @param {boolean} [create=true]
 * @returns {Promise<VCard|null>}
 */
export function getVCardForOccupant(occupant: MUCOccupant, create?: boolean): Promise<VCard | null>;
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
export type VCard = import("../../plugins/vcard/vcard").default;
export type ModelWithContact = typeof import("../../shared/model-with-contact.js").default;
export type MUCOccupant = import("../muc/occupant.js").default;
export type Model = import("@converse/skeletor/src/types/helpers.js").Model;
//# sourceMappingURL=utils.d.ts.map