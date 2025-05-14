/**
 * @param {Element} iq
 * @returns {Promise<import("./types").VCardResult>}
 */
export function onVCardData(iq: Element): Promise<import("./types").VCardResult>;
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
 * @param {boolean} [lazy_load=false]
 * @returns {Promise<VCard|null>}
 */
export function getVCardForModel(model: Model | MUCOccupant | MUCMessage, lazy_load?: boolean): Promise<VCard | null>;
/**
 * @param {MUCOccupant} occupant
 * @param {boolean} [lazy_load=false]
 * @returns {Promise<VCard|null>}
 */
export function getVCardForOccupant(occupant: MUCOccupant, lazy_load?: boolean): Promise<VCard | null>;
export function clearVCardsSession(): void;
/**
 * @param {string} jid
 */
export function fetchVCard(jid: string): Promise<import("./types").VCardResult | {
    jid: string;
    stanza: any;
    error: any;
    vcard_error: string;
}>;
export function unregisterPresenceHandler(): void;
export function registerPresenceHandler(): void;
export type MUCMessage = import("../../plugins/muc/message").default;
export type Profile = import("../../plugins/status/profile").default;
export type VCards = import("../../plugins/vcard/vcards").default;
export type VCard = import("../../plugins/vcard/vcard").default;
export type ModelWithContact = typeof import("../../shared/model-with-contact.js").default;
export type MUCOccupant = import("../muc/occupant.js").default;
export type Model = import("@converse/skeletor/src/types/helpers.js").Model;
//# sourceMappingURL=utils.d.ts.map