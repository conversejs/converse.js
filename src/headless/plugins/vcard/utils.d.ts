export function createStanza(type: any, jid: any, vcard_el: any): any;
export function onOccupantAvatarChanged(occupant: any): void;
export function setVCardOnModel(model: any): Promise<void>;
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
